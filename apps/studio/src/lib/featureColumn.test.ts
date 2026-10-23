import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeatureColumn } from "./featureColumn";

/**
 * Tous les cas ci-dessous sont RELEVES dans un export PrestaShop reel de 1042
 * produits — pas construits pour l'occasion. C'est ce qui justifie l'heuristique
 * de recollage : sur ce fichier, 648 fragments sur 6557 sont des morceaux, et
 * un `split(",")` naif abime donc une caracteristique sur dix, en silence.
 */

test("cas nominal : Nom:Valeur:Position, tries par position", () => {
  assert.deepEqual(parseFeatureColumn("Gamme:Panneaux:3,Hauteur bureau (cm):75:10,Forme:Droit:1"), [
    { name: "Forme", value: "Droit" },
    { name: "Gamme", value: "Panneaux" },
    { name: "Hauteur bureau (cm)", value: "75" },
  ]);
});

test("une VALEUR decimale a la francaise contient la virgule du separateur", () => {
  // "Epaisseur plateau (cm):2,5:25" : un split naif donne "…:2" puis "5:25",
  // soit une epaisseur de 2 cm au lieu de 2,5 et une caracteristique fantome.
  assert.deepEqual(parseFeatureColumn("Epaisseur plateau (cm):2,5:25,Gamme:Panneaux:3"), [
    { name: "Gamme", value: "Panneaux" },
    { name: "Epaisseur plateau (cm)", value: "2,5" },
  ]);
});

test("une valeur contenant une virgule de phrase reste entiere", () => {
  const raw = "Option:Voile de fond 2 cm d'epaisseur, H. 40 cm:116,Garantie (ans):5:170";
  assert.deepEqual(parseFeatureColumn(raw), [
    { name: "Option", value: "Voile de fond 2 cm d'epaisseur, H. 40 cm" },
    { name: "Garantie (ans)", value: "5" },
  ]);
});

test("une caracteristique repetee devient une ligne a valeurs multiples", () => {
  // PrestaShop exporte une ligne par valeur. Rendues telles quelles, ce sont
  // quatre lignes identiques a gauche dans le tableau de la fiche.
  const raw =
    "Dimension (cm):120 x 80:7,Dimension (cm):140 x 80:7,Dimension (cm):160 x 80:7,Gamme:Panneaux:3";
  assert.deepEqual(parseFeatureColumn(raw), [
    { name: "Gamme", value: "Panneaux" },
    { name: "Dimension (cm)", value: "120 x 80 / 140 x 80 / 160 x 80" },
  ]);

  assert.equal(parseFeatureColumn(raw, { merge: false }).length, 4);
});

test("une valeur repetee a l'identique n'est pas dupliquee", () => {
  assert.deepEqual(parseFeatureColumn("Norme:EN 527:5,Norme:EN 527:6"), [
    { name: "Norme", value: "EN 527" },
  ]);
});

test("une position absente renvoie en fin de tableau plutot que de perdre la ligne", () => {
  assert.deepEqual(parseFeatureColumn("Gamme:Panneaux:3,Finition:Chene"), [
    { name: "Gamme", value: "Panneaux" },
    { name: "Finition", value: "Chene" },
  ]);
});

test("les valeurs vides et les entrees sans nom sont ecartees", () => {
  assert.deepEqual(parseFeatureColumn("Vide::4,Gamme:Panneaux:3"), [
    { name: "Gamme", value: "Panneaux" },
  ]);
  assert.deepEqual(parseFeatureColumn(""), []);
  assert.deepEqual(parseFeatureColumn("n'importe quoi"), []);
});

test("une valeur contenant un deux-points est conservee entiere", () => {
  assert.deepEqual(parseFeatureColumn("Ratio:16:9:12"), [{ name: "Ratio", value: "16:9" }]);
});
