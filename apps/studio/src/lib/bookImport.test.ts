import { test } from "node:test";
import assert from "node:assert/strict";
import { candidates, importLines, normalizeRef, packageParts, resolveImport, MAX_IMPORT_LINES, type RefMatch } from "./bookImport";

const fiche = (ref: string, key: string, name: string, url: string | null = `https://boutique.exemple/${key}.pdf`): RefMatch => ({
  ref,
  value: `fr:${key}`,
  name,
  productId: key,
  category: "Bureaux",
  locale: "fr",
  url,
});

/** Les lignes que supplierRefMatches aurait rendues. */
const index = (...items: RefMatch[]) => items;

test("une ligne de devis collee depuis un tableur donne ses morceaux, dont la reference", () => {
  const found = candidates("Bureau Droit PURE WIST\t109423\t2\t349,00 €\t698,00 €");
  assert.ok(found.includes("109423"));
  // La virgule n'est pas un separateur : un prix reste un seul morceau.
  assert.ok(found.includes("349,00"));
  // Trop courts pour designer un produit : quantite, symbole.
  assert.equal(found.includes("2"), false);
  assert.equal(found.includes("€"), false);
});

test("la ponctuation de bord est retiree, la casse ignoree", () => {
  const found = candidates("Ref: frn-88231, (ALT-552) « BF2500 »");
  assert.ok(found.includes("frn-88231"));
  assert.ok(found.includes("alt-552"));
  assert.ok(found.includes("bf2500"));
});

test("une reference qui contient une virgule ou des espaces est retrouvee entiere", () => {
  assert.ok(candidates("2 x {109423:1,105651:1} 349,00").includes("{109423:1,105651:1}"));
  // Groupes de morceaux voisins : une reference « TPM 2500 L » survit au decoupage.
  assert.ok(candidates("Transpalette TPM  2500 L — 1 unite").includes("tpm 2500 l"));
  assert.equal(normalizeRef("  TPM   2500 L "), "tpm 2500 l");
});

test("les lignes vides sont ignorees, mais la numerotation suit la saisie", () => {
  const lines = importLines("Designation\tRef\n\n109423\r\n   \nFRN-88231\n");
  assert.deepEqual(
    lines.map((line) => [line.no, line.text]),
    [
      [1, "Designation\tRef"],
      [3, "109423"],
      [5, "FRN-88231"],
    ]
  );
  assert.equal(importLines("x\n".repeat(MAX_IMPORT_LINES + 10)).length, MAX_IMPORT_LINES);
});

test("chaque fiche n'est ajoutee qu'une fois, dans l'ordre du collage, avec ses lignes et references", () => {
  const report = resolveImport(
    importLines("Vestiaire 3 portes FRN-88232 1\nBureau 109423 2\nBureau (rappel) 109423\nVestiaire 2 portes ALT-552 FRN-88231"),
    index(
      fiche("FRN-88232", "1411", "Vestiaire 3 portes"),
      fiche("109423", "187", "Bureau droit"),
      fiche("ALT-552", "1410", "Vestiaire 2 portes"),
      fiche("FRN-88231", "1410", "Vestiaire 2 portes")
    )
  );

  assert.deepEqual(
    report.fiches.map((item) => [item.value, item.lines, item.refs]),
    [
      ["fr:1411", [1], ["FRN-88232"]],
      ["fr:187", [2, 3], ["109423"]],
      ["fr:1410", [4], ["ALT-552", "FRN-88231"]],
    ]
  );
  assert.equal(report.lineCount, 4);
  assert.deepEqual(report.unmatched, []);
});

test("une ligne sans reference reconnue figure au rapport, telle qu'elle a ete collee", () => {
  const report = resolveImport(
    importLines("Designation\tQte\tPrix\nBureau 109423 2\nTotal HT\t698,00 €"),
    index(fiche("109423", "187", "Bureau droit"))
  );
  assert.deepEqual(report.unmatched, [
    { line: 1, text: "Designation\tQte\tPrix" },
    { line: 3, text: "Total HT\t698,00 €" },
  ]);
});

