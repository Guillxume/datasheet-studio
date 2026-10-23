import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeWarningsHeader, encodeWarningsHeader } from "./renderWarnings";

/**
 * Le cas qui a motive ce module : une troncature qui coupait une sequence
 * `%XX`, et faisait perdre a l'appelant la TOTALITE des avertissements plutot
 * que le dernier. Il se reproduit avec n'importe quel accent place au bon
 * endroit — donc tres vite, sur un vrai catalogue.
 */

test("un aller-retour rend exactement les avertissements", () => {
  const warnings = ["asset introuvable a images.0.src : asset://photo", "portee etrangere ignoree"];

  assert.deepEqual(decodeWarningsHeader(encodeWarningsHeader(warnings)), warnings);
});

test("aucun avertissement, aucun en-tete a lire", () => {
  assert.deepEqual(decodeWarningsHeader(null), []);
  assert.deepEqual(decodeWarningsHeader(""), []);
  assert.equal(encodeWarningsHeader([]), "");
});

test("un en-tete tronque reste decodable — c'etait le defaut", () => {
  // « é » s'encode en %C3%A9 : quelle que soit la limite, la coupe tombe un
  // jour au milieu. L'ancienne ecriture, encodeURIComponent(...).slice(max),
  // levait alors « URI malformed » sur la ligne entiere.
  const warnings = [`téléchargement impossible : ${"https://exemple.fr/média-".repeat(80)}fin`];

  for (let max = 20; max <= 200; max += 1) {
    const header = encodeWarningsHeader(warnings, max);
    assert.ok(header.length <= max, `limite respectee a max=${max}`);
    assert.doesNotThrow(() => decodeURIComponent(header), `decodable a max=${max}`);
    // Ce qui revient est toujours un PREFIXE reel du message, jamais une
    // chaine abimee au dernier caractere.
    const decoded = decodeWarningsHeader(header)[0].replace(/\.\.\.$/, "");
    assert.ok(warnings[0].startsWith(decoded), `prefixe fidele a max=${max}`);
  }
});

test("une paire de substitution n'est pas coupee en deux", () => {
  // Un emoji dans un nom de fichier tient sur deux unites UTF-16 : couper entre
  // les deux ferait lever encodeURIComponent lui-meme, cote serveur, et le
  // rendu echouerait alors qu'il avait produit son PDF.
  const warnings = [`image introuvable : ${"a😀".repeat(60)}.jpg`];

  for (let max = 20; max <= 120; max += 1) {
    assert.doesNotThrow(() => decodeURIComponent(encodeWarningsHeader(warnings, max)));
  }
});

test("la troncature se voit", () => {
  const header = encodeWarningsHeader(["a".repeat(500)], 100);

  assert.ok(decodeWarningsHeader(header)[0].endsWith("..."));
});

test("un en-tete abime en route rend quelque chose plutot que rien", () => {
  // Un proxy peut couper ce que nous avons ecrit correctement : perdre
  // l'information qu'il y a EU des avertissements serait pire que de rendre la
  // chaine brute.
  assert.deepEqual(decodeWarningsHeader("asset%C3"), ["asset%C3"]);
});
