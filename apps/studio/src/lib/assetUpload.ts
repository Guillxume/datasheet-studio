/**
 * Televersement dans la bibliotheque d'images — ce qui se decide AVANT d'ecrire :
 * le type du fichier et la cle qui le designera.
 *
 * DEUX DEFAUTS, constates en ecrivant la documentation de l'equipe :
 *
 *  1. Les polices ne passaient pas. Le serveur les accepte (woff2, woff, ttf,
 *     otf — voir ASSET_MIMES), et l'editeur explique comment en declarer une
 *     dans la feuille de style ; mais le bouton « Televerser » ne proposait que
 *     des images, et un navigateur annonce souvent une police comme
 *     `application/octet-stream` — refusee. On reconnait donc une police a son
 *     extension quand le navigateur ne dit rien d'utile.
 *  2. Les accents coutaient une lettre. « Logo Équipement.png » donnait la cle
 *     `logo-quipement` : le É, hors de [a-z], etait remplace par le tiret.
 *     Les accents sont maintenant retires, la lettre gardee : `logo-equipement`.
 *
 * Fonctions pures, testees sans base ni navigateur.
 */

/**
 * Les types que la bibliotheque accepte. Vit ici, dans le module pur, pour se
 * tester sans base ; assetStore.ts le reexporte. Voir la-bas pourquoi les polices
 * en font partie.
 */
export const ASSET_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "font/woff2",
  "font/woff",
  "font/ttf",
  "font/otf",
]);

/** Types que le navigateur envoie quand il ne connait pas le format. */
const UNKNOWN_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

/** Les polices, reconnues a leur extension. Les images, elles, sont toujours bien annoncees. */
const FONT_BY_EXTENSION: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

/**
 * Anciens types de police que certains systemes annoncent encore : ils designent
 * les memes fichiers que les types `font/*`.
 */
const LEGACY_FONT_TYPES: Record<string, string> = {
  "application/font-woff": "font/woff",
  "application/font-woff2": "font/woff2",
  "application/x-font-woff": "font/woff",
  "application/x-font-ttf": "font/ttf",
  "application/x-font-truetype": "font/ttf",
  "application/x-font-otf": "font/otf",
  "application/x-font-opentype": "font/otf",
  "application/vnd.ms-opentype": "font/otf",
};

const extensionOf = (fileName: string): string => {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
};

/** Le type a enregistrer pour ce fichier ; inchange s'il est deja exploitable. */
export function uploadMime(declared: string, fileName: string): string {
  const type = declared.trim().toLowerCase();
  if (LEGACY_FONT_TYPES[type]) return LEGACY_FONT_TYPES[type];
  if (UNKNOWN_TYPES.has(type)) return FONT_BY_EXTENSION[extensionOf(fileName)] ?? "application/octet-stream";
  return type;
}

/**
 * La cle d'un fichier, tiree de son nom : extension retiree, accents retires,
 * minuscules, tout le reste en tirets. 64 caracteres au plus.
 */
export function assetKeyFromName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Ce que le champ fichier propose : images ET polices, par type et par extension. */
export const UPLOAD_ACCEPT =
  "image/png,image/jpeg,image/webp,image/svg+xml,image/gif,font/woff2,font/woff,font/ttf,font/otf,.woff2,.woff,.ttf,.otf";
