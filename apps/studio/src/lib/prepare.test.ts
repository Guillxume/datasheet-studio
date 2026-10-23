import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareData } from "./prepare";
import type { AssetBag } from "./assets";

const emptyBag: AssetBag = new Map();

const withPrice = (price: unknown, locale = "fr") =>
  prepareData({ product: { name: "P", price } }, emptyBag, "relative", locale).data as {
    product: { price: Record<string, unknown> };
  };

/**
 * Le formatage du prix vit ici et non cote boutique : Context::getCurrentLocale()
 * de PrestaShop renvoie null en CLI, si bien qu'une fiche generee par le cron
 * afficherait un montant brut quand la meme fiche generee depuis le web
 * afficherait un montant formate. Ces assertions verrouillent l'invariant
 * « meme fiche, meme rendu, quelle que soit l'origine de la demande ».
 */

test("formate le prix selon la locale et la devise du payload", () => {
  const fr = withPrice({ amount: "349.00", currency: "EUR" }, "fr");
  // Espace insecable et virgule decimale : on verifie la substance, pas l'octet exact.
  assert.match(String(fr.product.price.formatted), /349,00/);
  assert.match(String(fr.product.price.formatted), /€/);

  const en = withPrice({ amount: "349.00", currency: "USD" }, "en");
  assert.match(String(en.product.price.formatted), /349\.00/);
  assert.match(String(en.product.price.formatted), /\$/);
});

test("conserve le montant brut intact", () => {
  const result = withPrice({ amount: "1234.50", currency: "EUR" });
  assert.equal(result.product.price.amount, "1234.50");
});

test("formate sans devise quand elle est absente", () => {
  const result = withPrice({ amount: "1234.50" });
  assert.match(String(result.product.price.formatted), /1[\s  ]?234,50/);
});

test("tolere une devise inconnue sans faire echouer la fiche", () => {
  const result = withPrice({ amount: "10.00", currency: "ZZZ" });
  assert.ok(typeof result.product.price.formatted === "string");
  assert.match(String(result.product.price.formatted), /10/);
});

test("ignore un prix absent ou non numerique", () => {
  assert.equal((withPrice(undefined) as { product: { price?: unknown } }).product.price, undefined);
  assert.equal(withPrice({ amount: "" }).product.price.formatted, undefined);
  assert.equal(withPrice({ amount: "abc" }).product.price.formatted, undefined);
});

test("assainit le HTML et signale les assets manquants dans le meme passage", () => {
  const result = prepareData(
    {
      product: {
        description_html: "<p>ok</p><script>alert(1)</script>",
        price: { amount: "5.00", currency: "EUR" },
      },
      images: [{ src: "asset://absent" }],
    },
    emptyBag,
    "relative",
    "fr"
  );

  const data = result.data as {
    product: { description_html: string; price: Record<string, unknown> };
    images: { src: string }[];
  };

  assert.doesNotMatch(data.product.description_html, /<script/i);
  assert.match(data.product.description_html, /<p>ok<\/p>/);
  assert.equal(data.images[0].src, "");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /images\[0\]\.src/);
  // Le formatage doit rester applique meme en presence d'avertissements.
  assert.match(String(data.product.price.formatted), /5,00/);
});
