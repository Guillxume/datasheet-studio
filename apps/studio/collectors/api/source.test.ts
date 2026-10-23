import { test } from "node:test";
import assert from "node:assert/strict";
import { assemblePayload } from "../core/payload";
import type { CollectedProduct } from "../core/types";
import { apiConfigSchema, loadApiConfig } from "./config";
import { ApiSource } from "./source";

/**
 * Le collecteur d'API est declaratif : sa configuration EST son code. Ce qui
 * s'eprouve ici, c'est donc la semantique de la table de correspondance — et en
 * particulier le point ou une implementation evidente se trompe sans bruit :
 * deux listes paralleles dont l'une a un trou.
 */

type Route = (url: URL) => unknown;

function serve(routes: Record<string, Route>) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);
    const route = routes[url.pathname];
    if (!route) return new Response("introuvable", { status: 404 });
    return new Response(JSON.stringify(route(url)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const config = (over: Record<string, unknown>) =>
  apiConfigSchema.parse({
    base_url: "https://pim.exemple.fr/api",
    list: { path: "/produits", items: "data" },
    ref: "reference",
    map: { "product.name": "libelle", "product.sku": "reference" },
    ...over,
  });

async function collect(source: ApiSource): Promise<CollectedProduct[]> {
  const products: CollectedProduct[] = [];
  for await (const product of source.list()) products.push(product);
  return products;
}

test("la table se lit CIBLE <- SOURCE et produit un payload valide", async () => {
  const { fetchImpl } = serve({
    "/api/produits": () => ({
      data: [
        {
          reference: "TPM-2500",
          libelle: "Transpalette 2500 kg",
          marque: { nom: "Liftmax" },
          familles: [{ libelle: "Manutention" }, { libelle: "Transpalettes" }],
          tarifs: { public_ht: 48900, devise: "EUR" },
          description: "Ligne une\n\nLigne deux",
          updated_at: "2026-08-01T10:00:00Z",
        },
      ],
    }),
  });

  const source = new ApiSource(
    config({
      fingerprint: "updated_at",
      map: {
        "product.name": "libelle",
        "product.sku": "reference",
        "product.brand": "marque.nom",
        "product.category_path": "familles[].libelle",
        "product.price.amount": "tarifs.public_ht | minor",
        "product.price.currency": "tarifs.devise",
        "product.description_html": "description | nl2html",
      },
    }),
    fetchImpl
  );

  const [product] = await collect(source);
  assert.equal(product.ref, "TPM-2500");
  assert.equal(product.fingerprint, "2026-08-01T10:00:00Z");
  assert.deepEqual(product.data.product.category_path, ["Manutention", "Transpalettes"]);
  assert.equal(product.data.product.price?.amount, "489.00");
  assert.equal(product.data.product.description_html, "<p>Ligne une</p><p>Ligne deux</p>");

  assert.doesNotThrow(() =>
    assemblePayload({ product, template: "fiche", locale: "fr", shop: { name: "B" } })
  );
});

test("deux listes paralleles restent alignees quand l'une a un trou", async () => {
  const { fetchImpl } = serve({
    "/api/produits": () => ({
      data: [
        {
          reference: "A",
          libelle: "Produit",
          medias: [{ url: "a.jpg" }, { url: "b.jpg", legende: "Detail" }],
        },
      ],
    }),
  });

  const source = new ApiSource(
    config({
      map: {
        "product.name": "libelle",
        "images[].src": "medias[].url",
        "images[].legend": "medias[].legende",
      },
    }),
    fetchImpl
  );

  const [product] = await collect(source);
  // Le piege : filtrer les valeurs absentes avant d'apparier collerait
  // « Detail » sur la premiere image. Rien ne le signalerait.
  assert.deepEqual(product.data.images, [
    { src: "a.jpg" },
    { src: "b.jpg", legend: "Detail" },
  ]);
});

test("une liste dont il manque un element ne laisse pas de trou dans le payload", async () => {
  const { fetchImpl } = serve({
    "/api/produits": () => ({
      data: [
        {
          reference: "A",
          libelle: "Produit",
          medias: [{ legende: "Sans image" }, { url: "b.jpg" }],
        },
      ],
    }),
  });

  const source = new ApiSource(
    config({
      map: { "product.name": "libelle", "images[].src": "medias[].url", "images[].legend": "medias[].legende" },
    }),
    fetchImpl
  );

  const [product] = await collect(source);
  assert.deepEqual(product.data.images, [{ src: "b.jpg" }]);
});

test("la pagination par page s'arrete sur le total annonce", async () => {
  const { fetchImpl, calls } = serve({
    "/api/produits": (url) => {
      const page = Number(url.searchParams.get("page"));
      return {
        data: Array.from({ length: 2 }, (_, i) => ({
          reference: `P-${page}-${i}`,
          libelle: `Produit ${page}-${i}`,
        })),
        meta: { total: 4 },
      };
    },
  });

  const source = new ApiSource(
    config({
      list: {
        path: "/produits",
        items: "data",
        pagination: { type: "page", size: 2, total: "meta.total" },
      },
    }),
    fetchImpl
  );

  const products = await collect(source);
  assert.equal(products.length, 4);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /page=1/);
  assert.match(calls[1], /page=2/);
});

test("la pagination par curseur suit le champ next et s'arrete quand il est vide", async () => {
  const pages: Record<string, unknown> = {
    "": { items: [{ id: "1", libelle: "Un" }], next: "c2" },
    c2: { items: [{ id: "2", libelle: "Deux" }], next: null },
  };
  const { fetchImpl } = serve({
    "/api/produits": (url) => pages[url.searchParams.get("cursor") ?? ""],
  });

  const source = new ApiSource(
    config({
      list: {
        path: "/produits",
        items: "items",
        pagination: { type: "cursor", next: "next", size: 1 },
      },
      ref: "id",
      map: { "product.name": "libelle" },
    }),
    fetchImpl
  );

  assert.deepEqual((await collect(source)).map((product) => product.ref), ["1", "2"]);
});

test("le detail complete la liste, qui reste lisible sous _list", async () => {
  const { fetchImpl, calls } = serve({
    "/api/produits": () => ({ data: [{ id: "42", famille: { template_fiche: "fiche-speciale" } }] }),
    "/api/produits/42": () => ({ data: { reference: "TPM", libelle: "Transpalette" } }),
  });

  const source = new ApiSource(
    config({
      detail: { path: "/produits/{id}", id: "id", item: "data" },
      template_from: "_list.famille.template_fiche",
      map: { "product.name": "libelle", "product.sku": "reference" },
    }),
    fetchImpl
  );

  const [product] = await collect(source);
  assert.equal(calls.length, 2);
  assert.equal(product.data.product.name, "Transpalette");
  // Certaines API ne servent la famille que dans la liste : la perdre couterait
  // le choix du template.
  assert.equal(product.template, "fiche-speciale");
});

test("le secret vient de l'environnement, jamais du fichier de configuration", async () => {
  const { fetchImpl, calls } = serve({ "/api/produits": () => ({ data: [] }) });
  process.env.TEST_PIM_TOKEN = "jeton-secret";

  const source = new ApiSource(
    config({ auth: { type: "query", param: "api_key", value_env: "TEST_PIM_TOKEN" } }),
    fetchImpl
  );
  await collect(source);
  assert.match(calls[0], /api_key=jeton-secret/);

  const absent = new ApiSource(
    config({ auth: { type: "bearer", token_env: "TEST_ABSENT" } }),
    fetchImpl
  );
  await assert.rejects(() => collect(absent), /TEST_ABSENT/);
  delete process.env.TEST_PIM_TOKEN;
});

test("une configuration fautive echoue au chargement, en nommant le champ", async () => {
  await assert.rejects(
    () => loadApiConfig("collectors/api/source.test.ts"),
    /configuration illisible/
  );

  const parsed = apiConfigSchema.safeParse({ list: { path: "/x" }, map: {} });
  assert.equal(parsed.success, false);
});

test("la configuration d'exemple est valide", async () => {
  const exemple = await loadApiConfig("collectors/api/exemple.config.json");
  assert.equal(exemple.name, "pim-interne");
  assert.equal(exemple.list.pagination.type, "page");
  assert.ok(Object.keys(exemple.map).length > 10);
});
