import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assetKeyFor,
  buildReportCsv,
  detectItemsPath,
  discoverJsonColumns,
  findImageFile,
  imageMime,
  indexImageFolder,
  itemsAt,
  pdfFilename,
} from "./importCatalog";

test("le tableau d'elements se trouve tout seul dans les formes courantes", () => {
  assert.equal(detectItemsPath([{ a: 1 }]), "");
  assert.equal(detectItemsPath({ items: [{ a: 1 }] }), "items");
  assert.equal(detectItemsPath({ data: { products: [{ a: 1 }] } }), "data.products");
  // Un tableau d'OBJETS, pas le premier tableau venu.
  assert.equal(detectItemsPath({ tags: ["a", "b"], produits: [{ a: 1 }] }), "produits");
  assert.equal(detectItemsPath({ total: 3, page: 1 }), null);
});

test("itemsAt rend un tableau vide plutot que d'exploser sur un chemin faux", () => {
  assert.deepEqual(itemsAt({ items: [{ a: 1 }] }, "items"), [{ a: 1 }]);
  assert.deepEqual(itemsAt({ items: [{ a: 1 }] }, "articles"), []);
});

test("les chemins JSON couvrent plusieurs enregistrements, et les tableaux portent []", () => {
  const columns = discoverJsonColumns([
    { id: 1, nom: "Etabli", medias: [{ url: "a.jpg" }], marque: { nom: "Fabrikam" } },
    // Le deuxieme enregistrement seul porte la legende et les tags : ne
    // regarder que le premier priverait le mapping de colonnes qui existent.
    { id: 2, nom: "Bureau", medias: [{ url: "b.jpg", legende: "Face" }], tags: ["promo"] },
  ]);

  assert.deepEqual(columns.sort(), [
    "id",
    "marque.nom",
    "medias[].legende",
    "medias[].url",
    "nom",
    "tags[]",
  ]);
});

test("le nom de fiche est sur pour le systeme de fichiers, et reste distinct", () => {
  const taken = new Set<string>();

  assert.equal(pdfFilename("TPM-2500", taken), "TPM-2500.pdf");
  // « 40/60 » et « 4060 » sont deux references : la barre est remplacee, pas
  // retiree.
  assert.equal(pdfFilename("40/60", taken), "40-60.pdf");
  assert.equal(pdfFilename("Etabli 2 m", taken), "Etabli-2-m.pdf");
  // Les accents restent : l'archive arme le drapeau UTF-8.
  assert.equal(pdfFilename("Établi", taken), "Établi.pdf");
  assert.equal(pdfFilename("", taken), "fiche.pdf");

  // Deux lignes qui portent la meme reference : sans suffixe, la seconde fiche
  // ecraserait la premiere dans l'archive, en silence.
  assert.equal(pdfFilename("TPM-2500", taken), "TPM-2500-2.pdf");
  assert.equal(pdfFilename("TPM-2500", taken), "TPM-2500-3.pdf");
  // La comparaison ignore la casse : Windows aussi.
  assert.equal(pdfFilename("tpm-2500", taken), "tpm-2500-4.pdf");
});

test("le compte rendu s'ouvre dans un tableur sans se casser", () => {
  const csv = buildReportCsv([
    { ref: "A", line: 2, status: "ok", file: "A.pdf", warnings: [] },
    {
      ref: "B;bis",
      line: 3,
      status: "echec",
      file: "",
      warnings: ["image introuvable : a.jpg"],
      error: 'Chromium a dit "non"',
    },
  ]);

  assert.equal(csv.startsWith("﻿"), true, "BOM, sinon Excel abime les accents");
  // `trim` mange le BOM, qui est un espace au sens d'Unicode : il est verifie
  // au-dessus, pas ici.
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "ref;ligne;statut;fichier;avertissements;erreur");
  assert.equal(lines[1], "A;2;ok;A.pdf;;");
  // Le point-virgule dans une valeur, et le guillemet dans l'erreur.
  assert.equal(lines[2], '"B;bis";3;echec;;image introuvable : a.jpg;"Chromium a dit ""non"""');
});

test("un dossier d'images se retrouve par chemin relatif comme par nom seul", () => {
  const withPath = (name: string, relative: string) =>
    Object.assign(new File(["x"], name, { type: "image/jpeg" }), {
      webkitRelativePath: relative,
    });

  const index = indexImageFolder([
    withPath("tpm.jpg", "photos/produits/tpm.jpg"),
    withPath("logo.png", "photos/logo.png"),
  ]);

  // Un export ecrit indifferemment l'une ou l'autre forme.
  assert.equal(findImageFile(index, "produits/tpm.jpg")?.name, "tpm.jpg");
  assert.equal(findImageFile(index, "tpm.jpg")?.name, "tpm.jpg");
  assert.equal(findImageFile(index, "./TPM.JPG")?.name, "tpm.jpg");
  assert.equal(findImageFile(index, "photos\\logo.png")?.name, "logo.png");
  assert.equal(findImageFile(index, "absente.jpg"), undefined);
});

test("le type d'une image se rattrape sur l'extension", () => {
  // File.type arrive vide quand le systeme ne connait pas l'extension ; la
  // route de rendu refuserait alors la piece jointe avec un 415.
  assert.equal(imageMime(new File([""], "photo.JPG", { type: "" })), "image/jpeg");
  assert.equal(imageMime(new File([""], "schema.svg", { type: "image/svg+xml" })), "image/svg+xml");
  assert.equal(imageMime(new File([""], "notice.pdf", { type: "application/pdf" })), null);
});

test("la cle de piece jointe est derivee du nom, et reste utilisable telle quelle", () => {
  // Elle voyage dans "asset://<cle>" et dans le nom de champ du multipart.
  assert.equal(assetKeyFor("photos/Vue de face.JPG"), "vue-de-face.jpg");
  assert.equal(assetKeyFor("../a b/c.png"), "c.png");
  assert.match(assetKeyFor("photos/"), /^image$/);
});