test("une reference portee par deux produits les ajoute tous les deux, et le dit", () => {
  const report = resolveImport(
    importLines("Pietement 105651 x4"),
    index(fiche("105651", "187", "Bureau droit"), fiche("105651", "442", "Bureau bench"))
  );
  assert.deepEqual(report.fiches.map((item) => item.value), ["fr:187", "fr:442"]);
  assert.deepEqual(report.ambiguous, [{ line: 1, ref: "105651", names: ["Bureau droit", "Bureau bench"] }]);
});

test("une fiche reconnue mais sans adresse n'entre pas dans le book, et le rapport la nomme une fois", () => {
  const report = resolveImport(
    importLines("Vitrine VIT-9\nVitrine encore VIT-9"),
    index(fiche("VIT-9", "12", "Vitrine", null))
  );
  assert.deepEqual(report.fiches, []);
  assert.deepEqual(report.withoutLink, [{ line: 1, ref: "VIT-9", name: "Vitrine" }]);
  // Reconnue : ce n'est pas une ligne « sans reference ».
  assert.deepEqual(report.unmatched, []);
});

test("un package se lit en ses references, quantites ignorees ; une reference simple n'en est pas un", () => {
  assert.deepEqual(packageParts("{109445:1,109417:1,105652:2}"), ["109445", "109417", "105652"]);
  assert.deepEqual(packageParts("{122808:1}"), ["122808"]);
  assert.equal(packageParts("109423"), null);
  // Un deux-points ne fait pas un package : « ABC:12 » est une reference simple.
  assert.equal(packageParts("ABC:12"), null);
});

test("un package tronque par PrestaShop (64 caracteres) garde ce qui est entier, et seulement cela", () => {
  // Coupe au milieu de la derniere reference : « 1034 » n'en est pas une.
  assert.deepEqual(packageParts("{103535:1,102608:1,1034"), ["103535", "102608"]);
  // Coupe apres un deux-points : la reference est entiere, sa quantite perdue.
  assert.deepEqual(packageParts("{103535:1,102608:"), ["103535", "102608"]);
  // Virgules orphelines, formes relevees dans le catalogue Acme.
  assert.deepEqual(packageParts("{,109427:1}"), ["109427"]);
  assert.deepEqual(packageParts("{109427:1,126216:1,"), ["109427", "126216"]);
});

test("une fin de package sans son debut n'est pas un package : elle ne ferait venir que sur un accessoire", () => {
  assert.equal(packageParts(",122815:1}"), null);
  assert.equal(packageParts("106354:1}"), null);
  const report = resolveImport(importLines("Accessoire\t106354"), index(fiche("106354:1}", "438", "Armoire a rideaux")));
  assert.deepEqual(report.fiches, []);
});

test("un package est reconnu quand toutes ses references sont collees, a n'importe quelle ligne", () => {
  const report = resolveImport(
    importLines("Plateau 160x80\t109445\t2\nPietement\t109417\t2\nGoulotte\t105652\t2\nCaisson\t106256\t1"),
    index(
      fiche("{109445:1,109417:1,105652:1}", "442", "Bureau bench"),
      fiche("106256", "56", "Caisson")
    )
  );
  assert.deepEqual(
    report.fiches.map((item) => [item.value, item.lines, item.refs]),
    [
      ["fr:442", [1, 2, 3], ["{109445:1,109417:1,105652:1}"]],
      ["fr:56", [4], ["106256"]],
    ]
  );
  assert.deepEqual(report.unmatched, []);
});

