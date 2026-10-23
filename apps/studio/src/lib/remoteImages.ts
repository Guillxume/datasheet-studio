import { createHash } from "node:crypto";
import type { Asset } from "./assets";
import { BoundedCache } from "./boundedCache";
import { safeFetch } from "./publicUrl";

/**
 * Images distantes : c'est l'APPLICATION qui les telecharge, jamais Chromium.
 *
 * POURQUOI. Jusqu'au 16/10/2026, une URL d'image du corps (payload JSON, <img>
 * d'une description HTML) etait chargee par le Chromium de Gotenberg lui-meme,
 * sans passer par aucun de nos controles. Son seul filtre etait une liste
 * d'adresses interdites, lue sur le TEXTE de l'URL : un nom de service du reseau
 * Docker (`http://app:3000/`) ou un nom qui resout en prive (`10.0.0.5.nip.io`)
 * passait. C'etait une SSRF depuis le conteneur de rendu (audit, constat 5).
 *
 * Desormais Chromium n'a plus aucun acces reseau (infra/docker-compose.yml) :
 * tout ce qu'il affiche lui est fourni. Les URLs sont relevees ICI, dans le
 * document final, et telechargees par `safeFetch`, qui resout le nom et refuse
 * toute adresse non publique, redirections comprises.
 *
 *  - CORPS : l'image devient un FICHIER JOINT au multipart, comme un asset de la
 *    boutique. Pas de base64 : 33 % de moins a transporter, et le HTML reste
 *    leger.
 *  - BANDEAUX (header.html / footer.html) : data URI, la seule forme que
 *    Chromium y affiche. ETABLI PAR MESURE, avec temoin : dans ces contextes il
 *    ne charge ni ressource distante, ni fichier joint.
 *
 * DANS LE DOCUMENT FINAL ET NON DANS LES DONNEES. Relever les URLs dans le HTML
 * produit ne telecharge que ce qui est REELLEMENT affiche. L'ancienne collecte
 * parcourait les donnees : des qu'un template avait un en-tete, chaque rendu
 * telechargeait TOUTES les images du produit pour n'en afficher qu'un logo
 * (audit, performance). Et elle couvre d'un coup ce que les donnees ne disaient
 * pas : <img> des descriptions HTML, url() d'une feuille de style.
 *
 * Seules deux formes sont relevees : un attribut `src` et un `url(...)` CSS (dans
 * un attribut style ou une feuille). Un lien <a href> n'est pas une ressource,
 * et `{{product.url}}` — l'adresse de la fiche, contenu du QR code — n'est
 * jamais telecharge.
 */

/** Au-dela, la fiche est anormale : les URLs suivantes ne sont pas telechargees. */
export const MAX_REMOTE_IMAGES = 64;
/** Une photo produit haute definition tient sous ce plafond ; un fichier plus lourd n'a rien a faire dans une fiche. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Budget d'un rendu, toutes images confondues : c'est ce qui borne la memoire, pas le plafond par image. */
const MAX_RENDER_BYTES = 48 * 1024 * 1024;
/** Telechargements simultanes par rendu : assez pour ne pas attendre, pas assez pour inonder un CDN. */
const CONCURRENCY = 6;
const TIMEOUT_MS = 10_000;

/**
 * Types acceptes, et l'extension du fichier joint. L'extension compte : pour un
 * fichier local, Chromium deduit le type de l'extension.
 */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
};

export type RemoteImage = { mime: string; bytes: Buffer };

export type FetchOutcome = { ok: true; image: RemoteImage } | { ok: false; raison: string };

/**
 * Cache du processus, borne en octets. Une meme fiche est rendue plusieurs fois
 * de suite (apercu, generation en masse, book) et un logo de boutique revient a
 * chaque rendu : sans cache, chacun refaisait le meme aller-retour.
 *
 * Dix minutes : une image corrigee sur la boutique apparait au plus tard dix
 * minutes apres, ce qui reste en deca du cache PDF du module.
 */
