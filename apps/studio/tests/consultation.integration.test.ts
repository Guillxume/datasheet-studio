import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "../src/lib/db";
import { generateApiKey } from "../src/lib/auth";
import {
  categoryIcons,
  categoryTree,
  datasheetsBySelection,
  hiddenCategories,
  hiddenDatasheets,
  indexLocales,
  listDatasheets,
  recordDatasheet,
  setCategoryHidden,
  setDatasheetsHidden,
  setCategoryIcon,
  supplierRefMatches,
  topCategories,
  type DatasheetEntry,
} from "../src/lib/datasheetsStore";

/**
 * L'index des fiches (/consultation), sur une VRAIE base.
 *
 * Ce que seule une base peut casser : la mise a jour sur conflit (une ligne par
 * produit et par langue, jamais deux), le COALESCE qui garde l'adresse quand un
 * rendu n'en porte pas, l'isolement entre boutiques sur lequel repose la
 * securite du zip, et une recherche qui ne doit pas interpreter « % ».
 *
 * Meme discipline que regles.integration.test.ts : des boutiques sous un
 * prefixe propre, et rien d'autre n'est touche — les fichiers tournent en
 * parallele.
 */

const P = "consultation-essai-";
const boutique = new Map<string, string>();

async function creerBoutique(nom: string): Promise<string> {
  const { prefix, hash } = generateApiKey();
  const slug = `${P}${nom}`;
  const rows = await sql<{ id: string }[]>`
    INSERT INTO shops (slug, name, api_key_prefix, api_key_hash)
    VALUES (${slug}, ${slug}, ${prefix}, ${hash})
    RETURNING id
  `;
  boutique.set(nom, rows[0].id);
  return rows[0].id;
}

function fiche(shop: string, override: Partial<DatasheetEntry> = {}): DatasheetEntry {
  return {
    shopId: boutique.get(shop)!,
    productKey: "901",
    locale: "fr",
    productId: "901",
    productRef: "901",
    productName: "Poteau de guidage noir",
    datasheetUrl: "https://boutique.exemple/fiche-technique/poteau-901.pdf",
    templateSlug: "fiche-produit-simple",
    templateVersion: 16,
    categoryPath: ["Meuble d'accueil", "Poteaux de Guidage"],
    variantSkus: null,
    supplierSkus: null,
    ...override,
  };
}

before(async () => {
  // Le CASCADE emporte les lignes d'index d'un passage interrompu.
  await sql`DELETE FROM shops WHERE slug LIKE ${`${P}%`}`;
  await creerBoutique("a");
  await creerBoutique("b");
});

after(async () => {
  await sql`DELETE FROM shops WHERE slug LIKE ${`${P}%`}`;
  await sql.end({ timeout: 5 });
});

test("un second rendu met a jour la ligne au lieu d'en ajouter une", async () => {
  await recordDatasheet(fiche("a"));
  await recordDatasheet(fiche("a", { productName: "Poteau de guidage noir mat", templateVersion: 17 }));

  const rows = await listDatasheets(`${P}a`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].product_name, "Poteau de guidage noir mat");
  assert.equal(rows[0].template_version, 17);
});

test("un rendu sans adresse ne fait pas perdre celle d'un rendu precedent", async () => {
  await recordDatasheet(fiche("a", { datasheetUrl: null }));
  const [row] = await listDatasheets(`${P}a`);
  assert.equal(row.datasheet_url, "https://boutique.exemple/fiche-technique/poteau-901.pdf");
});

test("une autre langue du meme produit est une autre ligne", async () => {
  await recordDatasheet(fiche("a", { locale: "es", productName: "Poste separador negro" }));
  const rows = await listDatasheets(`${P}a`);
  assert.deepEqual(rows.map((row) => row.locale).sort(), ["es", "fr"]);
});

