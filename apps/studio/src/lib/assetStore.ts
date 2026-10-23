import { createHash } from "node:crypto";
import { BoundedCache } from "./boundedCache";
import { sql } from "./db";
import { ASSET_MIMES } from "./assetUpload";

/**
 * Bibliotheque du Studio : logos, pictos de badges, icones — et polices.
 *
 * A ne pas confondre avec les assets du PAYLOAD (src/lib/assets.ts), qui sont
 * les images produit jointes a chaque requete de rendu. Ceux-ci appartiennent au
 * template et sont stockes durablement.
 *
 * Le contenu vit en base (bytea) plutot que sur disque : le conteneur applicatif
 * n'a alors aucun volume a sauvegarder, et un `pg_dump` suffit a tout restaurer.
 * Les volumes en jeu (quelques dizaines de pictos) ne justifient pas un stockage
 * objet.
 */

/**
 * Types acceptes dans la bibliotheque.
 *
 * LES POLICES EN FONT PARTIE, et ce n'est pas une extension opportuniste : la
 * typographie d'un document imprime n'etait atteignable par AUCUN chemin. La
 * feuille du template peut declarer un @font-face, mais le fichier de police
 * n'avait nulle part ou vivre — donc aucune URL a referencer — et toute fiche
 * retombait sur Arial, valeur de repli de printCss.ts. Une police stockee ici est
 * reecrite en data URI dans la feuille au rendu (voir inlineCssAssets dans
 * src/lib/render.tsx), comme les pictos le sont dans les props.
 *
 * woff2 d'abord : c'est le format le mieux compresse, et le Chromium de
 * Gotenberg le lit. Les autres reste acceptes pour une police livree par un
 * fondeur dans un seul format.
 *
 * NOTE : un navigateur n'annonce pas toujours ces types (certains envoient
 * application/octet-stream selon le systeme). Si un televersement de police est
 * refuse alors que le fichier est valide, c'est ici qu'il faut regarder — pas
 * dans le rendu.
 */
export { ASSET_MIMES };

/**
 * 2 Mo par fichier.
 *
 * Verifie comme suffisant pour une police : ce plafond vise a l'origine un picto,
 * mais un woff2 latin complet reste tres en deca. Une police qui le depasserait
 * serait un jeu de caracteres etendu (CJK) dont un document commercial en
 * francais n'a pas l'usage.
 */
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;

export type AssetRecord = {
  key: string;
  scope: string;
  mime: string;
  bytes: number;
  original_name: string | null;
  url: string;
};

/** "shared" pour la bibliotheque commune, sinon le slug de la boutique. */
export function scopeToShopSlug(scope: string): string | null {
  return scope === "shared" ? null : scope;
}

export function assetUrl(scope: string, key: string): string {
  return `/assets/${encodeURIComponent(scope)}/${encodeURIComponent(key)}`;
}

async function resolveShopId(shopSlug: string | null): Promise<string | null | undefined> {
  if (shopSlug === null) {
    return null;
  }
  const rows = await sql<{ id: string }[]>`SELECT id FROM shops WHERE slug = ${shopSlug}`;
  return rows[0]?.id;
}

export async function listAssets(scope: string): Promise<AssetRecord[]> {
  const shopSlug = scopeToShopSlug(scope);
  const shopId = await resolveShopId(shopSlug);
  if (shopId === undefined) {
    return [];
  }

  const rows = await sql<{ key: string; mime: string; bytes: number; original_name: string | null }[]>`
    SELECT key, mime, bytes, original_name
    FROM assets
    WHERE ${shopId === null ? sql`shop_id IS NULL` : sql`shop_id = ${shopId}`}
    ORDER BY key
  `;

  return rows.map((row) => ({ ...row, scope, url: assetUrl(scope, row.key) }));
}

