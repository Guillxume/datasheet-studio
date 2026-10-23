import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_BOOK_DATASHEETS, bookSpecSchema, imagePageHtml, missingPageHtml } from "./book";

const ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const base = { boutique: "acme-prod", sections: [{ divider: ID, fiches: ["fr:901"] }] };
const ok = (spec: unknown) => bookSpecSchema.safeParse(spec).success;

test("une demande minimale est acceptee, avec ou sans intercalaire", () => {
  assert.equal(ok(base), true);
  assert.equal(ok({ ...base, sections: [{ divider: null, fiches: ["fr:901"] }] }), true);
});

test("un intercalaire se designe par son identifiant, rien d'autre", () => {
  assert.equal(ok({ ...base, sections: [{ divider: "Bureaux", fiches: ["fr:1"] }] }), false);
});

test("une section vide, un intercalaire en double ou trop de fiches sont refuses", () => {
  assert.equal(ok({ ...base, sections: [{ divider: ID, fiches: [] }] }), false);
  assert.equal(ok({ ...base, sections: [{ divider: ID, fiches: ["fr:1"] }, { divider: ID, fiches: ["fr:2"] }] }), false);
  const trop = Array.from({ length: MAX_BOOK_DATASHEETS + 1 }, (_, i) => `fr:${i}`);
  assert.equal(ok({ ...base, sections: [{ divider: null, fiches: trop }] }), false);
});

test("une page dessinee n'accepte qu'une image deja integree (data:), jamais une adresse", () => {
  assert.match(imagePageHtml("data:image/jpeg;base64,AAAA"), /src="data:image\/jpeg;base64,AAAA"/);
  // Chromium irait chercher une adresse sur le reseau du Studio.
  assert.doesNotMatch(imagePageHtml("http://169.254.169.254/latest"), /169\.254/);
});

test("le nom d'une fiche indisponible est echappe", () => {
  const html = missingPageHtml({ name: '<script>alert("x")</script>', reason: "HTTP 404", color: "#000000" });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("une couleur invalide ne passe jamais dans le CSS", () => {
  const html = missingPageHtml({ name: "A", reason: "x", color: "red;}</style><script>" });
  assert.doesNotMatch(html, /<script>/);
});
