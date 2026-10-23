import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRequestSchema } from "./payload";
import {
  csvRecord,
  jsonRecord,
  mapRecord,
  suggestTarget,
  TARGET_GROUPS,
  type MappingTable,
} from "./importMapping";

/**
 * Ce que ces assertions protegent : que la page d'import et le collecteur CSV
 * produisent le MEME payload.
 *
 * Les regles du CSV sont deja eprouvees par collectors/csv/source.test.ts, qui
 * passe par ce module depuis qu'il en est le seul detenteur. Ce fichier-ci
 * couvre ce que le CSV ne peut pas atteindre : la source JSON, les expressions
 * multiples, le fond de boutique commun, et le fait que les cibles proposees a
 * l'ecran existent vraiment dans le contrat.
 */

const csv = (headers: string[], row: string[]) => csvRecord(headers, row);

test("une ligne de CSV et le meme enregistrement en JSON donnent le meme payload", async () => {
  const table: MappingTable = {
    ref: "ref",
    "product.name": "product.name",
    "product.price.amount": "product.price.amount",
  };

  const fromCsv = await mapRecord(
    csv(["ref", "product.name", "product.price.amount"], ["A-1", "Etabli", "489,00"]),
    table
  );
  const fromJson = await mapRecord(
    jsonRecord({ ref: "A-1", product: { name: "Etabli", price: { amount: "489,00" } } }),
    {
      ref: "ref",
      "product.name": "product.name",
      "product.price.amount": "product.price.amount",
    }
  );

  assert.deepEqual(fromCsv.data, fromJson.data);
  assert.equal(fromCsv.ref, fromJson.ref);
  // Normalise dans les deux cas : "489,00" tel quel donnerait NaN au formatage,
  // donc un prix vide sur la fiche, sans erreur nulle part.
  assert.equal(fromCsv.data.product && (fromCsv.data.product as { price: { amount: string } }).price.amount, "489.00");
});

test("une expression a [] alimente une liste entiere ou un element par indice", async () => {
  const mapped = await mapRecord(
    jsonRecord({
      familles: [{ libelle: "Manutention" }, { libelle: "Transpalettes" }],
      medias: [
        { url: "https://ex.fr/a.jpg", legende: "Face" },
        { url: "https://ex.fr/b.jpg" },
        { url: "https://ex.fr/c.jpg", legende: "Detail" },
      ],
      nom: "Transpalette",
    }),
    {
      nom: "product.name",
      "familles[].libelle": "product.category_path",
      "medias[].url": "images[].src",
      "medias[].legende": "images[].legend",
    }
  );

  assert.deepEqual(mapped.data.product, { name: "Transpalette", category_path: ["Manutention", "Transpalettes"] });
  // L'appariement se fait PAR INDICE : la legende du troisieme media doit
  // rester sur le troisieme, alors que le deuxieme n'en a pas.
  assert.deepEqual(mapped.data.images, [
    { src: "https://ex.fr/a.jpg", legend: "Face" },
    { src: "https://ex.fr/b.jpg" },
    { src: "https://ex.fr/c.jpg", legend: "Detail" },
  ]);
});

test("un trou dans la liste d'images ne decale pas les legendes suivantes", async () => {
  // Le cas qui casse une implementation qui « nettoie » avant d'apparier : le
  // deuxieme media n'a pas d'URL, sa legende ne doit pas remonter sur lui.
  const mapped = await mapRecord(
    jsonRecord({
      medias: [{ url: "https://ex.fr/a.jpg" }, { legende: "Orpheline" }, { url: "https://ex.fr/c.jpg", legende: "Detail" }],
    }),
    { "medias[].url": "images[].src", "medias[].legende": "images[].legend" }
  );

  assert.deepEqual(mapped.data.images, [
    { src: "https://ex.fr/a.jpg" },
    { src: "https://ex.fr/c.jpg", legend: "Detail" },
  ]);
});

test("le fond commun est depose avant le mapping : la source gagne", async () => {
  const mapped = await mapRecord(
    csv(["Nom", "Site"], ["Etabli", "https://globex.example"]),
    { Nom: "product.name", Site: "shop.url" },
    { seed: { shop: { name: "Globex", url: "https://defaut.example" } } }
  );

  assert.deepEqual(mapped.data.shop, { name: "Globex", url: "https://globex.example" });
});

test("le fond commun n'est pas partage entre deux fiches", async () => {
  // Deposer la MEME reference dans deux payloads ferait qu'une colonne
  // shop.company.phone contaminerait les fiches suivantes, en silence.
  const seed = { shop: { name: "Globex", company: { phone: "01" } } };
  const first = await mapRecord(csv(["Tel"], ["02"]), { Tel: "shop.company.phone" }, { seed });
  const second = await mapRecord(csv(["Tel"], [""]), { Tel: "shop.company.phone" }, { seed });

  assert.equal((first.data.shop as { company: { phone: string } }).company.phone, "02");
  assert.equal((second.data.shop as { company: { phone: string } }).company.phone, "01");
});

