import { test } from "node:test";
import assert from "node:assert/strict";
import { describeFailure } from "./describeFailure";


/**
 * Ce qui est verrouille : qu'aucun echec ne ressorte en langage technique, et
 * qu'un message deja ecrit pour un humain ne soit pas remplace par un message
 * generique — ce serait perdre de l'information au nom de la clarte.
 */

test("hors ligne l'emporte sur tout le reste", () => {
  // Le reseau absent explique l'echec mieux que le code qui en decoule.
  const out = describeFailure(new Error("HTTP 503"), false);
  assert.match(out, /Connexion perdue/);
});

test("un echec reseau ne sort pas en « Failed to fetch »", () => {
  const out = describeFailure(new TypeError("Failed to fetch"));
  assert.doesNotMatch(out, /fetch/i);
  assert.match(out, /n'a pas répondu/);
});

test("un 5xx annonce une indisponibilite passagere et invite a reessayer", () => {
  const out = describeFailure(new Error("HTTP 502"));
  assert.match(out, /ne répond pas/);
  assert.match(out, /502/, "le code reste lisible pour le support");
  assert.match(out, /réessayez/);
});

test("un 4xx ne promet pas qu'un nouvel essai suffira", () => {
  const out = describeFailure(new Error("HTTP 422"));
  assert.match(out, /refusée/i);
  assert.doesNotMatch(out, /réessayez dans un instant/);
});

test("un message ecrit par nos routes passe intact", () => {
  // « Template introuvable. » est deja destine a un humain : le remplacer par
  // un message generique ferait perdre la cause reelle.
  assert.equal(describeFailure(new Error("Template introuvable.")), "Template introuvable.");
});

test("une valeur qui n'est pas une Error ne fait pas planter le message", () => {
  assert.equal(describeFailure("panne inattendue"), "panne inattendue");
});

test("tout echec technique promet que rien n'est perdu", () => {
  // Vrai et verifiable : l'arbre du document vit cote client, un enregistrement
  // echoue ne lui retire rien.
  for (const cas of [
    describeFailure(new Error("HTTP 500"), false),
    describeFailure(new TypeError("Failed to fetch")),
    describeFailure(new Error("HTTP 500")),
  ]) {
    assert.match(cas, /intactes/);
  }
});
