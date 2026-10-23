import { appendFile, mkdir, open, readFile, rename } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Le journal : ce qui rend une generation en masse REPRENABLE.
 *
 * Il tient, pour chaque reference, l'empreinte de fraicheur de la derniere
 * fiche rendue, la version de template utilisee, et le compte d'echecs
 * consecutifs. Fermer le terminal, subir une coupure, relancer le lendemain :
 * la reprise ne coute rien puisque l'etat est sur disque, pas en memoire.
 *
 * FORME : un JSONL en ajout seul, une ligne par evenement, releu au demarrage
 * (le dernier evenement d'une reference gagne). Reecrire un gros JSON apres
 * chaque fiche couterait O(n) ecritures par produit — soit O(n2) sur le
 * catalogue — et perdrait tout ce qui n'a pas encore ete ecrit en cas de
 * coupure. Un ajout de ligne coute O(1) et survit a un kill -9.
 */

export type JournalEntry = {
  ref: string;
  fingerprint: string;
  template: string;
  /** Version REELLEMENT servie, lue dans x-template-version. */
  version: number;
  locale: string;
  output: string;
  bytes: number;
  rendered_at: string;
  warnings?: string[];
};

export type JournalFailure = {
  ref: string;
  /** Echecs CONSECUTIFS. Remis a zero par un rendu reussi. */
  attempts: number;
  status: number;
  error: string;
  last_attempt_at: string;
};

type Event =
  | ({ t: "ok" } & JournalEntry)
  | ({ t: "ko" } & JournalFailure)
  /** Oublie tout d'une reference : elle sera regeneree. */
  | { t: "forget"; ref: string }
  /** Leve la seule quarantaine, en gardant la fiche deja rendue. */
  | { t: "reset"; ref: string };

/** Etat d'une reference au moment ou le lot la rencontre. */
export type Freshness =
  | { state: "absente" }
  | { state: "a-jour"; entry: JournalEntry }
  | { state: "donnees-modifiees"; entry: JournalEntry }
  | { state: "template-republie"; entry: JournalEntry; published: number | null }
  | { state: "en-quarantaine"; failure: JournalFailure };

export class Journal {
  private readonly path: string;
  private readonly entries = new Map<string, JournalEntry>();
  private readonly failures = new Map<string, JournalFailure>();
  private lines = 0;

  private constructor(path: string) {
    this.path = path;
  }

  static async open(path: string): Promise<Journal> {
    const journal = new Journal(path);
    await mkdir(dirname(path), { recursive: true });

    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
      return journal;
    }

    for (const line of raw.split("\n")) {
      if (line.trim() === "") continue;
      journal.lines += 1;
      let event: Event;
      try {
        event = JSON.parse(line) as Event;
      } catch {
        // Une ligne tronquee par une coupure en plein ajout : la reference
        // concernee sera simplement regeneree. Refuser d'ouvrir le journal
        // entier pour une ligne perdue serait hors de proportion.
        continue;
      }
      journal.apply(event);
    }
    return journal;
  }

  private apply(event: Event): void {
    if (event.t === "ok") {
      const { t: _t, ...entry } = event;
      this.entries.set(entry.ref, entry);
      this.failures.delete(entry.ref);
      return;
    }
    if (event.t === "ko") {
      const { t: _t, ...failure } = event;
      this.failures.set(failure.ref, failure);
      return;
    }
    if (event.t === "forget") {
      this.entries.delete(event.ref);
    }
    this.failures.delete(event.ref);
  }

  /**
   * Deux raisons de regenerer, et il FAUT les deux.
   *
   * L'empreinte ne couvre que les donnees : publier une nouvelle version du
   * template ne la change pas. Sans la comparaison de version, une fiche reste
   * "a jour" indefiniment et le catalogue sert l'ancien rendu — c'est le defaut
   * nomme au §5 de docs/integrer-un-connecteur.md.
   */
  freshness(
    ref: string,
    fingerprint: string,
    publishedVersion: number | null,
    maxAttempts: number
  ): Freshness {
    const failure = this.failures.get(ref);
    if (failure && maxAttempts > 0 && failure.attempts >= maxAttempts) {
      return { state: "en-quarantaine", failure };
    }

    const entry = this.entries.get(ref);
    if (!entry) return { state: "absente" };
    if (entry.fingerprint !== fingerprint) return { state: "donnees-modifiees", entry };
    if (publishedVersion !== null && entry.version !== publishedVersion) {
      return { state: "template-republie", entry, published: publishedVersion };
    }
    return { state: "a-jour", entry };
  }

  entry(ref: string): JournalEntry | undefined {
    return this.entries.get(ref);
  }

  failure(ref: string): JournalFailure | undefined {
    return this.failures.get(ref);
  }

  async succeed(entry: JournalEntry): Promise<void> {
    await this.append({ t: "ok", ...entry });
  }

  /**
   * L'echec s'ACCUMULE : c'est ce compteur qui met en quarantaine une reference
   * qui echoue systematiquement. Sans lui, une fiche au HTML impossible a
   * rendre serait resservie a chaque lot et consommerait indefiniment le budget
   * de temps des milliers d'autres.
   */
  async fail(ref: string, status: number, error: string): Promise<void> {
    const previous = this.failures.get(ref);
    await this.append({
      t: "ko",
      ref,
      attempts: (previous?.attempts ?? 0) + 1,
      status,
      error: error.slice(0, 500),
      last_attempt_at: new Date().toISOString(),
    });
  }

  /** Leve la quarantaine (--retry-failed) sans perdre les fiches deja rendues. */
  async clearFailures(): Promise<number> {
    const refs = [...this.failures.keys()];
    for (const ref of refs) {
      await this.append({ t: "reset", ref });
    }
    return refs.length;
  }

  /** Oublie une reference : sa prochaine rencontre la regenerera. */
  async forget(ref: string): Promise<void> {
    await this.append({ t: "forget", ref });
  }

  get size(): number {
    return this.entries.size;
  }

  private async append(event: Event): Promise<void> {
    this.apply(event);
    // Un ajout d'une ligne courte est atomique au sens ou aucun autre ecrivain
    // ne peut s'intercaler au milieu : deux collecteurs qui partageraient le
    // meme journal ne se corrompraient pas mutuellement.
    await appendFile(this.path, `${JSON.stringify(event)}\n`, "utf8");
    this.lines += 1;
  }

  /**
   * Le JSONL grossit a chaque passage. La compaction reecrit l'etat courant
   * dans un fichier temporaire puis le renomme : un `rename` est atomique sur
   * le meme systeme de fichiers, donc une coupure en pleine compaction laisse
   * l'ancien journal intact plutot qu'un fichier a moitie ecrit.
   */
  async compact(force = false): Promise<boolean> {
    const useful = this.entries.size + this.failures.size;
    if (!force && this.lines < 200 && this.lines < useful * 3) return false;

    const body = [
      ...[...this.entries.values()].map((entry) => JSON.stringify({ t: "ok", ...entry })),
      ...[...this.failures.values()].map((failure) => JSON.stringify({ t: "ko", ...failure })),
    ].join("\n");

    const tmp = `${this.path}.tmp`;
    const handle = await open(tmp, "w");
    try {
      await handle.writeFile(body === "" ? "" : `${body}\n`, "utf8");
      // Sans fsync, le rename peut etre visible avant le contenu apres une
      // coupure machine : le journal serait alors vide, et tout le catalogue
      // regenere.
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tmp, this.path);
    this.lines = this.entries.size + this.failures.size;
    return true;
  }
}