test("une selection ne retrouve que les fiches de la boutique demandee", async () => {
  // Meme cle, meme langue, autre boutique : c'est exactement le cas qu'un
  // formulaire forge exploiterait pour faire telecharger les adresses d'un
  // autre site.
  await recordDatasheet(fiche("b", { datasheetUrl: "https://autre.exemple/901.pdf" }));

  const rows = await datasheetsBySelection(`${P}a`, [{ locale: "fr", productKey: "901" }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].datasheet_url, "https://boutique.exemple/fiche-technique/poteau-901.pdf");

  const nulle = await datasheetsBySelection(`${P}a`, [{ locale: "fr", productKey: "inexistant" }]);
  assert.equal(nulle.length, 0);
});

test("la recherche porte sur le nom, l'identifiant et la reference, et ne lit pas « % » comme un joker", async () => {
  await recordDatasheet(
    fiche("a", { productKey: "1304", productId: "1304", productRef: "JUNE-2", productName: "Fauteuil June" })
  );

  assert.deepEqual((await listDatasheets(`${P}a`, "june")).map((row) => row.product_key), ["1304"]);
  assert.deepEqual((await listDatasheets(`${P}a`, "1304")).map((row) => row.product_key), ["1304"]);
  assert.deepEqual((await listDatasheets(`${P}a`, "JUNE-2")).map((row) => row.product_key), ["1304"]);
  assert.equal((await listDatasheets(`${P}a`, "%")).length, 0);
});

test("la recherche trouve aussi une fiche par la reference d'une declinaison ou d'un fournisseur, et dit laquelle", async () => {
  await recordDatasheet(
    fiche("a", {
      productKey: "1410",
      productId: "1410",
      productRef: "VEST-2P",
      productName: "Vestiaire monobloc 2 portes",
      variantSkus: ["VEST-2P-BLEU", "VEST-2P-GRIS"],
      supplierSkus: ["FRN-88231", "ALT-552"],
    })
  );

  const parFournisseur = await listDatasheets(`${P}a`, "frn-88231");
  assert.deepEqual(parFournisseur.map((row) => row.product_key), ["1410"]);
  assert.equal(parFournisseur[0].matched_supplier_sku, "FRN-88231");
  assert.equal(parFournisseur[0].matched_variant_sku, null);

  const parDeclinaison = await listDatasheets(`${P}a`, "2P-GRIS");
  assert.deepEqual(parDeclinaison.map((row) => row.product_key), ["1410"]);
  assert.equal(parDeclinaison[0].matched_variant_sku, "VEST-2P-GRIS");

  // La reference exacte l'emporte sur une composition qui la contient et la
  // precede (cas reel du catalogue Acme).
  await recordDatasheet(
    fiche("a", {
      productKey: "187",
      productId: "187",
      productName: "Bureau droit",
      supplierSkus: ["{109423:1,105651:1}", "109423"],
    })
  );
  const exacte = await listDatasheets(`${P}a`, "109423");
  assert.equal(exacte.find((row) => row.product_key === "187")?.matched_supplier_sku, "109423");
  const partielle = await listDatasheets(`${P}a`, "105651");
  assert.equal(partielle.find((row) => row.product_key === "187")?.matched_supplier_sku, "{109423:1,105651:1}");

  // Sans recherche, rien n'a « repondu ».
  const tout = await listDatasheets(`${P}a`);
  assert.equal(tout.find((row) => row.product_key === "1410")?.matched_supplier_sku, null);
});

test("un rendu sans references garde celles d'avant ; une liste vide les efface", async () => {
  const cherche = async () => (await listDatasheets(`${P}a`, "ALT-552")).map((row) => row.product_key);

  await recordDatasheet(fiche("a", { productKey: "1410", productId: "1410", productName: "Vestiaire monobloc 2 portes" }));
  assert.deepEqual(await cherche(), ["1410"]);

  await recordDatasheet(
    fiche("a", { productKey: "1410", productId: "1410", productName: "Vestiaire monobloc 2 portes", supplierSkus: [] })
  );
  assert.deepEqual(await cherche(), []);
  // La liste des declinaisons, absente de ce rendu, n'a pas bouge.
  assert.deepEqual((await listDatasheets(`${P}a`, "VEST-2P-BLEU")).map((row) => row.product_key), ["1410"]);
});

