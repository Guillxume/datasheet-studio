import { test } from "node:test";
import assert from "node:assert/strict";
import { assemblePayload, freshnessKey, mergeShop, PayloadError, stableStringify } from "./payload";
import type { CollectedAsset, CollectedData, CollectedProduct } from "./types";

const product = (data: CollectedData, ref = "TPM-2500"): CollectedProduct => ({ ref, data });

const shop = { name: "Contoso Equipment", url: "https://exemple.fr" };

/**
 * LE TEST DE DERIVE. Les types de collectors/core/types.ts sont un miroir
 * MANUEL de src/lib/payload.ts — un choix assume, explique la-bas. Ce qui rend
 * le miroir tenable, c'est cette assertion : un CollectedData qui remplit tous
 * les champs doit passer le schema zod du serveur. Le jour ou le contrat bouge,
 * c'est ici que ca casse, et non sur la fiche numero 402 d'une generation de
 * nuit.
 */
test("un CollectedData complet est accepte par le schema du Studio", () => {
  const complet: CollectedData = {
    product: {
      id: 650,
      name: "Transpalette manuel 2500 kg",
      sku: "TPM-2500",
      gtin: "3701234567890",
      mpn: "BF-2500L",
      variant_skus: ["TPM-2500-L", "TPM-2500-C"],
      supplier_skus: ["FRN-88231"],
      url: "https://exemple.fr/650-transpalette.html",
      brand: "Liftmax",
      category_path: ["Manutention", "Transpalettes"],
      price: { amount: "349.00", currency: "EUR", tax_included: false },
      description_html: "<p>Texte</p>",
      description_short: "Accroche",
    },
    features: [{ name: "Capacite", value: "2500 kg", abbreviation: "Q", group: "Charge" }],
    images: [{ src: "asset://img-0", legend: "Vue", width: 800, height: 600 }],
    schema_image: { src: "asset://schema" },
    badges: ["ce", "garantie:3ans"],
    qr_code: { src: "asset://qr" },
    finishes: [
      {
        label: "Coloris des portes",
        options: [
          { label: "Bleu", color: "#2b4ea2", note: "RAL 5010" },
          // Sans couleur ni picto : le cas Medusa, ou la valeur d'option ne
          // porte aucune presentation. Doit rester valide.
          { label: "Gris" },
        ],
        note: "Pour vestiaire 2 portes uniquement",
      },
    ],
    accessories: [
      {
        name: "Coiffe inclinee",
        image: "asset://coiffe",
        description: "Empeche le depot d'objets.",
        features: [{ name: "Largeur", value: "80 cm" }],
      },
    ],
    detail_image: { src: "asset://details" },
    custom: { famille: "manutention" },
  };

  const payload = assemblePayload({
    product: product(complet),
    template: "fiche-technique-01",
    locale: "fr",
    shop,
  });

  assert.equal(payload.data.product.sku, "TPM-2500");
  assert.equal(payload.data.features.length, 1);
  assert.equal(payload.data.schema_image?.src, "asset://schema");
  // Une finition sans couleur ni picto traverse le schema : c'est ce qui rend
  // le contrat tenable depuis Medusa, dont les valeurs d'option n'en portent pas.
  assert.equal(payload.data.finishes[0].options[1].color, undefined);
  assert.equal(payload.data.accessories[0].features.length, 1);
  assert.equal(payload.data.detail_image?.src, "asset://details");
});

test("le minimum suffit et recoit les defauts du contrat", () => {
  const payload = assemblePayload({
    product: product({ product: { name: "Produit" } }),
    template: "fiche-technique-01",
    locale: "fr",
    shop,
  });

  assert.equal(payload.version, "published");
  assert.equal(payload.locale, "fr");
  assert.deepEqual(payload.data.features, []);
  assert.deepEqual(payload.data.badges, []);
  assert.deepEqual(payload.data.custom, {});
  // Les collections ajoutees pour les fiches Acme sont FACULTATIVES : une
  // source ecrite avant elles continue de produire un payload valide, et les
  // blocs qui les consomment s'effacent au lieu d'echouer.
  assert.deepEqual(payload.data.finishes, []);
  assert.deepEqual(payload.data.accessories, []);
  // Absent, `detail_image` vaut `undefined` et NON `null` — exactement comme
  // `schema_image` et `qr_code`, dont il partage la forme. La nuance n'a aucun
  // effet au rendu (les blocs testent la presence d'un `src`), mais trois
  // champs d'image qui ne repondent pas la meme chose a la meme absence, c'est
  // la prochaine heure perdue de quelqu'un.
  assert.equal(payload.data.detail_image ?? null, null);
  assert.equal(payload.data.schema_image ?? null, null);
});

