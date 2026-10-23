import { test } from "node:test";
import assert from "node:assert/strict";
import { CsvParser, detectDelimiter, parseCsv, streamCsvRows } from "./csv";

/**
 * Les quatre points sur lesquels un export d'Excel casse un lecteur CSV naif :
 * le BOM, le CRLF, les guillemets doubles, et le saut de ligne DANS un champ.
 * Ils sont ici parce qu'ils ont ete rencontres, pas parce que la RFC les liste.
 */

test("cas nominal", () => {
  assert.deepEqual(parseCsv("a,b\n1,2\n"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("le separateur se lit dans le fichier, il n'a pas a etre declare", () => {
  // Export francais d'Excel : point-virgule. Export anglo-saxon : virgule.
  assert.equal(detectDelimiter("ref;nom;prix"), ";");
  assert.equal(detectDelimiter("ref,nom,prix"), ",");
  assert.equal(detectDelimiter("ref\tnom\tprix"), "\t");
  // Un titre de colonne « Poids, net » ne doit pas faire elire la virgule.
  assert.equal(detectDelimiter('ref;"Poids, net";prix'), ";");
});

test("un champ cite garde ses virgules, ses sauts de ligne et ses guillemets", () => {
  const rows = parseCsv('a,b\n"un, deux","trois\nquatre"\n"il dit ""bonjour""",fin\n');
  assert.deepEqual(rows[1], ["un, deux", "trois\nquatre"]);
  assert.deepEqual(rows[2], ['il dit "bonjour"', "fin"]);
});

test("CRLF et BOM ne polluent ni la premiere colonne ni la derniere valeur", () => {
  const rows = parseCsv("﻿product.name,product.sku\r\nTranspalette,TPM-2500\r\n");
  assert.deepEqual(rows[0], ["product.name", "product.sku"]);
  assert.deepEqual(rows[1], ["Transpalette", "TPM-2500"]);
});

test("une derniere ligne sans saut final n'est pas perdue", () => {
  assert.deepEqual(parseCsv("a,b\n1,2"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("un champ final vide reste une colonne", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,2,\n")[1], ["1", "2", ""]);
});

test("le decoupage en morceaux ne change rien au resultat", () => {
  // Le fichier arrive par blocs de flux : un champ cite peut etre coupe en
  // deux, y compris au milieu d'un guillemet echappe ou d'un CRLF.
  const text = 'a;b\r\n"un;deux";"il dit ""bonjour"""\r\n';
  const attendu = [
    ["a", "b"],
    ["un;deux", 'il dit "bonjour"'],
  ];

  for (const size of [1, 2, 3, 7, 13]) {
    const parser = new CsvParser();
    const rows: string[][] = [];
    for (let i = 0; i < text.length; i += size) {
      rows.push(...parser.push(text.slice(i, i + size)));
    }
    rows.push(...parser.end());
    assert.deepEqual(rows, attendu, `decoupage par ${size} caractere(s)`);
  }
});

test("les lignes vides sont ecartees, y compris le saut final", async () => {
  async function* chunks() {
    yield "a,b\n1,2\n\n\n";
  }
  const rows: string[][] = [];
  for await (const row of streamCsvRows(chunks())) rows.push(row);
  assert.equal(rows.length, 2);
});