const cache = new BoundedCache<RemoteImage>(64 * 1024 * 1024, 10 * 60 * 1000);

/*
 * `src="..."`, `src='...'` ou `url(...)`, avec ou sans guillemets, y compris
 * leurs formes ECHAPPEES : React ecrit `url(&quot;https://…&quot;)` dans un
 * attribut style. L'URL s'arrete au premier delimiteur, entite comprise.
 */
const REMOTE_REF =
  /(\ssrc\s*=\s*["']?|url\(\s*(?:&quot;|&#x27;|&#39;|["'])?)(https?:\/\/[^\s"'<>()]+?)(?=&quot;|&#x27;|&#39;|["'\s)>]|$)/gi;

/** Les seules entites qu'un serialiseur HTML met dans une URL. */
function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Les URLs distantes d'un document, decodees, dans l'ordre d'apparition. */
export function findRemoteImageUrls(markup: string): string[] {
  const found = new Set<string>();
  for (const match of markup.matchAll(REMOTE_REF)) {
    found.add(decodeEntities(match[2]));
  }
  return [...found];
}

/**
 * Remplace chaque URL distante par ce que `replace` renvoie. Une URL sans
 * remplacement est laissee TELLE QUELLE : Chromium ne la chargera pas, l'image
 * sera absente, et l'avertissement de rendu l'a deja signalee.
 *
 * Le remplacement doit etre sur dans un attribut ET dans un url() : un nom de
 * fichier assaini ou une data URI base64, jamais une chaine arbitraire.
 */
export function rewriteRemoteImageUrls(markup: string, replace: (url: string) => string | undefined): string {
  return markup
    .replace(PRELOAD, "")
    .replace(REMOTE_REF, (whole, prefix: string, encoded: string) => {
      const replacement = replace(decodeEntities(encoded));
      return replacement === undefined ? whole : `${prefix}${replacement}`;
    });
}

/*
 * React 19 accompagne chaque <img> distante d'un `<link rel="preload"
 * as="image" href="URL d'origine">`. Dans un PDF, un prechargement ne sert a
 * rien, et celui-ci pointerait encore vers l'URL que Chromium n'a plus le droit
 * de joindre : une requete refusee par rendu et par image. Retire.
 */
const PRELOAD = /<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="image")[^>]*>/gi;

/**
 * Lecture du corps PLAFONNEE AU FIL DE L'EAU : `arrayBuffer()` lisait tout avant
 * de mesurer, si bien qu'un fichier de 2 Go etait entierement charge en memoire
 * pour etre refuse ensuite. On s'arrete au premier octet de trop.
 */
async function readCapped(response: Response, max: number): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > max) {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

/** Telechargement d'une image, sans cache. Exporte pour etre remplace dans les tests. */
export async function fetchImage(url: string): Promise<FetchOutcome> {
  try {
    /*
     * `safeFetch` ET NON `fetch` : l'URL vient du payload, donc de la boutique
     * appelante, et le contenu finit dans le PDF qu'elle recoit. Voir
     * src/lib/publicUrl.ts — qui refuse aussi les redirections vers une
     * adresse privee, le contournement le plus courant.
     */
    const tentative = await safeFetch(url, { timeoutMs: TIMEOUT_MS, accept: "image/*" });
    if (!tentative.ok) return { ok: false, raison: `image distante refusee (${tentative.raison})` };
    const response = tentative.response;

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { ok: false, raison: `image distante inaccessible (HTTP ${response.status})` };
    }

    const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!(mime in EXT_BY_MIME)) {
      await response.body?.cancel().catch(() => {});
      return { ok: false, raison: `la reponse n'est pas une image prise en charge (${mime || "type absent"})` };
    }

    const bytes = await readCapped(response, MAX_IMAGE_BYTES);
    if (bytes === null) return { ok: false, raison: `image distante de plus de ${MAX_IMAGE_BYTES / 1024 / 1024} Mo` };
    if (bytes.length === 0) return { ok: false, raison: "image distante vide" };

    return { ok: true, image: { mime, bytes } };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, raison: `telechargement impossible (${reason})` };
  }
}