export async function putAsset(
  scope: string,
  key: string,
  mime: string,
  data: Buffer,
  originalName: string
): Promise<{ ok: true; asset: AssetRecord } | { ok: false; error: string }> {
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(key)) {
    return { ok: false, error: "Cle invalide : minuscules, chiffres, point, tiret, souligne." };
  }
  if (!ASSET_MIMES.has(mime)) {
    return { ok: false, error: `Type non autorise : ${mime}` };
  }
  if (data.length === 0 || data.length > MAX_ASSET_BYTES) {
    return { ok: false, error: `Taille invalide : ${data.length} octets (maximum ${MAX_ASSET_BYTES}).` };
  }

  const shopSlug = scopeToShopSlug(scope);
  const shopId = await resolveShopId(shopSlug);
  if (shopId === undefined) {
    return { ok: false, error: `Boutique inconnue : ${scope}` };
  }

  const sha256 = createHash("sha256").update(data).digest("hex");

  // Le remplacement est volontaire : re-televerser un picto sous la meme cle doit
  // mettre a jour tous les templates qui le referencent, sans les rouvrir.
  if (shopId === null) {
    await sql`
      INSERT INTO assets (shop_id, key, filename, mime, bytes, sha256, data, original_name)
      VALUES (NULL, ${key}, ${key}, ${mime}, ${data.length}, ${sha256}, ${data}, ${originalName})
      ON CONFLICT (key) WHERE shop_id IS NULL
      DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, sha256 = EXCLUDED.sha256,
                    data = EXCLUDED.data, original_name = EXCLUDED.original_name
    `;
  } else {
    await sql`
      INSERT INTO assets (shop_id, key, filename, mime, bytes, sha256, data, original_name)
      VALUES (${shopId}, ${key}, ${key}, ${mime}, ${data.length}, ${sha256}, ${data}, ${originalName})
      ON CONFLICT (shop_id, key) WHERE shop_id IS NOT NULL
      DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, sha256 = EXCLUDED.sha256,
                    data = EXCLUDED.data, original_name = EXCLUDED.original_name
    `;
  }

  // Re-televerser sous la meme cle remplace l'image PARTOUT ou elle est utilisee
  // (c'est ce que dit le gestionnaire d'images) : le cache doit lacher la
  // precedente, sinon la promesse est fausse pendant une minute.
  inlineCache.delete(cacheKey(scope, key));

  return {
    ok: true,
    asset: { key, scope, mime, bytes: data.length, original_name: originalName, url: assetUrl(scope, key) },
  };
}

/**
 * Cache des assets DEJA ENCODES en data URI.
 *
 * LE COUT QU'IL SUPPRIME. src/lib/render.tsx lit chaque reference `/assets/...`
 * du template et l'inline en base64 A CHAQUE RENDU. Une generation en masse de
 * 2 000 fiches sur un template portant cinq pictos, c'est 10 000 requetes et
 * 10 000 encodages base64 — pour cinq contenus qui ne changent pas. Le base64
 * gonfle de 33 % en prime.
 *
 * CE QUI EST CACHE : la chaine finale, pas les octets. C'est l'encodage qui
 * coute, autant ne le faire qu'une fois.
 *
 * PEREMPTION D'UNE MINUTE, plus l'invalidation explicite a l'ecriture. Les deux
 * sont necessaires et ne couvrent pas le meme cas : l'invalidation traite le
 * televersement fait depuis CE processus, la peremption borne l'incoherence
 * quand un autre processus ecrit — ce qui arrive des qu'on ajoute une replique.
 * Une minute est le compromis : assez court pour qu'un remplacement de picto se
 * voie pendant qu'on regle un template, assez long pour couvrir un lot entier.
 *
 * 32 Mo : de quoi tenir la bibliotheque de pictos d'un parc, tres loin de la
 * memoire tenue par les rendus en vol (voir renderQueue.ts).
 */
const inlineCache = new BoundedCache<string>(32 * 1024 * 1024, 60_000);

/** Cle de cache. Le scope en fait partie : deux boutiques peuvent avoir la meme cle. */
const cacheKey = (scope: string, key: string) => `${scope}\u0000${key}`;

/**
 * L'asset, deja encode en `data:<mime>;base64,...`, ou `null`.
 *
 * C'est ce que le moteur de rendu consomme. `readAsset` reste disponible pour
 * les appelants qui ont besoin des octets bruts — la route qui sert les images
 * a l'editeur, qui pose un ETag sur le sha256.
 */
export async function readAssetInlined(scope: string, key: string): Promise<string | null> {
  const cached = inlineCache.get(cacheKey(scope, key));
  if (cached !== undefined) return cached;

  const asset = await readAsset(scope, key);
  if (!asset) return null;

  const dataUri = `data:${asset.mime};base64,${asset.data.toString("base64")}`;
  inlineCache.set(cacheKey(scope, key), dataUri, dataUri.length);

  return dataUri;
}

export async function readAsset(
  scope: string,
  key: string
): Promise<{ mime: string; data: Buffer; sha256: string } | null> {
  const shopSlug = scopeToShopSlug(scope);
  const shopId = await resolveShopId(shopSlug);
  if (shopId === undefined) {
    return null;
  }

  const rows = await sql<{ mime: string; data: Buffer; sha256: string }[]>`
    SELECT mime, data, sha256
    FROM assets
    WHERE key = ${key}
      AND ${shopId === null ? sql`shop_id IS NULL` : sql`shop_id = ${shopId}`}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function deleteAsset(scope: string, key: string): Promise<void> {
  // Avant la requete : si elle echoue, avoir vide une entree de cache ne coute
  // qu'une relecture, alors que l'oublier servirait une image supprimee.
  inlineCache.delete(cacheKey(scope, key));

  const shopId = await resolveShopId(scopeToShopSlug(scope));
  if (shopId === undefined) {
    return;
  }

  await sql`
    DELETE FROM assets
    WHERE key = ${key}
      AND ${shopId === null ? sql`shop_id IS NULL` : sql`shop_id = ${shopId}`}
  `;
}
