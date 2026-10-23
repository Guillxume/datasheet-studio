import { test } from "node:test";
import assert from "node:assert/strict";
import { assemblePayload } from "../core/payload";
import type { CollectedProduct } from "../core/types";
import { MedusaSource, type MedusaSourceOptions } from "./source";

/**
 * Le mapping Medusa -> contrat du Studio. Le contrat a ete ecrit en pensant a
 * ce cas (variant.sku -> sku, variant.barcode -> gtin), donc rien n'est a
 * inventer : ce qui merite d'etre eprouve, c'est ce que le mapping doit
 * RECONSTRUIRE — le fil d'ariane a partir d'un arbre plat, une description
 * texte qui part dans un champ *_html, et un prix qui doit rester une chaine a
 * separateur point.
 */

const CATEGORIES = {
  product_categories: [
    { id: "cat_1", name: "Manutention", parent_category_id: null },
    { id: "cat_2", name: "Transpalettes", parent_category_id: "cat_1" },
  ],
};

const PRODUIT = {
  id: "prod_01",
  title: "Transpalette manuel 2500 kg",
  subtitle: "Fourches longues",
  handle: "transpalette-2500",
  description: "Chassis mecano-soude.\n\nPompe hydraulique trois positions.",
  thumbnail: "https://cdn.exemple.fr/vignette.jpg",
  status: "published",
  updated_at: "2026-08-01T10:00:00Z",
  metadata: { mpn: "BF-2500L", norme: "EN ISO 3691-5", fiche: { interne: true } },
  images: [
    { id: "img_2", url: "https://cdn.exemple.fr/b.jpg", rank: 1 },
    { id: "img_1", url: "https://cdn.exemple.fr/a.jpg", rank: 0 },
  ],
  options: [{ id: "opt_1", title: "Longueur de fourches" }],
  categories: [{ id: "cat_2", name: "Transpalettes" }],
  collection: { title: "Liftmax" },
  type: { value: "Transpalette" },
  tags: [{ value: "ce" }, { value: "garantie:3ans" }],
  variants: [
    {
      id: "var_1",
      title: "1150 mm",
      sku: "TPM-2500-L",
      barcode: "3701234567890",
      updated_at: "2026-08-02T09:00:00Z",
      options: [{ option_id: "opt_1", value: "1150 mm" }],
      prices: [
        { amount: 489, currency_code: "eur" },
        { amount: 520, currency_code: "usd" },
      ],
    },
    {
      id: "var_2",
      title: "800 mm",
      sku: "TPM-2500-C",
      updated_at: "2026-08-02T09:00:00Z",
      options: [{ option_id: "opt_1", value: "800 mm" }],
      prices: [{ amount: 449, currency_code: "eur" }],
    },
  ],
};

function serve(products: unknown[] = [PRODUIT]) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);
    const body = url.pathname.endsWith("/product-categories")
      ? CATEGORIES
      : { products, count: products.length, offset: 0, limit: 50 };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const options = (over: Partial<MedusaSourceOptions> = {}): MedusaSourceOptions => ({
  url: "http://localhost:9000",
  mode: "admin",
  secretKey: "sk_test",
  currency: "eur",
  variants: "first",
  priceScale: "decimal",
  brandFrom: "collection",
  brandMetadataKey: "brand",
  featuresFrom: ["options"],
  badgesFromTags: true,
  downloadImages: false,
  pageSize: 50,
  ...over,
});

async function collect(source: MedusaSource): Promise<CollectedProduct[]> {
  const products: CollectedProduct[] = [];
  for await (const product of source.list()) products.push(product);
  return products;
}

test("le mapping remplit le contrat, et le payload passe le schema", async () => {
  const { fetchImpl } = serve();
  const [product] = await collect(new MedusaSource(options({ fetchImpl, storeUrl: "https://boutique.fr" })));

  assert.equal(product.ref, "TPM-2500-L");
  assert.equal(product.data.product.name, "Transpalette manuel 2500 kg");
  assert.equal(product.data.product.sku, "TPM-2500-L");
  assert.equal(product.data.product.gtin, "3701234567890");
  assert.equal(product.data.product.mpn, "BF-2500L");
  // Une fiche pour tout le produit : chaque variante doit la retrouver dans /consultation.
  assert.deepEqual(product.data.product.variant_skus, ["TPM-2500-L", "TPM-2500-C"]);
  assert.equal(product.data.product.brand, "Liftmax");
  assert.equal(product.data.product.url, "https://boutique.fr/products/transpalette-2500");
  assert.equal(product.data.product.description_short, "Fourches longues");
  assert.deepEqual(product.data.badges, ["ce", "garantie:3ans"]);

  assert.doesNotThrow(() =>
    assemblePayload({ product, template: "fiche", locale: "fr", shop: { name: "B" } })
  );
});

test("le fil d'ariane est reconstruit depuis l'arbre des categories", async () => {
  const { fetchImpl, calls } = serve();
  const [product] = await collect(new MedusaSource(options({ fetchImpl })));

  // Le produit ne porte que "Transpalettes" : sans l'arbre, les regles de
  // template par prefixe ["Manutention"] ne pourraient jamais s'appliquer.
  assert.deepEqual(product.data.product.category_path, ["Manutention", "Transpalettes"]);
  assert.match(calls[0], /product-categories/);
});

test("la description texte devient du HTML, sinon les sauts de ligne sont perdus", async () => {
  const { fetchImpl } = serve();
  const [product] = await collect(new MedusaSource(options({ fetchImpl })));
  assert.equal(
    product.data.product.description_html,
    "<p>Chassis mecano-soude.</p><p>Pompe hydraulique trois positions.</p>"
  );
});

