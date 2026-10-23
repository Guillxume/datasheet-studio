import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { CollectedAsset } from "./types";

/**
 * Fabrication des pieces jointes du multipart.
 *
 * Rappel du contrat : trois transports possibles pour une image.
 *
 *   https://...    telechargee par Chromium au rendu. LE PLUS ECONOMIQUE quand
 *                  les medias sont sur un CDN public : rien ne transite par le
 *                  collecteur.
 *   asset://<cle>  fichier joint a la requete. Indispensable des que la source
 *                  n'est pas joignable depuis le Studio — chemins locaux,
 *                  reseau prive, stockage signe.
 *   data:...       deja en ligne.
 *
 * On ne joint donc que ce qu'il faut joindre, et une URL publique traverse
 * telle quelle.
 */

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** Les seuls types acceptes par la route de rendu, qui repond 415 sinon. */
export const ACCEPTED_MIMES = new Set(Object.values(MIME_BY_EXT));

export function mimeFromPath(path: string): string | null {
  return MIME_BY_EXT[extname(path).toLowerCase()] ?? null;
}

export function isRemoteRef(value: string): boolean {
  return /^(https?:|data:|asset:)/i.test(value);
}

/**
 * Cle d'asset stable et sans collision.
 *
 * Le nom de base seul ("logo.png" dans deux dossiers) donnerait deux fois la
 * meme cle et la seconde image ecraserait la premiere — silencieusement, la
 * fiche sortant avec la mauvaise photo. Le suffixe de hachage du chemin complet
 * l'evite tout en gardant une cle lisible dans les avertissements du Studio.
 */
export function assetKeyFor(path: string, prefix = "img"): string {
  const stem = basename(path, extname(path)).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 32);
  const digest = createHash("sha1").update(path).digest("hex").slice(0, 6);
  return `${prefix}-${stem || "asset"}-${digest}`;
}

export class AssetError extends Error {}

/**
 * Empreinte "taille + date de modification", et non un hachage du contenu.
 *
 * C'est la decision du §5 de docs/integrer-un-connecteur.md : hacher le contenu
 * couterait une lecture complete de toutes les images du catalogue a CHAQUE
 * comparaison, alors qu'un stat suffit a repondre "rien n'a bouge". La contre-
 * partie est connue : reecrire un fichier a l'identique perime la fiche pour
 * rien. On prefere regenerer en trop que servir un PDF perime.
 */
export async function attachFile(path: string, key?: string): Promise<CollectedAsset> {
  const mime = mimeFromPath(path);
  if (!mime) {
    throw new AssetError(`type d'image non supporte : ${path}`);
  }

  const info = await stat(path);
  return {
    key: key ?? assetKeyFor(path),
    mime,
    bytes: await readFile(path),
    fingerprint: `${info.size}:${Math.round(info.mtimeMs)}`,
  };
}

/**
 * Rapatrie une image distante pour la joindre au multipart. Utile quand le
 * stockage est prive (S3 signe, reseau interne) : le Studio ne pourrait pas la
 * charger lui-meme.
 *
 * L'empreinte suit l'ETag quand le serveur en donne un — c'est exactement ce
 * qu'il promet. A defaut, on hache le contenu : on l'a deja en main, cela ne
 * coute rien de plus ici.
 */
export async function attachUrl(
  url: string,
  key: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<CollectedAsset> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new AssetError(`image inaccessible (${response.status}) : ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const declared = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const mime = ACCEPTED_MIMES.has(declared) ? declared : mimeFromPath(new URL(url).pathname);
  if (!mime) {
    throw new AssetError(`type d'image non supporte (${declared || "inconnu"}) : ${url}`);
  }

  const etag = response.headers.get("etag");
  return {
    key,
    mime,
    bytes,
    fingerprint: etag ?? createHash("sha1").update(bytes).digest("hex").slice(0, 16),
  };
}
