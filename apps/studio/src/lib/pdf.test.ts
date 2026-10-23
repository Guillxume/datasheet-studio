import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfPageCount } from "./pdf";

/**
 * Le nombre de pages est le chiffre que l'editeur affiche pour repondre a « est-ce
 * que ca tient ? ». Ces assertions fixent la structure sur laquelle il est lu —
 * verifiee sur des rendus reels du Chromium de Gotenberg, qui produit un PDF 1.4
 * sans flux d'objets : un unique « /Count n » sur l'arbre de pages, et autant
 * d'objets « /Type /Page ».
 */

test("lit le total sur l'arbre de pages", () => {
  const pdf = Buffer.from(
    "%PDF-1.4\n3 0 obj\n<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>\nendobj\n"
  );

  assert.equal(pdfPageCount(pdf), 2);
});

test("lit le total quand /Count precede /Type", () => {
  // L'ordre des cles d'un dictionnaire PDF n'est pas normalise.
  const pdf = Buffer.from("%PDF-1.4\n3 0 obj\n<< /Count 5 /Type /Pages >>\nendobj\n");

  assert.equal(pdfPageCount(pdf), 5);
});

test("retient le total le plus grand d'un arbre imbrique", () => {
  // Une branche porte un total partiel ; la racine porte le total.
  const pdf = Buffer.from(
    "%PDF-1.4\n" +
      "2 0 obj << /Type /Pages /Count 9 /Kids [3 0 R 5 0 R] >> endobj\n" +
      "3 0 obj << /Type /Pages /Count 4 >> endobj\n"
  );

  assert.equal(pdfPageCount(pdf), 9);
});

test("a defaut d'arbre de pages, compte les objets page", () => {
  const pdf = Buffer.from(
    "%PDF-1.4\n" +
      "4 0 obj << /Type /Page /Parent 3 0 R >> endobj\n" +
      "6 0 obj << /Type /Page /Parent 3 0 R >> endobj\n" +
      "8 0 obj << /Type /Page /Parent 3 0 R >> endobj\n"
  );

  assert.equal(pdfPageCount(pdf), 3);
});

test("ne confond pas /Pages avec /Page en repli", () => {
  const pdf = Buffer.from("%PDF-1.4\n3 0 obj << /Type /Pages >> endobj\n");

  // Aucun /Count exploitable, et /Pages n'est pas une page : rien de lisible.
  assert.equal(pdfPageCount(pdf), null);
});

test("renvoie null sur ce qui n'est pas un PDF", () => {
  // null et non 1 : l'appelant doit pouvoir distinguer « une page » de
  // « je n'ai pas su lire », et n'afficher aucun chiffre plutot qu'un faux.
  assert.equal(pdfPageCount(Buffer.from("bonjour")), null);
});
