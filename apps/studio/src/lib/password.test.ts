import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "./passwordPolicy";

/**
 * Le chemin critique de l'authentification. Deux choses y sont eprouvees :
 * qu'un bon mot de passe passe et qu'un mauvais ne passe pas — et surtout, que
 * les empreintes ABIMEES ne font pas lever, mais rendent `false`. C'est le
 * defaut qui compte : une exception ici sortirait en 500 et transformerait une
 * ligne de base corrompue en panne de connexion pour tout le monde.
 */

test("une empreinte valide reconnait son mot de passe", async () => {
  const hash = await hashPassword("correcte horse battery staple");
  assert.equal(await verifyPassword("correcte horse battery staple", hash), true);
});

test("un mot de passe voisin est refuse", async () => {
  const hash = await hashPassword("correcte horse battery staple");
  assert.equal(await verifyPassword("correcte horse battery stapl", hash), false);
  assert.equal(await verifyPassword("Correcte horse battery staple", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("deux empreintes du meme mot de passe different", async () => {
  // Le sel est aleatoire : sans lui, deux comptes avec le meme mot de passe
  // porteraient la meme empreinte, ce qui se lit d'un coup d'oeil dans un dump.
  const a = await hashPassword("le meme mot de passe");
  const b = await hashPassword("le meme mot de passe");
  assert.notEqual(a, b);
});

test("l'empreinte porte ses parametres", async () => {
  const hash = await hashPassword("peu importe lequel");
  const [algo, n, r, p] = hash.split("$");
  assert.equal(algo, "scrypt");
  assert.ok(Number(n) >= 16384, "cout memoire trop faible");
  assert.equal(Number(r), 8);
  assert.equal(Number(p), 1);
});

test("un compte sans mot de passe ne valide rien", async () => {
  // Le cas d'un compte invite qui n'a pas encore active son acces.
  assert.equal(await verifyPassword("n'importe quoi", null), false);
});

test("une empreinte abimee rend false plutot que de lever", async () => {
  for (const abimee of ["", "scrypt", "scrypt$$$$", "bcrypt$1$2$3$c2Vs$aGFzaA", "scrypt$0$8$1$c2Vs$aGFzaA"]) {
    assert.equal(await verifyPassword("essai", abimee), false, abimee);
  }
});

test("la politique refuse ce qui est trop court", () => {
  assert.notEqual(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH - 1)), null);
  assert.equal(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH)), null);
});

test("la politique refuse un mot de passe qui contient l'identifiant", () => {
  assert.notEqual(passwordProblem("jean.dupont-2026!", "jean.dupont@exemple.fr"), null);
  assert.equal(passwordProblem("un cheval bleu marche", "jean.dupont@exemple.fr"), null);
});

test("la politique n'exige ni majuscule ni chiffre ni symbole", () => {
  // Volontaire : c'est la longueur qui resiste. Ce test fige la decision pour
  // qu'elle ne soit pas defaite par reflexe.
  assert.equal(passwordProblem("des mots simples et longs"), null);
});

test("la politique refuse les espaces seuls et les saisies aberrantes", () => {
  assert.notEqual(passwordProblem(" ".repeat(20)), null);
  assert.notEqual(passwordProblem("a".repeat(201)), null);
});
