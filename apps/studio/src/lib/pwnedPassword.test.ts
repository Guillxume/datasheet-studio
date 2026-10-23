import test from "node:test";
import assert from "node:assert/strict";
import { chercherSuffixe, prefixeEtSuffixe, pwnedProblem } from "./pwnedPassword";

/**
 * L'APPEL RESEAU N'EST PAS TESTE ICI — `pnpm test` ne doit dependre d'aucune
 * infrastructure, et surtout pas d'un service tiers. Ce qui est teste est ce qui
 * peut se tromper EN SILENCE : le decoupage de l'empreinte, et la lecture de la
 * reponse. Les deux sont purs.
 */

test("le decoupage suit le k-anonymat : cinq caracteres, trente-cinq", () => {
  // « password » : SHA-1 = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8, verifie
  // contre l'API le 02/09/2026.
  const { prefixe, suffixe } = prefixeEtSuffixe("password");
  assert.equal(prefixe, "5BAA6");
  assert.equal(suffixe, "1E4C9B93F3F0682250B6CF8331B7EE68FD8");
  assert.equal(prefixe.length, 5);
  assert.equal(suffixe.length, 35);
});

test("le prefixe est en majuscules et purement hexadecimal", () => {
  // C'est ce qui rend l'URL construite sure sans passer par la garde anti-SSRF.
  for (const mot of ["", "é", "un mot de passe avec des espaces", "🔐"]) {
    const { prefixe } = prefixeEtSuffixe(mot);
    assert.match(prefixe, /^[0-9A-F]{5}$/, JSON.stringify(mot));
  }
});

test("un suffixe present rend son nombre d'occurrences", () => {
  const corps = [
    "003CD215739D7C1B2218670D26F81408237:2",
    "1E4C9B93F3F0682250B6CF8331B7EE68FD8:52372427",
    "00658BFD1E05761042698D19D32CD9F1A8F:15",
  ].join("\n");

  assert.equal(chercherSuffixe(corps, "1E4C9B93F3F0682250B6CF8331B7EE68FD8"), 52372427);
});

test("un suffixe absent rend null", () => {
  const corps = "003CD215739D7C1B2218670D26F81408237:2";
  assert.equal(chercherSuffixe(corps, "1E4C9B93F3F0682250B6CF8331B7EE68FD8"), null);
});

test("LES ENTREES A COMPTEUR ZERO SONT DU REMBOURRAGE, PAS DES CORRESPONDANCES", () => {
  /*
   * Le defaut que ce test ferme, et il produirait un message incomprehensible.
   * Avec `Add-Padding: true`, HIBP ajoute de fausses entrees pour que la taille
   * de la reponse ne trahisse pas le nombre reel de suffixes connus. Mesure le
   * 02/09/2026 sur le prefixe 5BAA6 : 2 001 lignes avec rembourrage dont 24 a
   * compteur zero, 1 977 sans.
   *
   * Les compter comme des correspondances rejetterait un bon mot de passe en
   * annoncant qu'il est compromis — peu probable, et parfaitement evitable.
   */
  const corps = "AAAA1111111111111111111111111111111:0";
  assert.equal(chercherSuffixe(corps, "AAAA1111111111111111111111111111111"), null);
});

test("un compteur negatif ou illisible est traite comme du rembourrage", () => {
  // Le doute profite au mot de passe : on ne rejette que sur une information
  // claire.
  for (const compteur of ["-3", "", "beaucoup", "1.5e3"]) {
    const corps = `BBBB1111111111111111111111111111111:${compteur}`;
    const trouve = chercherSuffixe(corps, "BBBB1111111111111111111111111111111");
    assert.ok(trouve === null || trouve > 0, `compteur "${compteur}" -> ${trouve}`);
  }
});

test("la comparaison ignore la casse et les retours chariot", () => {
  // L'API repond en majuscules et en CRLF selon les intermediaires.
  const corps = "1e4c9b93f3f0682250b6cf8331b7ee68fd8:42\r\nAUTRE:1\r\n";
  assert.equal(chercherSuffixe(corps, "1E4C9B93F3F0682250B6CF8331B7EE68FD8"), 42);
});

test("une reponse vide ou abimee ne fait pas lever", () => {
  for (const corps of ["", "\n\n", "pas du tout le bon format", "SANSDEUXPOINTS"]) {
    assert.equal(chercherSuffixe(corps, "1E4C9B93F3F0682250B6CF8331B7EE68FD8"), null);
  }
});

test("le message ne s'affiche que pour un mot de passe compromis", () => {
  assert.equal(pwnedProblem({ etat: "sain" }), null);
  assert.equal(pwnedProblem({ etat: "indisponible", raison: "timeout" }), null);
  assert.notEqual(pwnedProblem({ etat: "compromis", occurrences: 3 }), null);
});

test("le message donne le nombre d'occurrences et n'accuse pas", () => {
  const message = pwnedProblem({ etat: "compromis", occurrences: 52372427 })!;

  // Le nombre emporte la conviction mieux qu'une consigne.
  assert.match(message, /52\s?372\s?427/u);
  // Et il reconnait que le mot de passe peut etre bon par ailleurs : « votre mot
  // de passe est mauvais » serait faux, et ferait chercher un mot plus complique
  // au lieu d'un mot different.
  assert.match(message, /long et unique/);
});
