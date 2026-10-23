/**
 * Resolution des references d'images du payload vers quelque chose que
 * Chromium sait charger.
 */

export type Asset = {
  key: string;
  filename: string;
  mime: string;
  bytes: Buffer;
};

export type AssetBag = Map<string, Asset>;

const ASSET_SCHEME = "asset://";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * Nom de fichier sur pour le multipart Gotenberg : on ne fait JAMAIS confiance
 * a la cle fournie par l'appelant, qui finirait sinon dans un chemin de
 * fichier cote conteneur de rendu.
 */
export function safeFilename(key: string, mime: string): string {
  const stem = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "asset";
  const ext = EXT_BY_MIME[mime] ?? "bin";
  return `${stem}.${ext}`;
}

export function isAssetRef(ref: string): boolean {
  return ref.startsWith(ASSET_SCHEME);
}

/**
 * Deux modes, et la distinction n'est pas cosmetique :
 *
 * - "relative" : renvoie "./fichier.jpg". Le fichier accompagne index.html
 *   dans le multipart Gotenberg. C'est le mode du corps du document.
 *
 * - "inline" : renvoie une data URI base64. OBLIGATOIRE pour les en-tetes et
 *   pieds de page : Chromium les rend dans un contexte de document separe qui
 *   ne resout pas les references relatives aux fichiers joints. Une image de
 *   fond de bandeau referencee en relatif y apparait vide, sans erreur.
 */
export type AssetMode = "relative" | "inline";

/**
 * Les URLs http(s) et data: traversent sans modification : c'est ce qui rend
 * le Studio utilisable depuis une boutique dont les medias sont sur un CDN
 * public (Medusa, Shopify) sans passer par le multipart.
 */
export function resolveImageRef(ref: string, bag: AssetBag, mode: AssetMode): string | null {
  if (!isAssetRef(ref)) {
    if (/^(https?:|data:)/i.test(ref)) {
      return ref;
    }
    // Tout le reste (chemins filesystem, file://, protocoles exotiques) est
    // refuse : un chemin absolu de la boutique n'a aucun sens ici, et file://
    // exposerait le filesystem du conteneur de rendu.
    return null;
  }

  const key = ref.slice(ASSET_SCHEME.length);
  const asset = bag.get(key);
  if (!asset) {
    return null;
  }

  if (mode === "inline") {
    return `data:${asset.mime};base64,${asset.bytes.toString("base64")}`;
  }
  return `./${asset.filename}`;
}
