import { test } from "node:test";
import assert from "node:assert/strict";
import { scopeCss } from "./scopeCss";

/**
 * Ce qui est verrouille ici : l'etancheite entre la feuille du TEMPLATE et
 * l'interface de l'editeur.
 *
 * La feuille est ecrite pour un document imprime, ou `body` designe la page.
 * Injectee telle quelle dans l'editeur, une seule regle `body { ... }`
 * repeindrait la barre d'outils et les panneaux. Chaque cas ci-dessous
 * correspond a une facon reelle d'ecrire du CSS qui, mal traitee, ferait fuir
 * une regle hors de la surface de page ou perdrait la regle en silence.
 */

const ROOT = ".ds-page-sheet";

test("une feuille absente ne produit rien", () => {
  assert.equal(scopeCss(null, ROOT), "");
  assert.equal(scopeCss(undefined, ROOT), "");
  assert.equal(scopeCss("", ROOT), "");
});

test("un selecteur ordinaire est confine par descendance", () => {
  assert.equal(scopeCss(".ds-richtext{color:red}", ROOT), ".ds-page-sheet .ds-richtext{color:red}");
});

test("les racines de document sont REMPLACEES, pas prefixees", () => {
  // `.ds-page-sheet body` ne correspondrait a rien : la regle serait perdue
  // sans le moindre message.
  for (const root of [":root", "html", "body"]) {
    assert.equal(scopeCss(`${root}{--x:1}`, ROOT), ".ds-page-sheet{--x:1}");
  }
});

test("une racine de document suivie d'un descendant garde le descendant", () => {
  assert.equal(scopeCss("body .k{color:red}", ROOT), ".ds-page-sheet .k{color:red}");
});

test("chaque selecteur d'une liste est confine separement", () => {
  assert.equal(
    scopeCss("h1, .lead{margin:0}", ROOT),
    ".ds-page-sheet h1, .ds-page-sheet .lead{margin:0}"
  );
});

test("une virgule dans :is() ou un attribut ne coupe pas la liste", () => {
  assert.equal(
    scopeCss(':is(h1, h2){margin:0}', ROOT),
    ".ds-page-sheet :is(h1, h2){margin:0}"
  );
  assert.equal(
    scopeCss('[data-x="a,b"]{margin:0}', ROOT),
    '.ds-page-sheet [data-x="a,b"]{margin:0}'
  );
});

test("@font-face reste global : le confiner n'a pas de sens et le CSS l'interdit", () => {
  const css = '@font-face{font-family:"Jost";src:url("/assets/shared/jost-400")}';
  assert.equal(scopeCss(css, ROOT), css);
});

test("@keyframes reste global", () => {
  const css = "@keyframes spin{to{transform:rotate(360deg)}}";
  assert.equal(scopeCss(css, ROOT), css);
});

test("@import est ecarte de l'apercu : rien ne confinerait la feuille qu'il charge", () => {
  assert.doesNotMatch(scopeCss('@import url("https://evil.example/x.css"); p { color: red }', ROOT), /@import/);
  assert.match(scopeCss('@import url("x.css"); p { color: red }', ROOT), /\.ds-page-sheet p\{ color: red \}/);
});

test("une at-regle inconnue ne peut pas echapper au confinement", () => {
  // @scope selectionne : recopie telle quelle, elle repeignait l'editeur.
  const sortie = scopeCss("@scope (body) { :scope { background: red } } @starting-style { body { opacity: 0 } }", ROOT);
  assert.doesNotMatch(sortie, /@scope|@starting-style|background: red/);
});

test("les at-regles sans selection restent, avec ou sans bloc", () => {
  const sortie = scopeCss('@charset "utf-8"; @layer base, theme; @page { margin: 0 } @property --x { syntax: "*"; inherits: false }', ROOT);
  assert.match(sortie, /@charset/);
  assert.match(sortie, /@layer base, theme;/);
  assert.match(sortie, /@page/);
  assert.match(sortie, /@property --x/);
});

test("le contenu d'un @media est confine, pas le @media lui-meme", () => {
  assert.equal(
    scopeCss("@media print{body{margin:0}}", ROOT),
    "@media print{.ds-page-sheet{margin:0}}"
  );
});

test("le contenu d'un @supports est confine", () => {
  assert.equal(
    scopeCss("@supports (display:grid){.g{display:grid}}", ROOT),
    "@supports (display:grid){.ds-page-sheet .g{display:grid}}"
  );
});

test("une accolade dans une chaine ne casse pas le decoupage", () => {
  // Un decoupage naif fermerait la regle sur cette accolade et tronquerait
  // tout le reste de la feuille — sans erreur visible.
  const css = '.a::before{content:"}"}\n.b{color:red}';
  const out = scopeCss(css, ROOT);
  assert.match(out, /\.ds-page-sheet \.a::before\{content:"\}"\}/);
  assert.match(out, /\.ds-page-sheet \.b\{color:red\}/);
});

test("une accolade dans un commentaire ne casse pas le decoupage", () => {
  const out = scopeCss("/* } */ .b{color:red}", ROOT);
  assert.match(out, /\.ds-page-sheet \.b\{color:red\}/);
});

test("un commentaire en tete ne masque pas la racine de document", () => {
  // Sans retrait des commentaires, le premier mot du selecteur devient `/*`,
  // `body` n'est plus reconnu, et la regle sort en `.ds-page-sheet ... body` —
  // valide mais ne correspondant a rien. Perte silencieuse.
  assert.equal(scopeCss("/* le corps */ body{margin:0}", ROOT), ".ds-page-sheet{margin:0}");
});

test("un commentaire en tete ne masque pas une at-regle", () => {
  assert.equal(
    scopeCss("/* impression */ @media print{body{margin:0}}", ROOT),
    "@media print{.ds-page-sheet{margin:0}}"
  );
});

test("un commentaire entre deux composes reste une combinaison de descendance", () => {
  assert.equal(scopeCss(".a /* x */ .b{color:red}", ROOT), ".ds-page-sheet .a .b{color:red}");
});

test("une feuille realiste de template : tokens + police + regle de document", () => {
  const css = `@font-face {
  font-family: "Jost";
  src: url("/assets/shared/jost-400") format("woff2");
  font-weight: 400;
}
:root {
  --font-body: "Jost", Arial, sans-serif;
  --ds-band: #4a453b;
}
body { font-family: var(--font-body); }
.ds-richtext p { margin: 0 0 2mm; }`;

  const out = scopeCss(css, ROOT);

  // La police reste declarable globalement...
  assert.match(out, /@font-face\s*\{[^}]*Jost/);
  // ...les tokens atterrissent sur la surface de page...
  assert.match(out, /\.ds-page-sheet\s*\{[^}]*--font-body/);
  // ...et AUCUNE regle ne vise encore body ou :root nus, sinon l'interface de
  // l'editeur serait repeinte par la feuille du document.
  assert.doesNotMatch(out.replace(/@font-face\s*\{[^}]*\}/g, ""), /(^|[\s,{])(body|:root|html)\s*[,{]/m);
  assert.match(out, /\.ds-page-sheet \.ds-richtext p/);
});
