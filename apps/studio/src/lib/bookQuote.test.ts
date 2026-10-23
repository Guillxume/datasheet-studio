import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_QUOTE_BYTES, quoteProblem } from "./bookQuote";

const pdf = new TextEncoder().encode("%PDF-1.7\n");

test("un PDF de taille raisonnable est accepte", () => {
  assert.equal(quoteProblem(180_000, pdf), null);
});

test("vide, trop lourd ou autre chose qu'un PDF est refuse, avec la raison", () => {
  assert.equal(quoteProblem(0, new Uint8Array()), "Le devis est vide.");
  assert.equal(quoteProblem(5_000, new TextEncoder().encode("<html>")), "Le devis n'est pas un PDF.");
  // La taille est jugee avant la signature : un fichier trop lourd se refuse sans etre lu.
  assert.match(quoteProblem(MAX_QUOTE_BYTES + 1, new Uint8Array()) ?? "", /trop lourd : au plus 20 Mo/);
});
