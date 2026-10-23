import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLabel } from "./registry";

/**
 * LA PASTILLE VIDE.
 *
 * Le nuancier rapproche une valeur d'attribut de la boutique d'une regle du
 * template. Quand le rapprochement echoue, RIEN ne le signale : la pastille se
 * rend sans couleur ni picto, et la fiche part chez le client avec un carre
 * vide. Ce n'est ni une erreur de rendu ni un avertissement — c'est exactement
 * ce qu'on veut quand la valeur n'a effectivement pas de picto, et c'est ce qui
 * rend le defaut indetectable quand elle en a un.
 *
 * Les cas ci-dessous sont TIRES DU CATALOGUE REEL (export des valeurs
 * d'attributs du 22/09/2026), pas imagines. Chacun correspond a une ligne de
 * l'export qui, sans normalisation, ne serait rapprochee de rien.
 */

test("les espaces de bord ne separent pas deux valeurs identiques", () => {
  // « Sans coiffe », « Coiffe L.120cm », « Goulotte simple », « Voile de fond »
  // et «  4D » portent tous un espace parasite dans l'export.
  assert.equal(normalizeLabel("Sans coiffe "), normalizeLabel("Sans coiffe"));
  assert.equal(normalizeLabel(" 4D"), normalizeLabel("4D"));
});

test("les espaces doubles sont replies", () => {
  // « Coiffe  L.30cm » et « Avec  accoudoirs » en portent un.
  assert.equal(normalizeLabel("Coiffe  L.30cm"), normalizeLabel("Coiffe L.30cm"));
  assert.equal(normalizeLabel("Avec  accoudoirs"), normalizeLabel("Avec accoudoirs"));
});

test("la casse ne separe pas deux valeurs identiques", () => {
  // Le catalogue porte « bleu » ET « Bleu », « vert » ET « Vert »,
  // « gris anthracite » ET « Gris anthracite ».
  assert.equal(normalizeLabel("bleu"), normalizeLabel("Bleu"));
  assert.equal(normalizeLabel("gris anthracite"), normalizeLabel("Gris anthracite"));
  assert.equal(normalizeLabel("Jaune Moutarde"), normalizeLabel("Jaune moutarde"));
});

test("un accent absent dans la boutique rejoint la regle accentuee", () => {
  // C'EST LE CAS QUI MOTIVE LE PLIAGE. Le catalogue stocke « A code
  // electronique » ; la fiche faite a la main imprime « À code électronique ».
  // Sans pliage, aucune regle ecrite correctement ne rapprocherait la valeur.
  assert.equal(normalizeLabel("A code electronique"), normalizeLabel("À code électronique"));
  assert.equal(normalizeLabel("Chene clair"), normalizeLabel("Chêne clair"));
  assert.equal(normalizeLabel("Cles"), normalizeLabel("Clés"));
});

test("deux valeurs reellement differentes le restent", () => {
  // La normalisation ne doit pas devenir un rapprochement approximatif : « A
  // code » et « A code electronique » sont deux fermetures distinctes du
  // catalogue, et les confondre imprimerait le mauvais picto.
  assert.notEqual(normalizeLabel("A code"), normalizeLabel("A code electronique"));
  assert.notEqual(normalizeLabel("Chêne clair"), normalizeLabel("Chêne ambré"));
  assert.notEqual(normalizeLabel("Socle banc L.60cm"), normalizeLabel("Socle banc L.90cm"));
});

test("une valeur absente ou non textuelle ne rapproche rien", () => {
  // Une chaine vide rapprocherait TOUTES les regles dont le libelle est vide :
  // le bloc doit traiter ce cas comme « pas de correspondance », pas comme
  // « correspondance avec la premiere regle mal remplie ».
  assert.equal(normalizeLabel(undefined), "");
  assert.equal(normalizeLabel(null), "");
  assert.equal(normalizeLabel(42), "");
  assert.equal(normalizeLabel("   "), "");
});
