import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "./db";

/**
 * Authentification des boutiques appelantes.
 *
 * Format de cle : sk_<prefix>_<secret>
 *   - <prefix> est stocke en clair et sert a retrouver la ligne (indexe)
 *   - la cle complete est stockee en sha256 uniquement
 *
 * Le prefixe evite un scan de table a chaque rendu tout en gardant le secret
 * non reversible en base.
 */

export type Shop = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
};

const PREFIX_BYTES = 6;
const SECRET_BYTES = 24;

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = randomBytes(PREFIX_BYTES).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  const key = `sk_${prefix}_${secret}`;
  return { key, prefix, hash: hashKey(key) };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function parseKey(key: string): { prefix: string } | null {
  const match = key.match(/^sk_([0-9a-f]{12})_[A-Za-z0-9_-]{16,}$/);
  return match ? { prefix: match[1] } : null;
}

export function bearerFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Retourne la boutique authentifiee, ou null. La comparaison du hash est faite
 * a temps constant pour ne pas laisser fuiter d'information par la duree.
 */
export async function authenticate(request: Request): Promise<Shop | null> {
  const key = bearerFrom(request);
  if (!key) return null;

  const parsed = parseKey(key);
  if (!parsed) return null;

  const rows = await sql<
    {
      id: string;
      slug: string;
      name: string;
      active: boolean;
      api_key_hash: string;
      api_key_last_used_at: string | null;
    }[]
  >`
    SELECT id, slug, name, active, api_key_hash, api_key_last_used_at
    FROM shops
    WHERE api_key_prefix = ${parsed.prefix}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row || !row.active) return null;

  const expected = Buffer.from(row.api_key_hash, "hex");
  const provided = Buffer.from(hashKey(key), "hex");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  touchLastUsed(row.id, row.api_key_last_used_at);

  return { id: row.id, slug: row.slug, name: row.name, active: row.active };
}

/**
 * Note la date de dernier usage de la cle, AU PLUS UNE FOIS PAR HEURE.
 *
 * Cette date repond a la seule question qu'on se pose devant une cle : peut-on
 * la faire tourner sans casser quelque chose ? Sans elle, la reponse est
 * « essayons voir ».
 *
 * Elle est sur le chemin de CHAQUE rendu — d'ou la fenetre d'une heure. Une
 * generation en masse de 2 000 fiches produirait autrement 2 000 UPDATE sur la
 * meme ligne, c'est-a-dire 2 000 versions mortes a nettoyer, pour une precision
 * dont personne n'a l'usage.
 *
 * L'ecriture n'est pas attendue : `authenticate` est appele avant le rendu, et
 * faire patienter une fiche pour une statistique serait un mauvais echange. Le
 * `catch` vide est delibere — une base en lecture seule ou saturee ne doit
 * pas refuser un rendu a cause de cette ligne.
 */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

function touchLastUsed(id: string, lastUsed: string | null): void {
  if (lastUsed !== null && Date.now() - new Date(lastUsed).getTime() < TOUCH_INTERVAL_MS) {
    return;
  }

  void sql`UPDATE shops SET api_key_last_used_at = now() WHERE id = ${id}`.catch(() => {});
}
