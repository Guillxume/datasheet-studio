import { test } from "node:test";
import assert from "node:assert/strict";
import { collectCssAssetRefs, inlineCssAssets } from "./cssAssets";

/**
 * Ce qui est verrouille ici : la typographie d'un document imprime.
 *
 * Un @font-face ecrit dans la feuille du template ne chargeait rien — la feuille
 * etait injectee sans que ses url(/assets/...) soient reecrites, et le Chromium de
 * Gotenberg n'a aucune route reseau vers l'application. Toute fiche sortait en
 * Arial, sans message d'erreur. Ces tests garantissent que la reecriture a lieu,
 * et surtout qu'un asset manquant ne casse PAS la regle qui le contient.
 */

const ASSETS = new Map([
  ["/assets/shared/inter-regular", "data:font/woff2;base64,QUJD"],
  ["/assets/shared/fond-bandeau", "data:image/png;base64,REVG"],
]);

test("une feuille absente reste absente", () => {
  assert.equal(inlineCssAssets(null, ASSETS), null);
  assert.equal(inlineCssAssets(undefined, ASSETS), null);
  assert.equal(inlineCssAssets("", ASSETS), null);
});

test("une feuille sans reference de bibliotheque n'est pas touchee", () => {
  const css = `.ds-richtext { color: #333; background: url("https://exemple.test/f.png"); }`;
  assert.equal(inlineCssAssets(css, ASSETS), css);
});

test("les trois ecritures de url() sont reecrites", () => {
  // Les guillemets sont optionnels en CSS : les trois formes existent dans du
  // CSS ecrit a la main, et une seule prise en charge laisserait un @font-face
  // silencieusement mort.
  for (const written of [
    `url(/assets/shared/inter-regular)`,
    `url('/assets/shared/inter-regular')`,
    `url("/assets/shared/inter-regular")`,
  ]) {
    const out = inlineCssAssets(`@font-face { src: ${written}; }`, ASSETS);
    assert.equal(out, `@font-face { src: url("data:font/woff2;base64,QUJD"); }`, written);
  }
});

test("un @font-face complet devient autonome", () => {
  const css = `@font-face {
  font-family: "Inter";
  src: url("/assets/shared/inter-regular") format("woff2");
  font-weight: 400;
}
:root { --font-body: "Inter", Arial, sans-serif; }`;

  const out = inlineCssAssets(css, ASSETS) ?? "";
  assert.match(out, /url\("data:font\/woff2;base64,QUJD"\)/);
  assert.doesNotMatch(out, /\/assets\//, "plus aucune reference a resoudre par le reseau");
  assert.match(out, /--font-body: "Inter"/, "le reste de la feuille est preserve");
});

test("un asset introuvable laisse la declaration intacte, sans casser la regle", () => {
  // Une url() videe produirait `src: ;` — declaration invalide, qui peut
  // invalider la regle entiere et donc supprimer AUSSI les sources valides.
  const css = `@font-face { src: url("/assets/shared/absente") format("woff2"); }`;
  assert.equal(inlineCssAssets(css, ASSETS), css);
});

test("plusieurs references dans la meme feuille sont toutes traitees", () => {
  const css = `@font-face { src: url(/assets/shared/inter-regular); }
.bandeau { background-image: url(/assets/shared/fond-bandeau); }`;

  const out = inlineCssAssets(css, ASSETS) ?? "";
  assert.match(out, /data:font\/woff2/);
  assert.match(out, /data:image\/png/);
});

test("la collecte ne retient que les references de forme valide", () => {
  const found = new Set<string>();
  collectCssAssetRefs(
    `a { background: url(/assets/shared/fond-bandeau); }
     b { background: url(/assets/incomplet); }
     c { background: url(/assets/a/b/c); }
     d { background: url(https://exemple.test/x.png); }`,
    found
  );

  // Seule /assets/<scope>/<cle> peut etre demandee a la base : les autres formes
  // provoqueraient une lecture vouee a l'echec.
  assert.deepEqual([...found], ["/assets/shared/fond-bandeau"]);
});

test("la collecte sur une feuille absente ne jette pas", () => {
  const found = new Set<string>();
  collectCssAssetRefs(null, found);
  collectCssAssetRefs(undefined, found);
  assert.equal(found.size, 0);
});
