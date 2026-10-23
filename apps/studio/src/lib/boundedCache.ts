/**
 * Cache borne en OCTETS, avec peremption — module pur, sans base ni Next.
 *
 * BORNE EN OCTETS ET NON EN NOMBRE D'ENTREES, parce que ce qu'on y met a des
 * tailles tres inegales : un picto de badge pese 2 Ko, un logo pleine largeur
 * peut en peser deux mille fois plus (MAX_ASSET_BYTES vaut 2 Mo). Un plafond
 * « cent entrees » autoriserait donc de 200 Ko a 200 Mo selon ce qui passe —
 * c'est-a-dire ne bornerait rien.
 *
 * EVICTION EN PREMIER ENTRE, PREMIER SORTI, et non en « moins recemment
 * utilise ». La difference ne se voit pas ici : le contenu est stable (les
 * pictos d'un template) et tient largement sous le plafond, donc rien n'est
 * evince en regime normal. Une politique LRU demanderait de reordonner a chaque
 * lecture pour un gain nul et un code plus difficile a relire. `Map` en
 * JavaScript conserve l'ordre d'insertion, ce qui rend le FIFO gratuit.
 *
 * MONO-PROCESSUS. Une ecriture faite par un autre processus n'invalide pas ce
 * cache-ci : c'est la raison d'etre de la peremption, qui borne l'incoherence a
 * sa duree. Voir le commentaire de `readAssetInlined` dans assetStore.ts.
 */

type Entry<T> = { value: T; bytes: number; expiresAt: number };

export class BoundedCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private bytes = 0;

  constructor(
    private readonly maxBytes: number,
    private readonly ttlMs: number,
    /** Injectee pour que la peremption soit testable sans attendre. */
    private readonly now: () => number = Date.now
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      this.bytes -= entry.bytes;
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, bytes: number): void {
    // Une entree plus grosse que le plafond n'est pas stockee : la garder
    // viderait le cache entier pour un seul element, ce qui est pire que de ne
    // pas cacher du tout.
    if (bytes > this.maxBytes) return;

    this.delete(key);

    while (this.bytes + bytes > this.maxBytes) {
      const doyen = this.entries.keys().next();
      if (doyen.done) break;
      this.delete(doyen.value);
    }

    this.entries.set(key, { value, bytes, expiresAt: this.now() + this.ttlMs });
    this.bytes += bytes;
  }

  delete(key: string): void {
    const entry = this.entries.get(key);
    if (entry === undefined) return;

    this.entries.delete(key);
    this.bytes -= entry.bytes;
  }

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }

  /** Pour les tests et le diagnostic. Ne pas s'en servir pour decider quoi que ce soit. */
  get stats(): { entries: number; bytes: number } {
    return { entries: this.entries.size, bytes: this.bytes };
  }
}
