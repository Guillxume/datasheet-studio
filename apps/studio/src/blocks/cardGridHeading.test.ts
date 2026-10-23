import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { datasheetConfig } from "./registry";

/**
 * UN TITRE QUI SURVIT A SON CONTENU AFFIRME UNE RUBRIQUE INEXISTANTE.
 *
 * « Accessoires » etait pose dans un bloc `Heading` voisin de la grille. La
 * grille disparait quand le produit n'a aucun accessoire — le titre, lui,
 * restait : les fiches de vestiaires sortaient avec un intitule « Accessoires »
 * suivi d'une demi-page de blanc. Le document ne se contentait pas d'etre vide,
 * il annoncait une section que le produit n'a pas.
 *
 * Constate sur la fiche du produit 361 de la boutique Acme, qui ne declare
 * aucun accessoire.
 */

const rendre = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(datasheetConfig.components.CardGrid.render(props as never) as ReactElement);

const FICHES = [{ name: "Coiffe inclinée" }, { name: "Socle banc" }];

test("le titre disparait avec la grille vide", () => {
  const sortie = rendre({ source: [], items: [], group: "", heading: "Accessoires", columns: 4 });

  assert.equal(sortie, "", "ni titre ni conteneur ne doivent subsister");
});

test("le titre s'imprime des qu'une fiche est affichee", () => {
  const sortie = rendre({ source: FICHES, items: [], group: "", heading: "Accessoires", columns: 4 });

  assert.match(sortie, /Accessoires/, "le titre manque alors que la grille a du contenu");
  assert.match(sortie, /Coiffe inclin/, "la grille elle-meme manque");
});

test("sans titre, le rendu ne gagne aucun conteneur", () => {
  // Les templates deja publies n'en demandent pas : leur HTML ne doit pas
  // bouger, sous peine de deplacer des sauts de page sur des documents valides.
  const sortie = rendre({ source: FICHES, items: [], group: "", heading: "", columns: 4 });

  assert.ok(sortie.startsWith('<div class="ds-cardgrid"'), "un conteneur a ete ajoute : " + sortie.slice(0, 60));
});

test("un titre seul ne suffit pas a faire apparaitre une section", () => {
  // Le cas qui a produit le defaut : la source est vide mais des fiches sont
  // saisies dans le template ET filtrees par un groupe que le produit n'a pas.
  const sortie = rendre({
    source: [{ label: "Coloris", options: [{ label: "Bleu" }] }],
    items: [{ name: "Fermeture à clés", match: "Clés" }],
    group: "Fermeture",
    heading: "Fermetures disponibles",
    columns: 3,
  });

  assert.equal(sortie, "", "aucune fermeture proposee : le titre ne doit pas s'imprimer");
});

test("le titre suit l'alignement demande", () => {
  // « FERMETURES » coiffe son panneau par la gauche sur les fiches de
  // reference ; le centrage etait code en dur.
  const sortie = rendre({ source: FICHES, items: [], group: "", heading: "FERMETURES", headingAlign: "left" });

  assert.match(sortie, /text-align:left/, "l'alignement demande n'est pas applique");
});

/* ------------------------------------------------- RANGEE INCOMPLETE */

test("une rangee pleine garde exactement le rendu d'avant", () => {
  // Les templates deja publies en dependent : changer la declaration de grille
  // deplacerait leurs sauts de page.
  const sortie = rendre({ source: FICHES, items: [], group: "", columns: 2, gap: 8 });

  assert.match(sortie, /grid-template-columns:repeat\(2, 1fr\)/);
  assert.doesNotMatch(sortie, /justify-content/);
});

test("une rangee incomplete se centre sans changer la taille des fiches", () => {
  // Trois accessoires dans une grille de quatre : ils se tassaient a gauche.
  const trois = [{ name: "Coiffe" }, { name: "Socle banc" }, { name: "Pieds" }];
  const sortie = rendre({ source: trois, items: [], group: "", columns: 4, gap: 8 });

  assert.match(sortie, /justify-content:center/);
  // Trois pistes, mais larges d'un QUART de la rangee : la taille ne depend pas
  // du nombre d'options que le produit propose.
  assert.match(sortie, /grid-template-columns:repeat\(3, calc\(\(100% - 24mm\) \/ 4\)\)/);
});

test("a cote de l'image : photo a gauche, nom et texte a sa droite, alignes a gauche", () => {
  const sortie = rendre({
    source: "",
    items: [{ name: "Moraillon porte cadenas", image: "data:image/png;base64,AAAA", description: "Loquet pour cadenas." }],
    group: "",
    columns: 2,
    titlePosition: "beside",
    showDescription: true,
  });

  assert.match(sortie, /grid-template-columns:auto minmax\(0, 1fr\)/, "la fiche n'est pas en deux colonnes");
  assert.ok(sortie.indexOf("<img") < sortie.indexOf("Moraillon"), "la photo doit preceder le nom");
  assert.match(sortie, /text-align:left">Moraillon/, "le nom doit s'aligner a gauche, sur la photo");
  assert.match(sortie, /Loquet pour cadenas/);
});

test("a cote de l'image, une fiche sans photo garde sa colonne", () => {
  const sortie = rendre({ source: "", items: [{ name: "Serrure à clé" }], group: "", columns: 2, titlePosition: "beside" });
  // Premier enfant vide (la colonne de l'image), puis le texte.
  assert.match(sortie, /minmax\(0, 1fr\);[^"]*"><div><\/div><div/, "la colonne de l'image a disparu : " + sortie.slice(0, 300));
});

test("le nom reste centre dans les positions existantes", () => {
  const dessous = rendre({ source: "", items: [{ name: "Socle banc" }], group: "", columns: 4, titlePosition: "below" });
  assert.match(dessous, /text-align:center">Socle banc/);
});