test("le fil de categories est garde, et le tri par categorie met les produits sans categorie en dernier", async () => {
  await recordDatasheet(fiche("b", { productKey: "99", productId: "99", productName: "Zeta", categoryPath: ["Bureaux", "Angle"] }));
  await recordDatasheet(fiche("b", { productKey: "100", productId: "100", productName: "Alpha", categoryPath: [] }));
  await recordDatasheet(fiche("b", { productKey: "7", productId: "7", productName: "Beta", categoryPath: ["Accueil"] }));

  const parCategorie = await listDatasheets(`${P}b`, "", "categorie");
  assert.deepEqual(
    parCategorie.map((row) => row.category_path[0] ?? "-"),
    ["Accueil", "Bureaux", "Meuble d'accueil", "-"]
  );
  assert.deepEqual(parCategorie.find((row) => row.product_key === "99")?.category_path, ["Bureaux", "Angle"]);
});

test("le tri par identifiant suit l'ordre des nombres, pas celui des lettres", async () => {
  const parId = await listDatasheets(`${P}b`, "", "id");
  // « 99 » avant « 100 » ; l'ordre alphabetique les aurait inverses.
  assert.deepEqual(parId.map((row) => row.product_key), ["7", "99", "100", "901"]);
});

test("l'icone d'une categorie appartient a sa boutique", async () => {
  assert.equal(await setCategoryIcon(`${P}a`, "Bureaux", "lucide:briefcase"), true);
  assert.equal(await setCategoryIcon(`${P}a`, "Bureaux", "lucide:armchair"), true);
  assert.equal(await setCategoryIcon(`${P}inexistante`, "Bureaux", "lucide:armchair"), false);

  assert.equal((await categoryIcons(`${P}a`)).get("Bureaux"), "lucide:armchair");
  assert.equal((await categoryIcons(`${P}b`)).has("Bureaux"), false);
});

/*
 * Categories masquees (migration 014). Le piege a eviter : un masquage qui ne
 * vaudrait qu'a l'ecran. Une requete fabriquee a la main (zip, book) doit, elle
 * aussi, ignorer les fiches d'une categorie masquee.
 */
test("une categorie masquee sort de la liste, de la selection (zip, book) et des intercalaires — sous-categories comprises", async () => {
  await creerBoutique("c");
  const c = `${P}c`;
  await recordDatasheet(fiche("c", { productKey: "1", productName: "Casier", categoryPath: ["Vestiaires", "Casiers"] }));
  await recordDatasheet(fiche("c", { productKey: "2", productName: "Banc", categoryPath: ["Vestiaires", "Bancs"] }));
  await recordDatasheet(fiche("c", { productKey: "3", productName: "Bureau", categoryPath: ["Bureaux"] }));
  // Meme nom de sous-categorie dans une autre branche : ne doit pas etre touche.
  await recordDatasheet(fiche("c", { productKey: "4", productName: "Caisson", categoryPath: ["Bureaux", "Casiers"] }));
  const tout = ["1", "2", "3", "4"].map((productKey) => ({ locale: "fr", productKey }));
  const cles = async () => (await listDatasheets(c)).map((row) => row.product_key).sort();

  // Une sous-categorie : seule elle sort, pas son homonyme d'une autre branche.
  assert.equal(await setCategoryHidden(c, ["Vestiaires", "Casiers"], true, null), true);
  assert.deepEqual(await cles(), ["2", "3", "4"]);

  // La categorie entiere : ses sous-categories avec.
  await setCategoryHidden(c, ["Vestiaires"], true, null);
  assert.deepEqual(await cles(), ["3", "4"]);
  assert.deepEqual((await datasheetsBySelection(c, tout)).map((row) => row.product_key).sort(), ["3", "4"]);
  assert.deepEqual((await topCategories(c)).map((row) => row.category), ["Bureaux"]);

  // L'arbre de reglage montre tout, avec l'etat de chaque noeud.
  const arbre = await categoryTree(c);
  const noeud = (path: string[]) => arbre.find((node) => JSON.stringify(node.path) === JSON.stringify(path));
  assert.deepEqual(arbre.map((node) => node.path.join(" > ")), [
    "Bureaux",
    "Bureaux > Casiers",
    "Vestiaires",
    "Vestiaires > Bancs",
    "Vestiaires > Casiers",
  ]);
  assert.equal(noeud(["Vestiaires"])?.count, 2);
  assert.equal(noeud(["Vestiaires"])?.hidden, true);
  assert.equal(noeud(["Vestiaires", "Bancs"])?.hiddenByParent, true);
  assert.equal(noeud(["Bureaux", "Casiers"])?.hidden, false);

  // Les autres boutiques ne sont pas concernees.
  assert.deepEqual(await hiddenCategories(`${P}a`), []);

  // Reafficher rend les fiches telles quelles : rien n'avait ete supprime.
  await setCategoryHidden(c, ["Vestiaires"], false, null);
  await setCategoryHidden(c, ["Vestiaires", "Casiers"], false, null);
  assert.deepEqual(await cles(), ["1", "2", "3", "4"]);
  assert.equal(await setCategoryHidden(`${P}inexistante`, ["X"], true, null), false);
});

