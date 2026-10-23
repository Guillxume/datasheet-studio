import { test } from "node:test";
import assert from "node:assert/strict";
import { groupFeatures } from "./registry";

/**
 * Le regroupement est la reponse au debordement sur une seconde page : un
 * catalogue qui porte trois valeurs sous « Reglage » gagne deux lignes. Ces
 * assertions fixent les deux points ou un regroupement naif se trompe — le sort
 * des abreviations et la normalisation du libelle.
 */

test("regroupe les valeurs de meme libelle dans l'ordre d'arrivee", () => {
  const out = groupFeatures(
    [
      { name: "Reglage", value: "hauteur" },
      { name: "Coloris", value: "vieux rose" },
      { name: "Reglage", value: "assise" },
    ],
    true,
    true
  );

  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { name: "Reglage", cells: ["hauteur", "assise"] });
  assert.deepEqual(out[1], { name: "Coloris", cells: ["vieux rose"] });
});

test("normalise le libelle sans alterer celui qui s'affiche", () => {
  const out = groupFeatures(
    [
      { name: "Reglage", value: "hauteur" },
      { name: "  reglage ", value: "assise" },
      { name: "REGLAGE", value: "dossier" },
    ],
    true,
    true
  );

  assert.equal(out.length, 1);
  // Le libelle retenu est celui de la premiere occurrence, pas la cle normalisee.
  assert.equal(out[0].name, "Reglage");
  assert.deepEqual(out[0].cells, ["hauteur", "assise", "dossier"]);
});

test("colle l'abreviation a sa valeur et non au groupe", () => {
  const out = groupFeatures(
    [
      { name: "Hauteur", value: "45 cm", abbreviation: "H" },
      { name: "Hauteur", value: "52 cm", abbreviation: "H2" },
    ],
    true,
    true
  );

  // Un renvoi de schema designe UNE cote : le rassembler en fin de ligne
  // (« 45 cm · 52 cm (H, H2) ») le rendrait inexploitable.
  assert.deepEqual(out[0].cells, ["45 cm (H)", "52 cm (H2)"]);
});

test("omet les abreviations quand le bloc ne les affiche pas", () => {
  const out = groupFeatures([{ name: "Hauteur", value: "45 cm", abbreviation: "H" }], false, true);
  assert.deepEqual(out[0].cells, ["45 cm"]);
});

test("ne repete pas une valeur saisie deux fois sous le meme libelle", () => {
  const out = groupFeatures(
    [
      { name: "Norme", value: "EN 1335" },
      { name: "Norme", value: "EN 1335" },
    ],
    true,
    true
  );

  assert.equal(out.length, 1);
  assert.deepEqual(out[0].cells, ["EN 1335"]);
});

test("conserve chaque ligne quand le regroupement est desactive", () => {
  const out = groupFeatures(
    [
      { name: "Reglage", value: "hauteur" },
      { name: "Reglage", value: "assise" },
    ],
    true,
    false
  );

  assert.equal(out.length, 2);
  assert.deepEqual(out.map((row) => row.cells), [["hauteur"], ["assise"]]);
});

test("tolere une valeur ou un libelle absent", () => {
  // Les caracteristiques viennent d'une base de production : une valeur nulle ne
  // doit pas faire echouer le rendu d'une fiche entiere.
  const out = groupFeatures(
    [{ name: undefined, value: null }, { name: "Poids", value: undefined }] as never,
    true,
    true
  );

  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { name: "", cells: [""] });
  assert.deepEqual(out[1], { name: "Poids", cells: [""] });
});