export type RemoteImages = { images: Map<string, RemoteImage>; warnings: string[] };

/**
 * Telecharge un ensemble d'URLs : cache d'abord, puis au plus CONCURRENCY a la
 * fois, dans la limite de MAX_REMOTE_IMAGES et du budget d'octets du rendu.
 */
export async function fetchRemoteImages(
  urls: Iterable<string>,
  fetcher: (url: string) => Promise<FetchOutcome> = fetchImage
): Promise<RemoteImages> {
  const images = new Map<string, RemoteImage>();
  const warnings: string[] = [];

  const all = [...new Set(urls)];
  const wanted = all.slice(0, MAX_REMOTE_IMAGES);
  for (const url of all.slice(MAX_REMOTE_IMAGES)) {
    warnings.push(`image distante ignoree, plus de ${MAX_REMOTE_IMAGES} par fiche : ${url}`);
  }

  let budget = MAX_RENDER_BYTES;
  const queue: string[] = [];
  for (const url of wanted) {
    const cached = cache.get(url);
    if (cached) {
      images.set(url, cached);
      budget -= cached.bytes.length;
    } else {
      queue.push(url);
    }
  }

  const worker = async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      if (budget <= 0) {
        warnings.push(`image distante ignoree, budget de ${MAX_RENDER_BYTES / 1024 / 1024} Mo par fiche atteint : ${url}`);
        continue;
      }
      const outcome = await fetcher(url);
      if (!outcome.ok) {
        warnings.push(`${outcome.raison} : ${url}`);
        continue;
      }
      budget -= outcome.image.bytes.length;
      if (budget < 0) {
        warnings.push(`image distante ignoree, budget de ${MAX_RENDER_BYTES / 1024 / 1024} Mo par fiche atteint : ${url}`);
        continue;
      }
      cache.set(url, outcome.image, outcome.image.bytes.length);
      images.set(url, outcome.image);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  return { images, warnings };
}

/**
 * Nom du fichier joint d'une image distante : derive de l'URL, donc stable d'un
 * rendu a l'autre, et compose de caracteres surs dans un attribut comme dans un
 * url(). Le prefixe le distingue des assets de la boutique (voir safeFilename).
 */
export function remoteFilename(url: string, mime: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 24);
  return `distant-${hash}.${EXT_BY_MIME[mime] ?? "bin"}`;
}

/** Le corps : chaque image telechargee devient un fichier joint, referencee en relatif. */
export function attachRemoteImages(
  markup: string,
  images: Map<string, RemoteImage>,
  taken: Set<string>
): { markup: string; assets: Asset[] } {
  const assets: Asset[] = [];
  const names = new Map<string, string>();
  for (const [url, image] of images) {
    let filename = remoteFilename(url, image.mime);
    // Collision avec un asset de la boutique, qui choisit ses cles : improbable,
    // mais un fichier joint ecrase l'autre sans erreur. On le rend impossible.
    for (let n = 2; taken.has(filename); n += 1) filename = filename.replace(/(-\d+)?\./, `-${n}.`);
    taken.add(filename);
    names.set(url, `./${filename}`);
    assets.push({ key: filename, filename, mime: image.mime, bytes: image.bytes });
  }
  return { markup: rewriteRemoteImageUrls(markup, (url) => names.get(url)), assets };
}

/** Les bandeaux : data URI, seule forme que Chromium y affiche. */
export function inlineRemoteImages(markup: string, images: Map<string, RemoteImage>): string {
  return rewriteRemoteImageUrls(markup, (url) => {
    const image = images.get(url);
    return image ? `data:${image.mime};base64,${image.bytes.toString("base64")}` : undefined;
  });
}