test("sans resolveur, seules les references distantes traversent", async () => {
  // C'est le cas du navigateur sans dossier d'images : un nom de fichier local
  // n'y designe rien, et le laisser passer donnerait une reference que le
  // Studio refuse.
  const mapped = await mapRecord(
    csv(["images"], ["https://ex.fr/a.jpg|photo-locale.jpg|data:image/png;base64,AA"]),
    { images: "images" }
  );

  assert.deepEqual(mapped.data.images, [
    { src: "https://ex.fr/a.jpg" },
    { src: "data:image/png;base64,AA" },
  ]);
});

test("le resolveur d'images est appele en serie, et son refus coute l'image", async () => {
  const seen: string[] = [];
  const mapped = await mapRecord(csv(["images"], ["a.jpg|absente.jpg|b.jpg"]), { images: "images" }, {
    resolveImage: (raw) => {
      seen.push(raw);
      return raw === "absente.jpg" ? undefined : `asset://${raw}`;
    },
  });

  assert.deepEqual(seen, ["a.jpg", "absente.jpg", "b.jpg"]);
  assert.deepEqual(mapped.data.images, [{ src: "asset://a.jpg" }, { src: "asset://b.jpg" }]);
});

test("--strict fait echouer la fiche au lieu de perdre l'image", async () => {
  await assert.rejects(
    () =>
      mapRecord(csv(["images.0.src"], ["absente.jpg"]), { "images.0.src": "images.0.src" }, {
        resolveImage: () => undefined,
        strict: true,
      }),
    /absente\.jpg/
  );
});

test("un nombre JSON devient une chaine la ou le contrat en attend une", async () => {
  // Sinon la validation echoue sur « expected string, received number », un
  // message que personne ne rapporte a la colonne fautive.
  const mapped = await mapRecord(jsonRecord({ sku: 41, largeur: 120, nom: "Bureau" }), {
    nom: "product.name",
    sku: "product.sku",
    largeur: "images.0.width",
  });

  assert.equal((mapped.data.product as { sku: unknown }).sku, "41");
});

test("une reference de repli est signalee, parce qu'elle n'est pas stable", async () => {
  const mapped = await mapRecord(csv(["product.name"], ["Sans reference"]), {
    "product.name": "product.name",
  }, { fallbackRef: "ligne-4" });

  assert.equal(mapped.ref, "ligne-4");
  assert.equal(mapped.refIsFallback, true);
  assert.match(mapped.warnings[0], /aucune reference/);

  // product.sku prend le relais avant le repli.
  const withSku = await mapRecord(csv(["product.sku"], ["TPM-2500"]), {
    "product.sku": "product.sku",
  }, { fallbackRef: "ligne-4" });
  assert.equal(withSku.ref, "TPM-2500");
  assert.equal(withSku.refIsFallback, false);
});

test("suggestTarget n'accepte que l'identite, jamais un alias", async () => {
  assert.equal(suggestTarget("product.name"), "product.name");
  assert.equal(suggestTarget("feature:Capacite@Q"), "feature:Capacite@Q");
  assert.equal(suggestTarget("ref"), "ref");
  // « Description » est-elle description_html ou description_short ? Deviner
  // change le rendu et rien ne signalerait l'erreur.
  assert.equal(suggestTarget("Description"), "");
  assert.equal(suggestTarget("Meta titre"), "");
  // Une expression JSON multiple n'est pas un champ du contrat.
  assert.equal(suggestTarget("medias[].url"), "");
});

test("les cibles proposees a l'ecran produisent un payload que le contrat accepte", async () => {
  /*
   * TARGET_GROUPS est un miroir manuel de payload.ts : rien n'empeche d'y
   * ecrire « product.titre ». Le seul controle possible est d'alimenter chaque
   * cible et de soumettre le resultat au schema du serveur.
   */
  const table: MappingTable = {};
  const headers: string[] = [];
  const row: string[] = [];

  for (const { targets } of TARGET_GROUPS) {
    for (const { path } of targets) {
      // Les cibles de pilotage ne sont pas des champs de `data`, et les deux
      // ecritures d'images ("images" et "images[].src") se marcheraient dessus.
      if (path === "template" || path === "locale" || path.includes("[]")) continue;
      const header = `col:${path}`;
      headers.push(header);
      table[header] = path;
      row.push(sampleFor(path));
    }
  }

  const mapped = await mapRecord(csvRecord(headers, row), table, {
    resolveImage: (raw) => raw,
  });

  const parsed = renderRequestSchema.safeParse({
    template: "fiche-technique-01",
    locale: "fr",
    data: mapped.data,
  });

  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues, null, 2));
});

function sampleFor(path: string): string {
  if (path === "product.price.amount") return "489,00";
  if (path === "product.price.tax_included") return "1";
  if (path === "features") return "Gamme:Panneaux:3";
  if (path === "badges" || path === "product.category_path" || path.endsWith("_skus")) return "un|deux";
  if (path === "images" || path.endsWith(".src") || path === "schema_image" || path === "qr_code") {
    return "https://exemple.fr/a.jpg";
  }
  if (path === "shop.logo") return "https://exemple.fr/logo.png";
  return "valeur";
}
