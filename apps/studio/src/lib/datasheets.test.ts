import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_INDEXED_REFS,
  NO_CATEGORY,
  indexedRefs,
  looksLikePdf,
  parseSelection,
  parseSort,
  productKeyOf,
  selectionValue,
  slugifyName,
  topCategory,
  usableUrl,
  zipEntryNames,
} from "./datasheets";

test("la cle d'un produit est son identifiant, a defaut sa reference", () => {
  assert.equal(productKeyOf({ id: 901, sku: "REF-1" }), "901");
  assert.equal(productKeyOf({ id: "  ", sku: "REF-1" }), "REF-1");
  assert.equal(productKeyOf({ sku: "REF-1" }), "REF-1");
  // Sans l'un ni l'autre, pas de cle : tous les produits anonymes partageraient
  // sinon la meme ligne et s'ecraseraient a chaque rendu.
  assert.equal(productKeyOf({ id: null, sku: "" }), null);
  assert.equal(productKeyOf({}), null);
});

test("une selection se relit, meme quand la cle contient un deux-points", () => {
  assert.deepEqual(parseSelection(selectionValue("fr", "901")), { locale: "fr", productKey: "901" });
  assert.deepEqual(parseSelection(selectionValue("es", "ABC:12")), { locale: "es", productKey: "ABC:12" });
});

test("une selection mal formee est ecartee", () => {
  assert.equal(parseSelection("901"), null);
  assert.equal(parseSelection(":901"), null);
  assert.equal(parseSelection("fr:"), null);
});

test("seules les adresses http et https entrent dans l'index", () => {
  assert.equal(usableUrl("https://www.acme.example/fiche-technique/poteau-901.pdf"), "https://www.acme.example/fiche-technique/poteau-901.pdf");
  assert.equal(usableUrl("  http://exemple.fr/a.pdf "), "http://exemple.fr/a.pdf");
  assert.equal(usableUrl("javascript:alert(1)"), null);
  assert.equal(usableUrl("file:///etc/passwd"), null);
  assert.equal(usableUrl("/fiche-technique/relative.pdf"), null);
  assert.equal(usableUrl(""), null);
  assert.equal(usableUrl(null), null);
});

test("un nom de fichier n'a ni accent ni separateur, et n'est jamais vide", () => {
  assert.equal(slugifyName("Fauteuil de bureau « June » — Noir/Gris"), "fauteuil-de-bureau-june-noir-gris");
  assert.equal(slugifyName("Écran ÉLÉVATEUR"), "ecran-elevateur");
  assert.equal(slugifyName("../../"), "fiche");
  assert.ok(slugifyName("a".repeat(200)).length <= 80);
});

test("les noms du zip sont distincts, la langue n'apparait qu'en cas de besoin", () => {
  const uneLangue = zipEntryNames([
    { productKey: "901", productName: "Poteau noir", locale: "fr" },
    { productKey: "902", productName: "Poteau chrome", locale: "fr" },
  ]);
  assert.deepEqual(uneLangue, [
    "fiche-technique-poteau-noir-901.pdf",
    "fiche-technique-poteau-chrome-902.pdf",
  ]);

  const deuxLangues = zipEntryNames([
    { productKey: "901", productName: "Poteau", locale: "fr" },
    { productKey: "901", productName: "Poteau", locale: "es" },
  ]);
  assert.deepEqual(deuxLangues, ["fiche-technique-poteau-901-fr.pdf", "fiche-technique-poteau-901-es.pdf"]);
});

test("deux cles qui se ressemblent une fois nettoyees ne s'ecrasent pas", () => {
  // « A/1 » et « A-1 » donnent le meme nom : a l'extraction, le second fichier
  // ecraserait le premier sans un mot.
  const noms = zipEntryNames([
    { productKey: "A/1", productName: "Poteau", locale: "fr" },
    { productKey: "A-1", productName: "Poteau", locale: "fr" },
  ]);
  assert.equal(new Set(noms).size, 2);
  assert.deepEqual(noms, ["fiche-technique-poteau-a-1.pdf", "fiche-technique-poteau-a-1-2.pdf"]);
});

test("un PDF se reconnait a ses premiers octets, une page HTML non", () => {
  assert.equal(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n...")), true);
  assert.equal(looksLikePdf(new TextEncoder().encode("<!doctype html>")), false);
  assert.equal(looksLikePdf(new Uint8Array()), false);
});

test("un tri inconnu retombe sur le tri par categorie", () => {
  assert.equal(parseSort("nom"), "nom");
  assert.equal(parseSort("id"), "id");
  assert.equal(parseSort("prix"), "categorie");
  assert.equal(parseSort(undefined), "categorie");
});

test("la categorie de niveau 1 est la premiere du fil, et un fil vide n'en a pas", () => {
  assert.equal(topCategory(["Bureaux d'entreprise", "Bureaux d'angle"]), "Bureaux d'entreprise");
  assert.equal(topCategory(["  ", "Bureaux"]), "Bureaux");
  assert.equal(topCategory([]), NO_CATEGORY);
  assert.equal(topCategory(null), NO_CATEGORY);
});

test("les references indexees : absentes, elles ne disent rien ; vides, elles effacent", () => {
  // null et non [] : l'index doit garder ce qu'un rendu precedent y avait mis
  // quand le payload ne porte pas le champ (ancien module, outil de test).
  assert.equal(indexedRefs(undefined), null);
  assert.equal(indexedRefs(null), null);
  assert.deepEqual(indexedRefs([]), []);
});

test("les references indexees sont nettoyees, sans doublon a la casse pres, dans l'ordre recu", () => {
  assert.deepEqual(indexedRefs([" FRN-12 ", "", "  ", "frn-12", "VAR-1", "FRN-12"]), ["FRN-12", "VAR-1"]);
  // Trop longue pour etre une reference : ecartee plutot que de faire echouer la fiche.
  assert.deepEqual(indexedRefs(["x".repeat(201), "OK"]), ["OK"]);
});

test("une liste demesuree est tronquee, pas refusee", () => {
  const refs = indexedRefs(Array.from({ length: MAX_INDEXED_REFS + 50 }, (_, index) => `REF-${index}`));
  assert.equal(refs?.length, MAX_INDEXED_REFS);
  assert.equal(refs?.[0], "REF-0");
});
