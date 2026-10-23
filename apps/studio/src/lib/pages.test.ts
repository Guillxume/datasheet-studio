import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONVERTED_PAGE_ID,
  PAGE_BLOCK,
  bodyHasPages,
  normalizeBodyTree,
  pageWillPrint,
} from "./pages";
import { PRINT_ELEMENT_CSS } from "./printCss";

/**
 * Pages explicites du corps.
 *
 * CE QUE CES CAS PROTEGENT. La conversion touche des modeles DEJA composes : une
 * erreur ici ne casse pas un rendu, elle range du contenu la ou personne ne le
 * retrouvera. Et comme la conversion a lieu aussi au rendu, une divergence entre
 * les deux ferait sortir un PDF different de ce que le studio montre.
 *
 * La regle de retrait et d'espacement est appliquee par la PAGE et plus par la
 * racine : un corps qui garderait des blocs libres a cote de pages les verrait
 * appliques deux fois pour les uns et pas du tout pour les autres. D'ou
 * l'insistance sur le cas mixte.
 */

const bloc = (id: string) => ({ type: "Text", props: { id, content: "x" } });

const page = (contenu: unknown[]) => ({
  type: PAGE_BLOCK,
  props: { id: "Page-x", content: contenu, mode: "always", onlyIf: "" },
});

test("un corps sans page n'a pas de page", () => {
  assert.equal(bodyHasPages({ content: [bloc("a"), bloc("b")] }), false);
});

test("un corps vide n'a pas de page non plus", () => {
  assert.equal(bodyHasPages({ content: [] }), false);
  assert.equal(bodyHasPages(undefined), false);
});

test("un corps fait de pages en a", () => {
  assert.equal(bodyHasPages({ content: [page([]), page([bloc("a")])] }), true);
});

test("un corps MIXTE n'est pas considere comme pagine", () => {
  // Sinon la conversion le laisserait tel quel, et les blocs libres n'auraient
  // ni retrait ni espacement — la racine ne les applique plus.
  assert.equal(bodyHasPages({ content: [page([]), bloc("a")] }), false);
});

test("conversion : les blocs libres deviennent le contenu de la page 1", () => {
  const converti = normalizeBodyTree({
    root: { props: { pageWidth: 210, padding: 8 } },
    content: [bloc("a"), bloc("b")],
  }) as { root?: { props?: Record<string, unknown> }; content: { type: string; props: Record<string, unknown> }[] };

  assert.equal(converti.content.length, 1, "une seule page");
  assert.equal(converti.content[0].type, PAGE_BLOCK);
  assert.equal(converti.content[0].props.id, CONVERTED_PAGE_ID);
  assert.deepEqual(converti.content[0].props.content, [bloc("a"), bloc("b")], "aucun bloc perdu");
  assert.equal(converti.content[0].props.mode, "always", "une page convertie s'imprime toujours");
});

test("conversion : la geometrie de la racine est preservee", () => {
  // Elle est lue sur la racine du corps au rendu : la perdre changerait le
  // format de page de tous les modeles convertis.
  const converti = normalizeBodyTree({
    root: { props: { pageWidth: 297, pageHeight: 210, padding: 8 } },
    content: [bloc("a")],
  }) as { root?: { props?: Record<string, unknown> } };

  assert.deepEqual(converti.root?.props, { pageWidth: 297, pageHeight: 210, padding: 8 });
});

test("conversion : un corps vide donne une page vide, pas zero page", () => {
  // Sans page, le studio n'a aucune surface ou deposer un premier bloc.
  const converti = normalizeBodyTree({ root: { props: {} }, content: [] }) as {
    content: { type: string; props: Record<string, unknown> }[];
  };

  assert.equal(converti.content.length, 1);
  assert.deepEqual(converti.content[0].props.content, []);
});

test("conversion : un corps deja pagine est rendu TEL QUEL", () => {
  // Identite de reference, et pas seulement egalite : Puck regenere son store
  // des que l'identite de ses donnees initiales change. Recopier l'arbre a
  // chaque ouverture ferait remonter l'editeur pour rien.
  const arbre = { root: { props: {} }, content: [page([bloc("a")])] };
  assert.equal(normalizeBodyTree(arbre), arbre);
});

test("conversion : un corps mixte est range en une page, sans rien perdre", () => {
  // Un modele bricole a la main. Ignorer les blocs libres les ferait
  // disparaitre en silence ; tout ranger est reversible a la main.
  const converti = normalizeBodyTree({
    content: [page([bloc("a")]), bloc("b")],
  }) as { content: { props: Record<string, unknown> }[] };

  assert.equal(converti.content.length, 1);
  assert.equal((converti.content[0].props.content as unknown[]).length, 2);
});

test("conversion : appliquee deux fois, elle ne cree pas de page dans la page", () => {
  const une = normalizeBodyTree({ content: [bloc("a")] });
  assert.equal(normalizeBodyTree(une), une);
});

/* -------------------------------------------------- Condition d'impression */

test("sans condition, une page s'imprime", () => {
  assert.equal(pageWillPrint("always", ""), true);
  assert.equal(pageWillPrint(undefined, ""), true, "le defaut ne doit pas escamoter la page");
});

test("condition remplie : la page s'imprime", () => {
  assert.equal(pageWillPrint("ifFilled", "Une description longue."), true);
});

test("condition non remplie : la page ne s'imprime pas", () => {
  // Le cas qui justifie toute la fonctionnalite : un meme modele sert des
  // produits avec et sans description longue.
  assert.equal(pageWillPrint("ifFilled", ""), false);
});

test("condition dont le token ne resout rien : la page ne s'imprime pas", () => {
  assert.equal(pageWillPrint("ifFilled", undefined), false);
  assert.equal(pageWillPrint("ifFilled", null), false);
});

test("un champ fait de blancs ne vaut pas du contenu", () => {
  // Espaces, retour a la ligne, tabulation, espace INSECABLE.
  assert.equal(pageWillPrint("ifFilled", " \n\t  "), false);
});

/* ---------------------------------------------------- Coupure a l'impression */

test("la coupure est portee par la feuille, entre pages ADJACENTES", () => {
  /**
   * Verrouille le choix, pas la syntaxe. Un `break-after` sur chaque page
   * ferait deux degats que le selecteur de frere evite : une feuille blanche
   * apres la derniere page, et une coupure orpheline la ou une page
   * conditionnelle a disparu du document.
   *
   * Le comptage reel des feuilles a ete fait dans un Chromium (1, 2, 3 pages,
   * et 3 pages dont une conditionnelle absente -> 2 feuilles). Ce test-ci ne
   * refait pas cette mesure : il empeche seulement qu'on remplace la regle par
   * un `break-after` sans revenir sur la demonstration.
   */
  assert.match(PRINT_ELEMENT_CSS, /\.ds-page \+ \.ds-page\s*\{\s*break-before:\s*page;\s*\}/);
  assert.doesNotMatch(PRINT_ELEMENT_CSS, /\.ds-page\s*\{[^}]*break-after/);
});
