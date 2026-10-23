import test from "node:test";
import assert from "node:assert/strict";
import { catalogSize, selectRows, type Catalog } from "./importSelection";

/**
 * Se tromper d'un indice ici ne casse rien de visible : le rapport de lot
 * annonce « 399 rendues, 0 echec », ce qui a l'air parfait. D'ou ces tests, qui
 * eprouvent les deux formats sur les MEMES cas — le filtre doit se comporter a
 * l'identique, sinon la meme regle donne deux lots differents selon le fichier.
 */

const csv: Catalog = {
  kind: "csv",
  fileName: "catalogue.csv",
  columns: ["ref", "actif", "retrait"],
  rows: [
    ["A-1", "1", "2026-01-01"],
    ["A-2", "0", ""],
    ["A-3", "1", ""],
    ["A-4", "1 ", "2026-02-01"],
  ],
};

const json: Catalog = {
  kind: "json",
  fileName: "catalogue.json",
  columns: ["ref", "actif", "retrait"],
  itemsPath: "data",
  root: {},
  items: [
    { ref: "A-1", actif: "1", retrait: "2026-01-01" },
    { ref: "A-2", actif: "0", retrait: "" },
    { ref: "A-3", actif: "1", retrait: "" },
    { ref: "A-4", actif: "1 ", retrait: "2026-02-01" },
  ],
};

const sansFiltre = { column: "", value: "", negate: false };

test("le nombre d'enregistrements ne depend pas du format", () => {
  assert.equal(catalogSize(csv), 4);
  assert.equal(catalogSize(json), 4);
  assert.equal(catalogSize(null), 0);
});

test("sans filtre, tout le fichier est retenu, dans l'ordre", () => {
  for (const catalog of [csv, json]) {
    assert.deepEqual(selectRows(catalog, sansFiltre), [0, 1, 2, 3], catalog.kind);
  }
});

test("un catalogue absent ne retient rien", () => {
  assert.deepEqual(selectRows(null, sansFiltre), []);
});

test("le filtre retient les indices, pas les lignes", () => {
  // Ce sont bien les positions DANS LE FICHIER : elles servent a numeroter la
  // progression et a rejouer un echec isole.
  for (const catalog of [csv, json]) {
    assert.deepEqual(selectRows(catalog, { column: "actif", value: "1", negate: false }), [0, 2, 3], catalog.kind);
  }
});

test("la negation retourne exactement le complement", () => {
  for (const catalog of [csv, json]) {
    const gardes = selectRows(catalog, { column: "actif", value: "1", negate: false });
    const exclus = selectRows(catalog, { column: "actif", value: "1", negate: true });

    assert.deepEqual(exclus, [1], catalog.kind);
    // La reunion doit couvrir le fichier entier, sans doublon ni trou.
    assert.deepEqual([...gardes, ...exclus].sort((a, b) => a - b), [0, 1, 2, 3], catalog.kind);
  }
});

test("filtrer sur la valeur vide est un usage legitime", () => {
  // « garder les lignes sans date de retrait ». Une cellule vide vaut "", pas
  // « absente » : la traiter comme absente rendrait ce filtre impossible.
  for (const catalog of [csv, json]) {
    assert.deepEqual(selectRows(catalog, { column: "retrait", value: "", negate: false }), [1, 2], catalog.kind);
  }
});

test("les espaces de fin ne font pas echouer une comparaison", () => {
  /*
   * La ligne A-4 porte « 1 » avec un espace — un export de catalogue en produit
   * regulierement, et il est invisible a l'oeil. Sans le detrempage, elle
   * sortait du lot et l'on cherchait pourquoi 399 fiches au lieu de 400.
   */
  for (const catalog of [csv, json]) {
    const gardes = selectRows(catalog, { column: "actif", value: " 1 ", negate: false });
    assert.deepEqual(gardes, [0, 2, 3], catalog.kind);
  }
});

test("une colonne inconnue ne retient rien plutot que tout", () => {
  // Le sens qui compte : un filtre fautif doit produire un lot vide, qu'on
  // remarque, et non le catalogue entier, qu'on ne remarque pas.
  for (const catalog of [csv, json]) {
    assert.deepEqual(selectRows(catalog, { column: "inexistante", value: "1", negate: false }), [], catalog.kind);
  }
});

test("un catalogue vide ne retient rien, avec ou sans filtre", () => {
  const vide: Catalog = { kind: "csv", fileName: "v.csv", columns: ["ref"], rows: [] };
  assert.deepEqual(selectRows(vide, sansFiltre), []);
  assert.deepEqual(selectRows(vide, { column: "ref", value: "A", negate: false }), []);
});