test("une categorie masquee qui n'a plus de fiches reste listee, pour pouvoir la reafficher", async () => {
  const c = `${P}c`;
  await setCategoryHidden(c, ["Ancienne categorie"], true, null);
  const fantome = (await categoryTree(c)).find((node) => node.path[0] === "Ancienne categorie");
  assert.equal(fantome?.count, 0);
  assert.equal(fantome?.hidden, true);
  await setCategoryHidden(c, ["Ancienne categorie"], false, null);
});

/*
 * Fiches masquees une a une (migration 015) : meme regle que les categories —
 * le filtre vaut pour la liste, la selection (zip, book) et les intercalaires,
 * et pour toutes les langues du produit.
 */
test("une fiche masquee sort de la liste et de la selection, dans toutes ses langues", async () => {
  await creerBoutique("d");
  const d = `${P}d`;
  await recordDatasheet(fiche("d", { productKey: "10", productName: "Armoire", categoryPath: ["Rangement"] }));
  await recordDatasheet(fiche("d", { productKey: "10", locale: "es", productName: "Armario", categoryPath: ["Rangement"] }));
  await recordDatasheet(fiche("d", { productKey: "11", productName: "Etagere", categoryPath: ["Rangement"] }));
  await recordDatasheet(fiche("d", { productKey: "12", productName: "Vitrine", categoryPath: ["Expo"], datasheetUrl: null }));
  const cles = async () => (await listDatasheets(d)).map((row) => `${row.locale}:${row.product_key}`).sort();

  assert.equal(await setDatasheetsHidden(d, ["10", "12"], true, null), true);
  assert.deepEqual(await cles(), ["fr:11"]);
  const forcee = await datasheetsBySelection(d, [
    { locale: "fr", productKey: "10" },
    { locale: "es", productKey: "10" },
    { locale: "fr", productKey: "11" },
  ]);
  assert.deepEqual(forcee.map((row) => `${row.locale}:${row.product_key}`), ["fr:11"]);
  // « Expo » n'avait que la vitrine : plus d'intercalaire a proposer.
  assert.deepEqual((await topCategories(d)).map((row) => row.category), ["Rangement"]);

  // La liste des masquees nomme les produits, une ligne par produit.
  const masquees = await hiddenDatasheets(d);
  assert.deepEqual(masquees.map((item) => item.productKey), ["10", "12"]);
  assert.ok(["Armoire", "Armario"].includes(masquees[0].productName ?? ""));

  // Masquer deux fois ne double rien ; reafficher rend tout.
  await setDatasheetsHidden(d, ["10"], true, null);
  assert.equal((await hiddenDatasheets(d)).length, 2);
  await setDatasheetsHidden(d, ["10", "12"], false, null);
  assert.deepEqual(await cles(), ["es:10", "fr:10", "fr:11", "fr:12"]);
  assert.equal(await setDatasheetsHidden(`${P}inexistante`, ["10"], true, null), false);
});

