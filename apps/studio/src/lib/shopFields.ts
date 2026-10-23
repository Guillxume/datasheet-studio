import { getPath } from "./mapping";

/**
 * L'identite de boutique, entre l'ecran et le contrat.
 *
 * TROIS FORMES DE LA MEME CHOSE, et c'est la source du defaut que ce module
 * ferme :
 *
 *   1. le contrat de rendu, IMBRIQUE — { name, url, colors: { primary } }
 *      (voir shopSchema dans src/lib/payload.ts) ;
 *   2. les reglages d'une boutique en base, imbriques eux aussi
 *      (shopSettingsSchema dans src/lib/shopsAdmin.ts) ;
 *   3. les champs de la page d'import, A PLAT — « colors.primary » est une cle
 *      de formulaire, parce qu'un formulaire n'a pas de profondeur.
 *
 * Les conversions 3 -> 1 et 2 -> 3 vivaient dans src/app/(studio)/import/ImportWizard.tsx,
 * ecrites a la main, et TOUTES DEUX enumeraient les champs de leur cote. Un
 * champ ajoute a la liste et oublie dans l'une des deux disparaissait
 * silencieusement de toutes les fiches d'un lot — aucune erreur, aucun
 * avertissement, juste une adresse manquante sur quatre cents PDF.
 *
 * CE MODULE SUPPRIME LA POSSIBILITE DU DEFAUT plutot que de le tester : les deux
 * conversions sont DERIVEES de `SHOP_FIELDS`. Ajouter une ligne a cette liste
 * suffit, les deux sens suivent. Les tests verifient l'aller-retour, mais c'est
 * la derivation qui protege.
 */

/**
 * La liste de reference. L'ordre est celui de l'affichage.
 *
 * `name` est le seul champ que le contrat exige (shopSchema) ; il ne vient pas
 * des reglages mais du nom de la boutique, d'ou son traitement a part dans
 * `shopFieldsFrom`.
 */
export const SHOP_FIELDS = [
  { key: "name", label: "Nom (obligatoire)", placeholder: "Contoso Equipment" },
  { key: "url", label: "URL", placeholder: "https://exemple.fr" },
  { key: "logo", label: "Logo", placeholder: "/assets/shared/logo" },
  { key: "colors.primary", label: "Couleur principale", placeholder: "#a8481a" },
  { key: "colors.secondary", label: "Couleur secondaire", placeholder: "#2e2b25" },
  { key: "company.address", label: "Adresse", placeholder: "" },
  { key: "company.phone", label: "Telephone", placeholder: "" },
  { key: "company.email", label: "Courriel", placeholder: "" },
  { key: "company.legal", label: "Mentions legales", placeholder: "" },
] as const;

export type ShopFieldKey = (typeof SHOP_FIELDS)[number]["key"];

/**
 * Les champs saisis a l'ecran, remis en forme de boutique du contrat.
 *
 * Les cles vides sont ECARTEES et non envoyees a vide : le schema du payload
 * traite l'absence et la chaine vide differemment, et un `company` peuple de
 * quatre chaines vides ferait imprimer un bloc de coordonnees vide plutot que
 * de l'effacer.
 */
export function shopSeed(fields: Record<string, string>): Record<string, unknown> {
  const shop: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string" || value.trim() === "") continue;

    const point = key.indexOf(".");
    if (point === -1) {
      shop[key] = value;
      continue;
    }

    // Un seul niveau d'imbrication : c'est tout ce que le contrat porte
    // (colors.*, company.*), et le supposer ici evite un constructeur de chemin
    // generique dont personne n'a l'usage.
    const parent = key.slice(0, point);
    const enfant = key.slice(point + 1);
    const groupe = (shop[parent] as Record<string, string>) ?? {};
    groupe[enfant] = value;
    shop[parent] = groupe;
  }

  return shop;
}

/**
 * L'inverse : une boutique et ses reglages, mis a plat dans les champs de l'ecran.
 *
 * DERIVEE DE `SHOP_FIELDS`, et c'est tout l'interet — la version precedente
 * enumerait les neuf champs a la main, et un dixieme ajoute ailleurs ne
 * remontait jamais jusqu'ici.
 */
export function shopFieldsFrom(shop: {
  name: string;
  settings?: Record<string, unknown> | null;
}): Record<string, string> {
  // `name` vient de la colonne, pas des reglages : on l'expose sous la meme
  // forme que le reste pour que la boucle n'ait pas de cas particulier.
  const source: Record<string, unknown> = { name: shop.name, ...(shop.settings ?? {}) };
  const fields: Record<string, string> = {};

  for (const { key } of SHOP_FIELDS) {
    const value = getPath(source, key);
    if (typeof value === "string" && value !== "") {
      fields[key] = value;
    }
  }

  return fields;
}
