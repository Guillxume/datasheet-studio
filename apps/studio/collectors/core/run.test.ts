import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StudioClient } from "./client";
import { Journal } from "./journal";
import { outputName, run, type RunReport } from "./run";
import { TemplateResolver, templateRulesSchema } from "./templateRules";
import type { CollectedProduct, Source } from "./types";
import type { CommonOptions } from "./cli";

/**
 * Le lot est ce que l'integrateur lancera toutes les nuits sur des milliers de
 * references. Les quatre proprietes eprouvees ici sont celles dont l'absence ne
 * se voit qu'en production : ne pas refaire ce qui est bon, s'arreter sur le
 * budget sans rien perdre, isoler une reference cassee, et s'arreter net quand
 * la cle est invalide plutot que d'ecrire quatre mille lignes d'echec.
 */

const products = (count: number): CollectedProduct[] =>
  Array.from({ length: count }, (_, index) => ({
    ref: `REF-${index}`,
    data: { product: { name: `Produit ${index}`, category_path: ["Manutention"] } },
  }));

function source(items: CollectedProduct[]): Source & { served: number } {
  const state = {
    name: "source de test",
    served: 0,
    async *list() {
      for (const item of items) {
        state.served += 1;
        yield item;
      }
    },
  };
  return state;
}

type Scenario = {
  render?: (payload: unknown, attempt: number) => Response;
  publishedVersion?: number;
};

