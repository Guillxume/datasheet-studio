import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Journal, type JournalEntry } from "./journal";

/**
 * Le journal est ce qui rend une generation en masse reprenable. Ses erreurs ne
 * se voient pas tout de suite : elles se voient le jour ou l'on relance apres
 * une coupure et ou tout le catalogue repart a zero, ou pire, le jour ou un
 * template republie ne repasse jamais parce que la fiche est jugee « a jour ».
 */

async function withJournal(run: (journal: Journal, path: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "collect-journal-"));
  const path = join(dir, "journal.jsonl");
  try {
    await run(await Journal.open(path), path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  ref: "TPM-2500",
  fingerprint: "abc",
  template: "fiche-technique-01",
  version: 3,
  locale: "fr",
  output: "pdf/TPM-2500-fr.pdf",
  bytes: 1024,
  rendered_at: "2026-08-27T10:00:00.000Z",
  ...over,
});

test("une reference inconnue est a rendre", async () => {
  await withJournal(async (journal) => {
    assert.equal(journal.freshness("X", "abc", 3, 3).state, "absente");
  });
});

test("une fiche identique et un template inchange sont a jour", async () => {
  await withJournal(async (journal) => {
    await journal.succeed(entry());
    assert.equal(journal.freshness("TPM-2500", "abc", 3, 3).state, "a-jour");
  });
});

test("une donnee modifiee perime la fiche", async () => {
  await withJournal(async (journal) => {
    await journal.succeed(entry());
    assert.equal(journal.freshness("TPM-2500", "def", 3, 3).state, "donnees-modifiees");
  });
});

test("une republication de template perime la fiche, empreinte identique", async () => {
  await withJournal(async (journal) => {
    await journal.succeed(entry({ version: 3 }));
    // C'est LE defaut qui manquait a la premiere version du module PrestaShop :
    // rien dans le payload ne change quand une version est publiee.
    const freshness = journal.freshness("TPM-2500", "abc", 4, 3);
    assert.equal(freshness.state, "template-republie");
  });
});

test("une reference qui echoue trois fois passe en quarantaine", async () => {
  await withJournal(async (journal) => {
    await journal.fail("KO-1", 500, "Chromium a lache");
    assert.equal(journal.freshness("KO-1", "abc", 3, 3).state, "absente");
    await journal.fail("KO-1", 500, "Chromium a lache");
    await journal.fail("KO-1", 500, "Chromium a lache");

    const freshness = journal.freshness("KO-1", "abc", 3, 3);
    assert.equal(freshness.state, "en-quarantaine");
    // Sans ce plafond, une fiche impossible a rendre serait resservie a chaque
    // lot et consommerait le budget de temps des milliers d'autres.
    assert.equal(freshness.state === "en-quarantaine" && freshness.failure.attempts, 3);
  });
});

test("un succes remet le compteur d'echecs a zero", async () => {
  await withJournal(async (journal) => {
    await journal.fail("TPM-2500", 502, "reseau");
    await journal.fail("TPM-2500", 502, "reseau");
    await journal.succeed(entry());
    assert.equal(journal.failure("TPM-2500"), undefined);
  });
});

test("--retry-failed leve les quarantaines sans perdre les fiches deja rendues", async () => {
  await withJournal(async (journal) => {
    await journal.succeed(entry({ ref: "OK-1" }));
    await journal.fail("KO-1", 500, "boum");
    await journal.fail("KO-1", 500, "boum");
    await journal.fail("KO-1", 500, "boum");

    assert.equal(await journal.clearFailures(), 1);
    assert.equal(journal.freshness("KO-1", "abc", 3, 3).state, "absente");
    assert.equal(journal.freshness("OK-1", "abc", 3, 3).state, "a-jour");
  });
});

test("l'etat survit a la fermeture : c'est toute la reprise", async () => {
  await withJournal(async (journal, path) => {
    await journal.succeed(entry());
    await journal.fail("KO-1", 500, "boum");

    const reopened = await Journal.open(path);
    assert.equal(reopened.freshness("TPM-2500", "abc", 3, 3).state, "a-jour");
    assert.equal(reopened.failure("KO-1")?.attempts, 1);
  });
});

test("une ligne tronquee par une coupure ne fait pas perdre le journal entier", async () => {
  await withJournal(async (journal, path) => {
    await journal.succeed(entry());
    const { appendFile } = await import("node:fs/promises");
    await appendFile(path, '{"t":"ok","ref":"tron', "utf8");

    const reopened = await Journal.open(path);
    // La reference perdue sera regeneree ; les autres restent connues.
    assert.equal(reopened.freshness("TPM-2500", "abc", 3, 3).state, "a-jour");
  });
});

test("la compaction reecrit l'etat courant sans changer les reponses", async () => {
  await withJournal(async (journal, path) => {
    for (let i = 0; i < 40; i += 1) {
      await journal.succeed(entry({ fingerprint: `v${i}` }));
    }
    const before = (await readFile(path, "utf8")).trim().split("\n").length;
    assert.equal(before, 40);

    assert.equal(await journal.compact(true), true);
    const after = (await readFile(path, "utf8")).trim().split("\n").length;
    assert.equal(after, 1);
    assert.equal(journal.freshness("TPM-2500", "v39", 3, 3).state, "a-jour");

    const reopened = await Journal.open(path);
    assert.equal(reopened.freshness("TPM-2500", "v39", 3, 3).state, "a-jour");
  });
});