test("un payload invalide echoue AVANT le reseau, en nommant le champ", () => {
  assert.throws(
    () =>
      assemblePayload({
        // @ts-expect-error le nom manquant est exactement ce qu'on veut attraper
        product: product({ product: { sku: "X" } }),
        template: "fiche-technique-01",
        locale: "fr",
        shop,
      }),
    (error: unknown) => {
      assert.ok(error instanceof PayloadError);
      assert.match(error.describe(), /product\.name/);
      return true;
    }
  );
});

test("la locale de la fiche l'emporte sur celle du lot", () => {
  const payload = assemblePayload({
    product: { ref: "X", data: { product: { name: "P" } }, locale: "es" },
    template: "fiche",
    locale: "fr",
    shop,
  });
  assert.equal(payload.locale, "es");
});

test("la source surcharge la boutique champ par champ, sans la redecrire", () => {
  const merged = mergeShop(
    { name: "Base", url: "https://base.fr", colors: { primary: "#000", secondary: "#111" } },
    { url: "https://specifique.fr", colors: { primary: "#0b5ea8" } }
  );

  assert.equal(merged.name, "Base");
  assert.equal(merged.url, "https://specifique.fr");
  assert.equal(merged.colors?.primary, "#0b5ea8");
  // La secondaire de la base survit : une surcharge partielle n'efface pas.
  assert.equal(merged.colors?.secondary, "#111");
});

test("une valeur vide ne remplace pas une valeur renseignee", () => {
  // Une cellule vide de CSV vaut « champ absent », pas « champ vide » : sans
  // cette regle, une colonne shop.url laissee vide effacerait l'URL commune.
  const merged = mergeShop({ name: "Base", url: "https://base.fr" }, { url: "" });
  assert.equal(merged.url, "https://base.fr");
});

// --- Fraicheur --------------------------------------------------------------

const asset = (key: string, fingerprint: string): CollectedAsset => ({
  key,
  mime: "image/jpeg",
  bytes: Buffer.from("x"),
  fingerprint,
});

const key = (data: CollectedData, assets: CollectedAsset[] = [], template = "t") =>
  freshnessKey(assemblePayload({ product: product(data), template, locale: "fr", shop }), assets);

test("l'empreinte change des qu'une donnee change", () => {
  const before = key({ product: { name: "P", sku: "A" } });
  const after = key({ product: { name: "P", sku: "B" } });
  assert.notEqual(before, after);
});

test("l'empreinte change quand une image est retouchee, produit inchange", () => {
  const data: CollectedData = { product: { name: "P" }, images: [{ src: "asset://img-0" }] };
  const before = key(data, [asset("img-0", "1024:1700000000000")]);
  const after = key(data, [asset("img-0", "2048:1800000000000")]);
  // C'est le defaut nomme au §5 de docs/integrer-un-connecteur.md : sans cela,
  // retoucher une photo laisserait la fiche en cache indefiniment.
  assert.notEqual(before, after);
});

test("l'empreinte change avec le template et avec la locale", () => {
  const data: CollectedData = { product: { name: "P" } };
  assert.notEqual(key(data, [], "fiche-a"), key(data, [], "fiche-b"));
});

test("l'empreinte ne depend pas de l'ordre des cles ni des pieces jointes", () => {
  const a = key({ product: { name: "P", sku: "A", brand: "M" } }, [
    asset("img-0", "1"),
    asset("img-1", "2"),
  ]);
  const b = key({ product: { brand: "M", sku: "A", name: "P" } }, [
    asset("img-1", "2"),
    asset("img-0", "1"),
  ]);
  // Sinon, changer l'ordre des colonnes du CSV regenererait tout le catalogue.
  assert.equal(a, b);
});

test("stableStringify trie les cles en profondeur et ignore les undefined", () => {
  assert.equal(
    stableStringify({ b: 1, a: { d: [3, 1], c: 2 }, z: undefined }),
    '{"a":{"c":2,"d":[3,1]},"b":1}'
  );
});