function studio(scenario: Scenario = {}) {
  const renders: unknown[] = [];
  let attempt = 0;

  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    const target = String(url);
    if (target.endsWith("/api/v1/templates")) {
      return new Response(
        JSON.stringify({
          templates: [
            { slug: "fiche", published_version: scenario.publishedVersion ?? 1, selectable: true },
            { slug: "fiche-manutention", published_version: 2, selectable: true },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    attempt += 1;
    const payload = JSON.parse(String(init.body));
    renders.push(payload);
    return (
      scenario.render?.(payload, attempt) ??
      new Response(new Uint8Array(Buffer.from("%PDF-1.4")), {
        status: 200,
        headers: { "content-type": "application/pdf", "x-template-version": String(scenario.publishedVersion ?? 1) },
      })
    );
  }) as unknown as typeof fetch;

  return {
    renders,
    client: new StudioClient({
      url: "https://studio.exemple.fr",
      key: "sk_test",
      retries: 0,
      fetchImpl,
      waitImpl: async () => {},
    }),
  };
}

function options(dir: string, over: Partial<CommonOptions> = {}): CommonOptions {
  return {
    studioUrl: "https://studio.exemple.fr",
    studioKey: "sk_test",
    template: "fiche",
    locale: "fr",
    outDir: join(dir, "pdf"),
    statePath: join(dir, "journal.jsonl"),
    budgetMs: null,
    limit: null,
    concurrency: 2,
    maxAttempts: 3,
    pinVersion: "published",
    force: false,
    retryFailed: false,
    forget: [],
    dryRun: false,
    preview: 0,
    quiet: true,
    ...over,
  };
}

const resolver = (fallback = "fiche") =>
  new TemplateResolver(templateRulesSchema.parse({ rules: [] }), fallback);

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "collect-run-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const launch = async (
  dir: string,
  items: CollectedProduct[],
  over: Partial<CommonOptions> = {},
  scenario: Scenario = {}
): Promise<{ report: RunReport; renders: unknown[] }> => {
  const { client, renders } = studio(scenario);
  const report = await run({
    source: source(items),
    client,
    journal: await Journal.open(join(dir, "journal.jsonl")),
    resolver: resolver(over.template ?? "fiche"),
    options: options(dir, over),
    shop: { name: "Boutique de test" },
  });
  return { report, renders };
};

test("rend les fiches absentes et ecrit un PDF par reference", async () => {
  await withDir(async (dir) => {
    const { report } = await launch(dir, products(3));

    assert.equal(report.rendered, 3);
    assert.equal(report.echecs, 0);
    assert.equal(report.stopped_by, "source-epuisee");
    assert.deepEqual((await readdir(join(dir, "pdf"))).sort(), [
      "REF-0-fr.pdf",
      "REF-1-fr.pdf",
      "REF-2-fr.pdf",
    ]);
  });
});

test("un second passage ne refait rien : c'est tout l'interet du journal", async () => {
  await withDir(async (dir) => {
    await launch(dir, products(3));
    const { report, renders } = await launch(dir, products(3));

    assert.equal(report.a_jour, 3);
    assert.equal(report.rendered, 0);
    assert.equal(renders.length, 0);
  });
});

test("--force refait tout, meme ce qui est a jour", async () => {
  await withDir(async (dir) => {
    await launch(dir, products(2));
    const { report } = await launch(dir, products(2), { force: true });
    assert.equal(report.rendered, 2);
  });
});

test("une donnee modifiee fait repasser la fiche, les autres non", async () => {
  await withDir(async (dir) => {
    await launch(dir, products(3));

    const modifies = products(3);
    modifies[1].data.product.name = "Produit 1 renomme";
    const { report } = await launch(dir, modifies);

    assert.equal(report.rendered, 1);
    assert.equal(report.a_jour, 2);
  });
});

test("un template republie perime les fiches, empreinte identique", async () => {
  await withDir(async (dir) => {
    await launch(dir, products(2), {}, { publishedVersion: 1 });
    // Rien n'a change cote donnees : seule la version publiee a bouge.
    const { report } = await launch(dir, products(2), {}, { publishedVersion: 2 });
    assert.equal(report.rendered, 2);
    assert.equal(report.a_jour, 0);
  });
});

test("le budget arrete le lot, et la reprise continue ou il s'est arrete", async () => {
  await withDir(async (dir) => {
    const first = await launch(dir, products(6), {
      concurrency: 1,
      budgetMs: 1,
      limit: null,
    });
    // Le budget est verifie AVANT de tirer le produit suivant : une fiche au
    // moins passe, et le lot s'arrete sans rien perdre.
    assert.equal(first.report.stopped_by, "budget");
    assert.ok(first.report.rendered < 6);

    const second = await launch(dir, products(6));
    assert.equal(second.report.rendered + first.report.rendered, 6);
  });
});

test("--limit borne le nombre de rendus d'un lot", async () => {
  await withDir(async (dir) => {
    const { report } = await launch(dir, products(10), { limit: 2, concurrency: 1 });
    assert.equal(report.rendered, 2);
    assert.equal(report.stopped_by, "limite");
  });
});

test("--limit reste exact SOUS CONCURRENCE, et c'est le cas qui debordait", async () => {
  for (const concurrency of [2, 4, 8]) {
    await withDir(async (dir) => {
      const { report, renders } = await launch(dir, products(50), { limit: 3, concurrency });
      // Compter les rendus TERMINES laissait passer autant de rendus en vol :
      // mesure sur un catalogue reel, --limit 3 en produisait 4.
      assert.equal(report.rendered, 3, `concurrence ${concurrency}`);
      assert.equal(renders.length, 3, `concurrence ${concurrency}`);
    });
  }
});

test("une reference cassee n'empeche pas les autres et part en quarantaine", async () => {
  await withDir(async (dir) => {
    const casse = (payload: unknown): Response => {
      const name = (payload as { data: { product: { name: string } } }).data.product.name;
      return name === "Produit 1"
        ? new Response(JSON.stringify({ error: "Chromium a lache" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          })
        : new Response(new Uint8Array(Buffer.from("%PDF")), {
            status: 200,
            headers: { "content-type": "application/pdf", "x-template-version": "1" },
          });
    };

    for (let pass = 0; pass < 3; pass += 1) {
      const { report } = await launch(dir, products(3), {}, { render: casse });
      assert.equal(report.echecs, 1);
      assert.equal(report.en_quarantaine, 0);
    }

    // Au quatrieme passage, la reference est ecartee : elle ne consomme plus le
    // budget des milliers d'autres.
    const { report } = await launch(dir, products(3), {}, { render: casse });
    assert.equal(report.en_quarantaine, 1);
    assert.equal(report.echecs, 0);

    const leve = await launch(dir, products(3), { retryFailed: false, force: false }, { render: casse });
    assert.equal(leve.report.en_quarantaine, 1);
  });
});

test("une cle invalide arrete le lot au lieu d'echouer mille fois", async () => {
  await withDir(async (dir) => {
    const { report } = await launch(
      dir,
      products(50),
      { concurrency: 1 },
      {
        render: () =>
          new Response(JSON.stringify({ error: "Cle API absente ou invalide" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          }),
      }
    );

    assert.equal(report.stopped_by, "erreur-bloquante");
    assert.ok(report.echecs < 5);
    assert.match(JSON.stringify(report.failures), /401/);
  });
});

test("une fiche sans template est signalee, pas rendue au hasard", async () => {
  await withDir(async (dir) => {
    const { client } = studio();
    const report = await run({
      source: source(products(2)),
      client,
      journal: await Journal.open(join(dir, "journal.jsonl")),
      resolver: new TemplateResolver(templateRulesSchema.parse({ rules: [] })),
      options: options(dir, { template: undefined }),
      shop: { name: "Boutique" },
    });

    assert.equal(report.sans_template, 2);
    assert.equal(report.rendered, 0);
  });
});

test("un template inconnu du Studio fait echouer le lot au demarrage", async () => {
  await withDir(async (dir) => {
    const { client } = studio();
    const journal = await Journal.open(join(dir, "journal.jsonl"));
    await assert.rejects(
      () =>
        run({
          source: source(products(1)),
          client,
          journal,
          resolver: resolver("fiche-inexistante"),
          options: options(dir, { template: "fiche-inexistante" }),
          shop: { name: "Boutique" },
        }),
      // Sans cette verification, la faute de frappe se paierait en 404 sur
      // chaque produit du catalogue.
      /fiche-inexistante/
    );
  });
});

test("--dry-run valide les payloads sans rien envoyer", async () => {
  await withDir(async (dir) => {
    const { report, renders } = await launch(dir, products(3), { dryRun: true });
    assert.equal(renders.length, 0);
    assert.equal(report.rendered, 3);

    // Rien n'est ecrit au journal : le lot reel qui suit fait bien le travail.
    const reel = await launch(dir, products(3));
    assert.equal(reel.report.rendered, 3);
  });
});

test("le nom de fichier ne laisse pas deux references s'ecraser", () => {
  assert.equal(outputName("TPM-2500", "fr"), "TPM-2500-fr.pdf");
  assert.notEqual(outputName("TPM/2500", "fr"), outputName("TPM-2500", "fr"));
});
