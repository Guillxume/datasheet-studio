import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assemblePayload } from "../core/payload";
import type { CollectedProduct } from "../core/types";
import { CsvSource, type CsvSourceOptions } from "./source";

/**
 * Ce que ces assertions protegent : la convention « l'en-tete EST le chemin ».
 * Elle n'a d'interet que si elle tient sur les cas penibles — cellule vide,
 * image locale, image manquante, caracteristiques en colonnes ET en fichier
 * long — parce que c'est la que l'integrateur decouvrira qu'elle ne tient pas.
 */

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d494844520000000100000001080600000" + "01f15c4890000000a49444154789c6300010000050001",
  "hex"
);

async function withCsv(
  contents: Record<string, string | Buffer>,
  options: Partial<CsvSourceOptions>,
  run: (products: CollectedProduct[], dir: string) => Promise<void> | void
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "collect-csv-"));
  try {
    for (const [name, body] of Object.entries(contents)) {
      await writeFile(join(dir, name), body as never);
    }
    const source = new CsvSource({
      file: join(dir, "catalogue.csv"),
      listSeparator: "|",
      strict: false,
      ...options,
      // Les chemins d'options restent relatifs au repertoire courant, comme en
      // ligne de commande ; le test, lui, travaille dans un dossier temporaire.
      ...(options.featuresFile ? { featuresFile: join(dir, options.featuresFile) } : {}),
    });
    const products: CollectedProduct[] = [];
    for await (const product of source.list()) products.push(product);
    await run(products, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("l'en-tete est le chemin : le payload se construit sans table d'alias", async () => {
  await withCsv(
    {
      "catalogue.csv":
        "ref;product.name;product.sku;product.price.amount;product.category_path;badges;images.0.src;images.0.legend\n" +
        "TPM-2500;Transpalette 2500 kg;TPM-2500;489,00;Manutention|Transpalettes;ce|garantie:3ans;https://exemple.fr/a.jpg;Vue de face\n",
    },
    {},
    (products) => {
      assert.equal(products.length, 1);
      const [product] = products;
      assert.equal(product.ref, "TPM-2500");
      assert.equal(product.data.product.name, "Transpalette 2500 kg");
      // Le montant est normalise : "489,00" donnerait NaN cote Studio, donc un
      // prix vide sur la fiche, sans erreur nulle part.
      assert.equal(product.data.product.price?.amount, "489.00");
      assert.deepEqual(product.data.product.category_path, ["Manutention", "Transpalettes"]);
      assert.deepEqual(product.data.badges, ["ce", "garantie:3ans"]);
      assert.deepEqual(product.data.images, [
        { src: "https://exemple.fr/a.jpg", legend: "Vue de face" },
      ]);
      // Une URL publique n'a rien a faire dans le multipart.
      assert.equal(product.assets?.length, 0);
    }
  );
});

test("une cellule vide vaut champ ABSENT, pas champ vide", async () => {
  await withCsv(
    { "catalogue.csv": "ref;product.name;product.sku;product.brand\nA;Produit;;\n" },
    {},
    (products) => {
      const { product } = products[0].data;
      // Un `sku: ""` partirait tel quel jusque sur la fiche, sous forme d'un
      // libelle « Ref. » suivi de rien.
      assert.equal("sku" in product, false);
      assert.equal("brand" in product, false);
    }
  );
});

test("les colonnes feature: produisent des caracteristiques, avec leur lettre de renvoi", async () => {
  await withCsv(
    {
      "catalogue.csv":
        "ref;product.name;feature:Capacite de charge@Q;feature:Poids net;feature:Vide\n" +
        "A;Produit;2500 kg;78 kg;\n",
    },
    {},
    (products) => {
      assert.deepEqual(products[0].data.features, [
        { name: "Capacite de charge", value: "2500 kg", abbreviation: "Q" },
        { name: "Poids net", value: "78 kg" },
      ]);
    }
  );
});

test("le fichier long s'ajoute aux colonnes, joint sur la reference", async () => {
  await withCsv(
    {
      "catalogue.csv": "ref;product.name;feature:Norme\nA;Produit;EN ISO 3691-5\nB;Autre;\n",
      "specs.csv": "ref;name;value;abbreviation;group\nA;Roues;Polyurethane;D;Roulage\nA;Galets;Nylon;;Roulage\n",
    },
    { featuresFile: "specs.csv" },
    (products, dir) => {
      assert.ok(dir);
      assert.equal(products[0].data.features?.length, 3);
      assert.deepEqual(products[0].data.features?.[1], {
        name: "Roues",
        value: "Polyurethane",
        abbreviation: "D",
        group: "Roulage",
      });
      // La reference B n'a rien dans le fichier long : elle n'herite de rien.
      assert.equal(products[1].data.features, undefined);
    }
  );
});

test("un chemin d'image local devient une piece jointe asset://", async () => {
  await withCsv(
    {
      "catalogue.csv": "ref;product.name;images.0.src;shop.logo\nA;Produit;photo.png;logo.png\n",
      "photo.png": PNG,
      "logo.png": PNG,
    },
    {},
    (products) => {
      const [product] = products;
      assert.equal(product.data.images?.[0].src, product.assets?.[0].key ? `asset://${product.assets[0].key}` : "");
      assert.match(String(product.data.shop?.logo), /^asset:\/\//);
      assert.equal(product.assets?.length, 2);
      // L'empreinte de fraicheur suit taille+mtime : retoucher la photo sans
      // toucher au produit doit perimer la fiche.
      assert.match(String(product.assets?.[0].fingerprint), /^\d+:\d+$/);
    }
  );
});

test("une image introuvable coute l'image, pas la fiche", async () => {
  await withCsv(
    {
      "catalogue.csv":
        "ref;product.name;images.0.src;images.0.legend;images.1.src\nA;Produit;absente.png;Legende orpheline;https://exemple.fr/b.jpg\n",
    },
    {},
    (products) => {
      const [product] = products;
      assert.equal(product.warnings?.length, 1);
      assert.match(String(product.warnings?.[0]), /absente\.png/);
      // Sans nettoyage, il resterait un element {legend} sans src — refuse par
      // le schema — et un trou d'indice que JSON.stringify rendrait `null`.
      assert.deepEqual(product.data.images, [{ src: "https://exemple.fr/b.jpg" }]);
      assert.doesNotThrow(() =>
        assemblePayload({ product, template: "fiche", locale: "fr", shop: { name: "B" } })
      );
    }
  );
});

test("--strict fait echouer la ligne au lieu de perdre l'image", async () => {
  await assert.rejects(
    () =>
      withCsv(
        { "catalogue.csv": "ref;product.name;images.0.src\nA;Produit;absente.png\n" },
        { strict: true },
        () => undefined
      ),
    /absente\.png/
  );
});

test("--mapping traduit les en-tetes d'un export qu'on ne maitrise pas", async () => {
  await withCsv(
    { "catalogue.csv": "Reference;Designation;Prix HT\nTPM-2500;Transpalette;489,00\n" },
    {
      mapping: {
        Reference: "ref",
        Designation: "product.name",
        "Prix HT": "product.price.amount",
      },
    },
    (products) => {
      assert.equal(products[0].ref, "TPM-2500");
      assert.equal(products[0].data.product.name, "Transpalette");
      assert.equal(products[0].data.product.price?.amount, "489.00");
    }
  );
});

test("les colonnes template et locale pilotent la fiche, pas son contenu", async () => {
  await withCsv(
    { "catalogue.csv": "ref;product.name;template;locale\nA;Produit;fiche-speciale;es\n" },
    {},
    (products) => {
      assert.equal(products[0].template, "fiche-speciale");
      assert.equal(products[0].locale, "es");
      assert.equal("template" in products[0].data, false);
    }
  );
});

test("sans reference, on le dit : un numero de ligne n'est pas stable", async () => {
  await withCsv({ "catalogue.csv": "product.name\nProduit sans reference\n" }, {}, (products) => {
    assert.equal(products[0].ref, "ligne-2");
    // Inserer une ligne en tete du fichier decalerait tout et regenererait le
    // catalogue entier : l'avertissement existe pour que ca ne se decouvre pas
    // au troisieme passage.
    assert.match(String(products[0].warnings?.[0]), /aucune reference/);
  });
});

test("le produit du CSV d'exemple passe le schema du Studio", async () => {
  const source = new CsvSource({
    file: "collectors/csv/exemple.csv",
    featuresFile: "collectors/csv/exemple.features.csv",
    listSeparator: "|",
    strict: false,
  });

  let count = 0;
  for await (const product of source.list()) {
    count += 1;
    const payload = assemblePayload({
      product,
      template: "fiche-technique-01",
      locale: "fr",
      shop: { name: "Contoso Equipment" },
    });
    assert.equal(payload.data.product.name.length > 0, true);
  }
  assert.equal(count, 3);
});

// --- Ce qu'un export PrestaShop reel a impose --------------------------------

test("--where ecarte les lignes, et une colonne de filtre absente arrete tout", async () => {
  await withCsv(
    {
      "catalogue.csv": "ref;product.name;Actif\nA;Actif;1\nB;Retire de la vente;0\nC;Actif aussi;1\n",
    },
    { filters: [{ column: "Actif", negate: false, value: "1" }] },
    (products) => {
      // Sans filtre, un export PrestaShop rend aussi les produits desactives :
      // 409 sur les 1042 du fichier de reference.
      assert.deepEqual(products.map((product) => product.ref), ["A", "C"]);
    }
  );

  await assert.rejects(
    () =>
      withCsv(
        { "catalogue.csv": "ref;product.name\nA;Produit\n" },
        { filters: [{ column: "Actif", negate: false, value: "1" }] },
        () => undefined
      ),
    // Un filtre sur une colonne absente ecarterait TOUT en silence.
    /colonne absente/
  );
});

test("--mapping est une liste blanche : le reste de l'export ne part pas", async () => {
  await withCsv(
    {
      "catalogue.csv": "ID;Nom;Regle de taxe (ID);Meta titre\n41;Bureau;1;Bureau - Acme\n",
    },
    { mapping: { ID: "ref", Nom: "product.name" } },
    (products) => {
      // zod ecarte les cles inconnues en silence : sans liste blanche, ces
      // colonnes ne servent qu'a faire changer la cle de fraicheur pour rien.
      assert.deepEqual(Object.keys(products[0].data), ["product"]);
      assert.deepEqual(products[0].data.product, { name: "Bureau" });
    }
  );
});

test("sans mapping, une colonne hors contrat est ecartee et nommee", async () => {
  await withCsv(
    { "catalogue.csv": "ref;product.name;Meta titre\nA;Produit;Titre SEO\n" },
    {},
    (products) => {
      assert.deepEqual(Object.keys(products[0].data), ["product"]);
    }
  );
});

test("une cible de mapping accepte une transformation", async () => {
  await withCsv(
    {
      "catalogue.csv":
        'ref;Nom;Resume\nA;Produit;"<p>Accroche <strong>courte</strong>&nbsp;!</p>"\n',
    },
    {
      mapping: {
        ref: "ref",
        Nom: "product.name",
        Resume: "product.description_short | html2text",
      },
    },
    (products) => {
      // description_short est du TEXTE : y verser du HTML imprime les balises
      // sur la fiche, sans erreur ni avertissement.
      assert.equal(products[0].data.product.description_short, "Accroche courte !");
    }
  );
});

test("une colonne mappee sur features porte toute la liste PrestaShop", async () => {
  await withCsv(
    {
      "catalogue.csv":
        "ref;Nom;Caracteristiques\nA;Produit;Gamme:Panneaux:3,Epaisseur (cm):2,5:25\n",
    },
    {
      mapping: { ref: "ref", Nom: "product.name", Caracteristiques: "features" },
    },
    (products) => {
      assert.deepEqual(products[0].data.features, [
        { name: "Gamme", value: "Panneaux" },
        { name: "Epaisseur (cm)", value: "2,5" },
      ]);
    }
  );
});

test("le fichier de correspondance PrestaShop livre produit un payload valide", async () => {
  const mapping = JSON.parse(
    await readFile("collectors/csv/prestashop.mapping.json", "utf8")
  ) as Record<string, string>;

  await withCsv(
    {
      "catalogue.csv":
        "ID;Actif (0/1);Nom;Categories (x,y,z);Prix HT;Reference;Resume;Description;" +
        "Image URLs (x,y,z);Caracteristiques (Nom:Valeur:Position);Meta titre\n" +
        "41;1;Bureau Droit;\"Promo,Bureaux\";149.000000;41;<p>Accroche</p>;<p>Longue</p>;" +
        "\"https://ex.fr/a.jpg,https://ex.fr/b.jpg\";\"Gamme:Panneaux:3\";Titre SEO\n",
    },
    { mapping, listSeparator: "," },
    (products) => {
      const [product] = products;
      assert.equal(product.ref, "41");
      assert.equal(product.data.product.name, "Bureau Droit");
      assert.equal(product.data.product.price?.amount, "149.00");
      assert.equal(product.data.product.description_short, "Accroche");
      assert.equal(product.data.product.description_html, "<p>Longue</p>");
      assert.deepEqual(product.data.product.category_path, ["Promo", "Bureaux"]);
      assert.equal(product.data.images?.length, 2);
      assert.deepEqual(product.data.features, [{ name: "Gamme", value: "Panneaux" }]);

      assert.doesNotThrow(() =>
        assemblePayload({ product, template: "fiche", locale: "fr", shop: { name: "B" } })
      );
    }
  );
});
