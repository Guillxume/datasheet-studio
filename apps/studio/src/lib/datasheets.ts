/**
 * L'index des fiches techniques — la partie pure, sans base ni reseau.
 *
 * Ce qui vit ici peut se tromper sans que rien ne le signale : une cle qui ne
 * retrouve pas sa ligne fait disparaitre une fiche du zip, deux noms identiques
 * font qu'un PDF en ecrase un autre a l'extraction. D'ou un module a part, teste
 * (datasheets.test.ts). L'acces base est dans datasheetsStore.ts.
 */

/** Au-dela, un zip se compte en centaines de megaoctets et en minutes de telechargement. */
export const MAX_SELECTION = 200;

/**
 * Cle d'un produit dans l'index : son identifiant, ou a defaut sa reference.
 *
 * `product.id` est facultatif dans le contrat. Une ligne sans cle ne pourrait
 * ni etre mise a jour au rendu suivant, ni etre selectionnee : le produit n'est
 * alors pas indexe (null), plutot qu'indexe sous une cle vide que tous les
 * produits sans identifiant partageraient.
 */
export function productKeyOf(product: { id?: string | number | null; sku?: string | null }): string | null {
  const id = product.id === undefined || product.id === null ? "" : String(product.id).trim();
  if (id !== "") return id;
  const sku = (product.sku ?? "").trim();
  return sku !== "" ? sku : null;
}

/** Au-dela, ce n'est plus un produit mais un export mal borne : l'index n'en garde que le debut. */
export const MAX_INDEXED_REFS = 1000;
/** Une reference PrestaShop tient en 64 caracteres ; au-dela, ce n'est pas une reference. */
const MAX_REF_LENGTH = 200;

/**
 * Les references de declinaison ou fournisseur d'un produit, telles que l'index
 * les garde : sans blanc autour, sans doublon (a la casse pres — la recherche
 * l'ignore), dans l'ordre recu.
 *
 * `null` quand le payload n'en porte pas : l'index garde alors celles d'un rendu
 * precedent. Un tableau vide, lui, les efface — voir payload.ts.
 *
 * ON TRONQUE, ON NE REFUSE PAS : ces champs ne servent qu'a l'index, et une
 * liste demesuree ne doit pas faire echouer la fiche que la boutique attend.
 */
export function indexedRefs(values: readonly string[] | null | undefined): string[] | null {
  if (values === null || values === undefined) return null;
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const value of values) {
    const ref = value.trim();
    const key = ref.toLowerCase();
    if (ref === "" || ref.length > MAX_REF_LENGTH || seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
    if (refs.length === MAX_INDEXED_REFS) break;
  }
  return refs;
}

/**
 * Valeur d'une case a cocher : la langue, puis la cle du produit.
 *
 * LA LANGUE EN PREMIER, parce qu'elle ne contient jamais de deux-points alors
 * que la cle peut en contenir (une reference « ABC:12 » existe). On coupe donc
 * au PREMIER separateur.
 */
export function selectionValue(locale: string, productKey: string): string {
  return `${locale}:${productKey}`;
}

export function parseSelection(value: string): { locale: string; productKey: string } | null {
  const at = value.indexOf(":");
  if (at <= 0 || at === value.length - 1) return null;
  return { locale: value.slice(0, at), productKey: value.slice(at + 1) };
}

/**
 * Une adresse de fiche utilisable : http ou https, et rien d'autre.
 *
 * Elle vient du payload de la boutique. Le Studio ira la telecharger pour
 * composer un zip : un `file://` ou un `javascript:` n'a rien a faire dans
 * l'index, et le lien de la page ne doit pas pouvoir en devenir un.
 */
export function usableUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Nom lisible et sans risque dans une archive : minuscules, sans accent ni separateur. */
export function slugifyName(value: string, max = 80): string {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, max).replace(/-+$/, "") || "fiche";
}

/**
 * Noms des fichiers du zip, garantis distincts.
 *
 * Le nom porte la cle du produit, mais deux lignes peuvent quand meme se
 * rencontrer : le meme produit en deux langues. La langue n'est ajoutee que
 * dans ce cas — un lot d'une seule langue garde des noms courts. Un doublon qui
 * subsisterait (cle tronquee, collision improbable) recoit un suffixe : a
 * l'extraction, deux fichiers de meme nom, c'est une fiche perdue sans message.
 */
export function zipEntryNames(rows: { productKey: string; productName: string; locale: string }[]): string[] {
  const locales = new Set(rows.map((row) => row.locale));
  const used = new Set<string>();

  return rows.map((row) => {
    const base = `fiche-technique-${slugifyName(row.productName)}-${slugifyName(row.productKey, 40)}`;
    const stem = locales.size > 1 ? `${base}-${slugifyName(row.locale, 10)}` : base;

    let name = `${stem}.pdf`;
    for (let n = 2; used.has(name); n++) name = `${stem}-${n}.pdf`;
    used.add(name);
    return name;
  });
}

/**
 * Le contenu est-il un PDF ? Les quatre premiers octets suffisent.
 *
 * Une boutique qui a retire un produit renvoie souvent une page HTML en 200
 * (accueil, page d'erreur du theme) et non un 404. Sans ce controle, le zip
 * contiendrait un « .pdf » illisible, et rien ne le dirait avant qu'on l'ouvre.
 */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/**
 * Les tris de /consultation. « categorie » est le seul qui regroupe : la liste y
 * est decoupee par categorie de niveau 1, chaque groupe ouvert par un
 * intercalaire. C'est le tri par defaut, parce que c'est ainsi qu'on cherche une
 * fiche dans un catalogue — par famille avant de chercher un nom.
 */
export const SORTS = [
  { value: "categorie", label: "Catégorie" },
  { value: "nom", label: "Nom (A → Z)" },
  { value: "id", label: "Identifiant" },
  { value: "date", label: "Dernière génération" },
] as const;

export type SortKey = (typeof SORTS)[number]["value"];
export const DEFAULT_SORT: SortKey = "categorie";

/** Une valeur d'URL inconnue retombe sur le tri par defaut plutot que d'echouer. */
export function parseSort(value: string | null | undefined): SortKey {
  return SORTS.some((sort) => sort.value === value) ? (value as SortKey) : DEFAULT_SORT;
}

/** Libelle du groupe des produits sans categorie : trie en dernier, quoi qu'il arrive. */
export const NO_CATEGORY = "Sans catégorie";

/**
 * La categorie de NIVEAU 1 : la premiere du fil, la plus generale (le module
 * envoie le fil de la racine vers la feuille, racine exclue).
 */
export function topCategory(path: readonly string[] | null | undefined): string {
  const first = (path ?? []).map((name) => name.trim()).find((name) => name !== "");
  return first ?? NO_CATEGORY;
}