test("une seule reference d'un package ne le fait pas venir, et la ligne dit pourquoi elle n'est pas reconnue", () => {
  // Le pietement 105652 entre dans deux bureaux ; seul le plateau du premier est colle.
  const report = resolveImport(
    importLines("Pietement\t105652\t4\nCaisson\t106256"),
    index(
      fiche("{109445:1,105652:1}", "442", "Bureau bench"),
      fiche("{109431:1,105652:1}", "187", "Bureau droit"),
      fiche("106256", "56", "Caisson")
    )
  );
  assert.deepEqual(report.fiches.map((item) => item.value), ["fr:56"]);
  assert.deepEqual(report.unmatched, [{ line: 1, text: "Pietement\t105652\t4", partial: { parts: ["105652"], packages: 2 } }]);
});

test("deux bureaux complets qui partagent un pietement viennent tous les deux, sans etre « ambigus »", () => {
  const report = resolveImport(
    importLines("109445\n109431\n105652 x2"),
    index(fiche("{109445:1,105652:1}", "442", "Bureau bench"), fiche("{109431:1,105652:1}", "187", "Bureau droit"))
  );
  assert.deepEqual(report.fiches.map((item) => [item.value, item.lines]), [
    ["fr:442", [1, 3]],
    ["fr:187", [2, 3]],
  ]);
  assert.deepEqual(report.ambiguous, []);
});

test("un package tronque reste reconnaissable sur ses references entieres", () => {
  const report = resolveImport(
    importLines("103535\n102608"),
    index(fiche("{103535:1,102608:1,1034", "61", "Bureau d'angle"))
  );
  assert.deepEqual(report.fiches.map((item) => item.value), ["fr:61"]);
});

test("les caracteres invisibles d'un copier-coller ne cachent pas une reference", () => {
  assert.ok(importLines("Bureau\t\u200b109423\u200b\t2")[0].candidates.includes("109423"));
});

test("le plus grand package l'emporte : un composant vendu seul n'est pas ajoute, mais le rapport le nomme", () => {
  // Cas releve sur Acme : les pieds et la serrure du vestiaire ont leur propre fiche.
  const report = resolveImport(
    importLines("Vestiaire\t103655\nPieds inox\t102607\nSerrure\t103448\t9"),
    index(
      fiche("{103655:1,102607:1,103448:9}", "764", "Vestiaire multicases"),
      fiche("102607", "515", "Pieds Inox pour vestiaire"),
      fiche("103448", "741", "Serrure a code")
    )
  );
  assert.deepEqual(report.fiches.map((item) => item.value), ["fr:764"]);
  assert.deepEqual(
    report.included.map((item) => [item.name, item.refs, item.within]),
    [
      ["Pieds Inox pour vestiaire", ["102607"], "Vestiaire multicases"],
      ["Serrure a code", ["103448"], "Vestiaire multicases"],
    ]
  );
  assert.deepEqual(report.unmatched, []);
});

test("un package compris dans un plus grand est ecarte ; deux packages qui se recouvrent sans s'inclure restent", () => {
  const report = resolveImport(
    importLines("109384\n109357\n106929"),
    index(
      fiche("{109384:1,109357:1,106929:1}", "458", "Bench 3 personnes"),
      fiche("{109384:1,106929:1}", "461", "Bench 2 personnes"),
      fiche("109384", "461", "Bench 2 personnes")
    )
  );
  assert.deepEqual(report.fiches.map((item) => item.value), ["fr:458"]);
  // Un produit ecarte par deux de ses references n'est nomme qu'une fois.
  assert.deepEqual(
    report.included.map((item) => [item.name, item.refs]),
    [["Bench 2 personnes", ["{109384:1,106929:1}", "109384"]]]
  );
});

test("une fiche venue par un package n'est pas dite ecartee parce qu'un autre de ses packages l'est", () => {
  const report = resolveImport(
    importLines("109445\n109417\n105652"),
    index(
      fiche("{109445:1,109417:1,105652:1}", "442", "Bureau bench"),
      fiche("{109445:1,109417:1}", "442", "Bureau bench")
    )
  );
  assert.deepEqual(report.fiches.map((item) => item.value), ["fr:442"]);
  assert.deepEqual(report.included, []);
});
