import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ICON, iconMarkup, isIconRef, lucideSvg, searchIcons } from "./icons";

test("un mot francais trouve les icones anglaises correspondantes", () => {
  assert.ok(searchIcons("chaise").includes("armchair"));
  assert.ok(searchIcons("Fauteuil").includes("armchair"));
  assert.ok(searchIcons("entrepôt").includes("warehouse"));
});

test("le nom passe avant les mots-cles", () => {
  const found = searchIcons("chair");
  assert.equal(found[0].includes("chair"), true);
});

test("seules les references affichables sont acceptees", () => {
  assert.equal(isIconRef("lucide:folder"), true);
  assert.equal(isIconRef("/assets/shared/picto-garantie-5-ans"), true);
  assert.equal(isIconRef("lucide:icone-qui-n-existe-pas"), false);
  assert.equal(isIconRef("lucide:__proto__"), false);
  assert.equal(isIconRef("javascript:alert(1)"), false);
  assert.equal(isIconRef("/assets/../../etc/passwd"), false);
  assert.equal(isIconRef("/assets/../secret"), false);
  assert.equal(isIconRef("/assets/shared/.."), false);
  assert.equal(isIconRef("https://exemple.fr/icone.png"), false);
});

test("le SVG est complet, et une couleur saisie ne peut pas sortir de son attribut", () => {
  const svg = lucideSvg("folder", { color: '"><script>alert(1)</script>' });
  assert.match(svg, /^<svg [^>]*viewBox="0 0 24 24"/);
  assert.match(svg, /<path d="/);
  assert.doesNotMatch(svg, /<script>/);
  assert.equal(lucideSvg("inexistante"), "");
});

test("une reference absente ou invalide retombe sur l'icone par defaut", () => {
  assert.equal(iconMarkup(undefined).ref, DEFAULT_ICON);
  assert.equal(iconMarkup("n'importe quoi").ref, DEFAULT_ICON);
  assert.ok(iconMarkup("lucide:armchair").svg?.startsWith("<svg"));
  assert.deepEqual(iconMarkup("/assets/acme-prod/picto"), { ref: "/assets/acme-prod/picto", svg: null, src: "/assets/acme-prod/picto" });
});