test("le prix sort en chaine a separateur point, dans la devise demandee", async () => {
  const { fetchImpl } = serve();
  const [product] = await collect(new MedusaSource(options({ fetchImpl })));

  // Le formatage appartient au Studio : envoyer "489,00 €" produirait un
  // affichage different selon l'origine de l'appel.
  assert.deepEqual(product.data.product.price, { amount: "489.00", currency: "EUR" });
});

test("--price-scale minor rattrape une base qui compte encore en centimes", async () => {
  const { fetchImpl } = serve();
  const [product] = await collect(new MedusaSource(options({ fetchImpl, priceScale: "minor" })));
  assert.equal(product.data.product.price?.amount, "4.89");
});

test("une devise absente se signale au lieu de sortir un prix faux", async () => {
  const { fetchImpl } = serve();
  const [product] = await collect(new MedusaSource(options({ fetchImpl, currency: "gbp" })));
  assert.equal(product.data.product.price, undefined);
  assert.match(String(product.warnings?.join(" ")), /GBP/);
});

test("les images suivent leur rang, vignette en tete si elle manque a la liste", async () => {
  const { fetchImpl } = serve();
  const [product] = await collect(new MedusaSource(options({ fetchImpl })));

  assert.deepEqual(product.data.images, [
    { src: "https://cdn.exemple.fr/vignette.jpg" },
    { src: "https://cdn.exemple.fr/a.jpg" },
    { src: "https://cdn.exemple.fr/b.jpg" },
  ]);
  // Rien n'est joint : Chromium chargera ces URLs au rendu.
  assert.equal(product.assets?.length, 0);
});

test("--variants all rend une fiche par variante, avec des references distinctes", async () => {
  const { fetchImpl } = serve();
  const products = await collect(new MedusaSource(options({ fetchImpl, variants: "all" })));

  assert.equal(products.length, 2);
  assert.deepEqual(
    products.map((product) => product.ref),
    ["TPM-2500-L", "TPM-2500-C"]
  );
  assert.match(products[0].data.product.name, /1150 mm/);
  // Une fiche par variante porte deja sa reference dans `sku` : rien a ajouter,
  // et surtout pas celles des autres variantes, qui y trouveraient la mauvaise fiche.
  assert.equal("variant_skus" in products[0].data.product, false);
  assert.deepEqual(products[0].data.features, [{ name: "Longueur de fourches", value: "1150 mm" }]);
});

test("les metadonnees scalaires peuvent devenir des caracteristiques, les objets non", async () => {
  const { fetchImpl } = serve();
  const [product] = await collect(
    new MedusaSource(options({ fetchImpl, featuresFrom: ["options", "metadata"] }))
  );

  const names = (product.data.features ?? []).map((feature) => feature.name);
  assert.ok(names.includes("norme"));
  // `fiche` est un objet : il sortirait en "[object Object]" dans un tableau.
  assert.equal(names.includes("fiche"), false);
});

test("l'empreinte suit les updated_at, deja tenus par Medusa", async () => {
  const { fetchImpl } = serve();
  const [product] = await collect(new MedusaSource(options({ fetchImpl })));
  assert.equal(product.fingerprint, "2026-08-01T10:00:00Z|2026-08-02T09:00:00Z");
});

test("un produit sans variante donne quand meme une fiche", async () => {
  const { fetchImpl } = serve([{ ...PRODUIT, variants: [] }]);
  const [product] = await collect(new MedusaSource(options({ fetchImpl })));

  assert.equal(product.ref, "transpalette-2500");
  assert.equal(product.data.product.sku, null);
  assert.deepEqual(product.data.product.variant_skus, []);
});

test("la cle d'administration part en Basic, avec repli base64 sur un 401", async () => {
  const seen: string[] = [];
  let refuse = true;
  const fetchImpl = (async (input: string | URL, init: RequestInit = {}) => {
    seen.push(String((init.headers as Record<string, string>).authorization));
    const url = new URL(String(input));
    if (refuse && !url.pathname.endsWith("/product-categories")) {
      refuse = false;
      return new Response("{}", { status: 401 });
    }
    const body = url.pathname.endsWith("/product-categories")
      ? CATEGORIES
      : { products: [PRODUIT], count: 1 };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const products = await collect(new MedusaSource(options({ fetchImpl })));

  // La forme documentee en v2 est envoyee d'abord ; le base64 n'est qu'un
  // repli, et le collecteur le DIT plutot que de laisser deviner un 401.
  assert.equal(seen[0], "Basic sk_test");
  assert.equal(seen.at(-1), `Basic ${Buffer.from("sk_test").toString("base64")}`);
  assert.equal(products.length, 1);
  assert.match(String(products[0].warnings?.join(" ")), /base64/);
});

test("le mode store exige une cle publiable et lit le prix calcule", async () => {
  const calculated = {
    ...PRODUIT,
    variants: [
      {
        ...PRODUIT.variants[0],
        prices: undefined,
        calculated_price: {
          calculated_amount: 586.8,
          currency_code: "eur",
          is_calculated_price_tax_inclusive: true,
        },
      },
    ],
  };
  const { fetchImpl, calls } = serve([calculated]);

  const [product] = await collect(
    new MedusaSource(
      options({ fetchImpl, mode: "store", publishableKey: "pk_test", regionId: "reg_1" })
    )
  );

  assert.match(calls[1], /region_id=reg_1/);
  assert.deepEqual(product.data.product.price, {
    amount: "586.80",
    currency: "EUR",
    tax_included: true,
  });
});