test("un produit masque qui a quitte l'index reste liste, pour pouvoir le reafficher", async () => {
  const d = `${P}d`;
  await setDatasheetsHidden(d, ["disparu"], true, null);
  const item = (await hiddenDatasheets(d)).find((entry) => entry.productKey === "disparu");
  assert.equal(item?.productName, null);
  await setDatasheetsHidden(d, ["disparu"], false, null);
});

test("l'import retrouve une fiche par egalite de reference fournisseur — casse et espaces ignores, jamais une sous-chaine", async () => {
  await creerBoutique("e");
  const e = `${P}e`;
  await recordDatasheet(fiche("e", { productKey: "187", productName: "Bureau droit", supplierSkus: ["109423", "TPM  2500 L"] }));
  await recordDatasheet(fiche("e", { productKey: "442", productName: "Bureau bench", supplierSkus: ["105651"] }));
  await recordDatasheet(fiche("e", { productKey: "187", locale: "es", productName: "Mesa recta", supplierSkus: ["109423"] }));
  await recordDatasheet(fiche("b", { productKey: "187", productName: "Autre boutique", supplierSkus: ["109423"] }));

  const cles = async (refs: string[], locale = "fr") =>
    (await supplierRefMatches(e, locale, refs)).map((row) => `${row.locale}:${row.product_key}:${row.ref}`);

  assert.deepEqual(await cles(["109423"]), ["fr:187:109423"]);
  // La reference de l'index est normalisee comme le collage : « TPM  2500 L » (deux espaces).
  assert.deepEqual(await cles(["tpm 2500 l"]), ["fr:187:TPM  2500 L"]);
  // Egalite : un morceau plus court n'est pas la reference.
  assert.deepEqual(await cles(["10942", "09423"]), []);
  assert.deepEqual(await cles(["109423"], "es"), ["es:187:109423"]);

  // Une fiche masquee n'existe pas pour l'import.
  await setDatasheetsHidden(e, ["442"], true, null);
  assert.deepEqual(await cles(["105651"]), []);
  await setDatasheetsHidden(e, ["442"], false, null);
  assert.deepEqual(await cles(["105651"]), ["fr:442:105651"]);

  // Les langues de l'index, la plus fournie d'abord, et combien portent des references.
  await recordDatasheet(fiche("e", { productKey: "900", productName: "Sans reference", supplierSkus: [] }));
  assert.deepEqual(await indexLocales(e), [
    { locale: "fr", count: 3, withSupplierRefs: 2 },
    { locale: "es", count: 1, withSupplierRefs: 1 },
  ]);
});

test("l'import recoit aussi les packages dont une reference est citee — le tri fin est fait ensuite", async () => {
  await creerBoutique("f");
  const f = `${P}f`;
  await recordDatasheet(
    fiche("f", { productKey: "442", productName: "Bureau bench", supplierSkus: ["{109445:1,109417:1,105652:1}", "121559"] })
  );
  await recordDatasheet(fiche("f", { productKey: "61", productName: "Bureau d'angle", supplierSkus: ["{103535:1,102608:1,1034"] }));
  await recordDatasheet(fiche("f", { productKey: "77", productName: "Etagere", supplierSkus: ["ABC:12"] }));

  const refs = async (wanted: string[]) =>
    (await supplierRefMatches(f, "fr", wanted)).map((row) => `${row.product_key}:${row.ref}`).sort();

  // Une seule reference du package suffit a le remonter ; resolveImport exigera les autres.
  assert.deepEqual(await refs(["105652"]), ["442:{109445:1,109417:1,105652:1}"]);
  // Package tronque par PrestaShop : ses references entieres le trouvent.
  assert.deepEqual(await refs(["102608"]), ["61:{103535:1,102608:1,1034"]);
  // Une fin de package sans son debut n'est pas un package.
  await recordDatasheet(fiche("f", { productKey: "438", productName: "Armoire", supplierSkus: [",122815:1}"] }));
  assert.deepEqual(await refs(["122815"]), []);
  // Une reference simple avec un deux-points n'est pas un package.
  assert.deepEqual(await refs(["abc"]), []);
  assert.deepEqual(await refs(["abc:12"]), ["77:ABC:12"]);
  // Les quantites ne sont pas des references.
  assert.deepEqual(await refs(["1"]), []);
});
