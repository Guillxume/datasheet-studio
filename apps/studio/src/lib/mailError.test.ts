import test from "node:test";
import assert from "node:assert/strict";
import { describeMailError } from "./mailError";

/**
 * LES CHAINES BRUTES DE CE FICHIER SONT OBSERVEES, PAS INVENTEES. Elles ont ete
 * relevees contre un vrai relais (Mailpit, le 02/09/2026) en provoquant chaque
 * panne, ou proviennent des messages que renvoient les relais courants. C'est ce
 * qui fait la valeur de cette table : une expression reguliere ecrite d'apres
 * l'idee qu'on se fait d'un message SMTP ne correspond a rien.
 */

/** Reproduit ce que nodemailer expose : un message, et un `code` pose a cote. */
function erreurSmtp(code: string, message: string): Error {
  const e = new Error(message);
  (e as Error & { code?: string }).code = code;
  return e;
}

test("port ferme", () => {
  // Observe : le code est ESOCKET, et c'est le message qui porte l'information.
  const d = describeMailError(erreurSmtp("ESOCKET", "connect ECONNREFUSED 127.0.0.1:1099"));
  assert.match(d.cause, /Rien n'ecoute/);
  assert.equal(d.regarder, "MAIL_HOST et MAIL_PORT");
});

test("nom d'hote qui ne resout pas", () => {
  const d = describeMailError(erreurSmtp("EDNS", "getaddrinfo ENOTFOUND relais.exemple.invalid"));
  assert.match(d.cause, /ne resout pas/);
  assert.equal(d.regarder, "MAIL_HOST");
});

test("TLS d'emblee sur un port en clair", () => {
  /*
   * Le cas le plus frequent en configuration, et le plus opaque : on met
   * MAIL_SECURE=true avec le port 587. Observe tel quel.
   */
  const d = describeMailError(
    erreurSmtp("ESOCKET", "805D7BF7:error:0A00010B:SSL routines:ssl3_get_record:wrong version number:")
  );
  assert.match(d.cause, /TLS et port ne s'accordent pas/);
  assert.equal(d.regarder, "MAIL_PORT et MAIL_SECURE");
});

test("ESOCKET seul ne doit pas etre lu comme un probleme de TLS", () => {
  /*
   * Le defaut que ce test ferme : nodemailer pose ESOCKET sur un ECONNREFUSED
   * comme sur une erreur TLS. Une premiere version de la table cherchait
   * `ESOCKET` dans le motif TLS, et seul l'ordre des entrees evitait la
   * confusion — une fragilite qui aurait saute au premier reordonnancement.
   */
  const d = describeMailError(erreurSmtp("ESOCKET", "connect ECONNREFUSED 10.0.0.5:587"));
  assert.match(d.cause, /Rien n'ecoute/);
});

test("identifiants refuses", () => {
  for (const brut of [
    "Invalid login: 535 5.7.8 Error: authentication failed",
    "534-5.7.9 Application-specific password required",
    "535 5.7.3 Authentication unsuccessful",
    "Username and Password not accepted",
  ]) {
    const d = describeMailError(erreurSmtp("EAUTH", brut));
    assert.match(d.cause, /identifiant ou le mot de passe/, brut);
    assert.equal(d.regarder, "MAIL_USER et MAIL_PASSWORD");
  }
});

test("certificat non verifiable", () => {
  const d = describeMailError(erreurSmtp("ESOCKET", "self-signed certificate in certificate chain"));
  assert.match(d.cause, /certificat TLS/);
  // Le message doit nommer l'echappatoire ET sa condition : c'est la seule
  // variable de ce module qui puisse degrader la securite.
  assert.match(d.cause, /MAIL_TLS_INSECURE/);
  assert.match(d.cause, /reseau de confiance/);
});

test("adresse d'expedition refusee", () => {
  const d = describeMailError(
    erreurSmtp("EENVELOPE", "550 5.7.1 Sender address rejected: not owned by user")
  );
  assert.match(d.cause, /adresse d'expedition/);
  assert.equal(d.regarder, "MAIL_FROM");
});

test("relais refuse de router", () => {
  const d = describeMailError(new Error("554 5.7.1 Relay access denied"));
  assert.match(d.cause, /refuse de router/);
});

test("limitation temporaire — ce n'est pas une erreur de configuration", () => {
  const d = describeMailError(new Error("421 4.7.0 Too many messages"));
  assert.match(d.cause, /limite temporairement/);
  assert.equal(d.regarder, undefined, "aucun champ a corriger dans ce cas");
});

test("un echec inconnu rend le message brut, sans pretendre le comprendre", () => {
  const d = describeMailError(new Error("quelque chose d'entierement nouveau"));
  assert.match(d.cause, /non reconnu/);
  assert.match(d.brut, /entierement nouveau/);
});

test("le brut est toujours renseigne, quel que soit ce qui est leve", () => {
  // Une bibliotheque peut lever autre chose qu'une Error.
  for (const jete of [new Error("classique"), "une chaine", 42, null, undefined, { code: "X" }]) {
    const d = describeMailError(jete);
    assert.equal(typeof d.brut, "string");
    assert.ok(d.brut.length > 0, String(jete));
    assert.ok(d.cause.length > 0);
  }
});

test("le code d'erreur est conserve dans le brut, pour un ticket", () => {
  const d = describeMailError(erreurSmtp("EAUTH", "535 authentication failed"));
  assert.match(d.brut, /EAUTH/);
  assert.match(d.brut, /535/);
});
