import { z } from "zod";
import { generateApiKey } from "./auth";
import { MAX_ENTITIES, parseEntities } from "./erpQuote";
import { sql } from "./db";

/**
 * Administration des boutiques : identite, cle API, back-office d'origine.
 *
 * CE QUE CE MODULE DEPLACE. Ces valeurs vivaient dans
 * collectors/shop.exemple.json, un fichier a recopier sur le poste de chaque
 * personne qui lance un import, et dans `pnpm issue-key`, une commande a
 * lancer sur le serveur. Les deux marchaient. Aucun des deux ne marche quand la
 * personne qui doit changer une couleur ou faire tourner une cle n'a pas d'acces
 * SSH — c'est-a-dire des que le Studio sert a plus d'une equipe.
 *
 * SEPARE DE src/lib/repository.ts, qui ne connait que les templates, et de
 * src/lib/auth.ts, qui ne fait qu'authentifier. Ici on ECRIT la table shops.
 */

/**
 * Les reglages libres d'une boutique, valides par zod.
 *
 * Ils alimentent le bloc `shop` du payload de rendu — le meme que celui decrit
 * dans docs/integrer-un-connecteur.md. Les cles sont donc CELLES DU CONTRAT et
 * non un dialecte propre a l'interface : ce qui est saisi ici part tel quel dans
 * la fiche.
 *
 * `.catch()` sur l'ensemble plutot que sur chaque champ : une ligne dont le JSON
 * aurait ete abime a la main ne doit pas rendre la page d'administration
 * illisible — elle repart de reglages vides, et la personne resaisit.
 */
const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{3,8}$/, "Couleur attendue au format hexadecimal, par exemple #a8481a")
  .optional();

export const shopSettingsSchema = z
  .object({
    url: z.string().url().optional().or(z.literal("")),
    /** Cle d'asset du logo, pas une URL : voir la bibliotheque d'images. */
    logo: z.string().max(120).optional(),
    colors: z.object({ primary: colorSchema, secondary: colorSchema }).optional(),
    company: z
      .object({
        address: z.string().max(300).optional(),
        phone: z.string().max(60).optional(),
        email: z.string().max(200).optional(),
        legal: z.string().max(500).optional(),
      })
      .optional(),
    /**
     * D'ou viennent les fiches de cette boutique. Ce champ ne change aucun
     * comportement du Studio : il documente le parc a l'endroit ou l'on cherche
     * — « ce site, c'est le module PrestaShop ou le bouton Medusa ? » — et
     * c'est ce que lit docs/bouton-back-office.md.
     */
    backoffice: z
      .object({
        kind: z.enum(["prestashop", "medusa", "pim", "autre"]).optional(),
        url: z.string().url().optional().or(z.literal("")),
      })
      .optional(),
    /**
     * Les entites Dolibarr de la boutique, « 4, 9, 12 » : l'ERP est
     * multi-entites, et les devis d'une meme boutique peuvent vivre sur
     * plusieurs (les grands comptes Acme). Un devis n'est cherche que dans
     * celles-ci (src/lib/erpQuote.ts). Vide : les books de cette boutique ne
     * proposent que le PDF televerse. La cle reste `entity` : une valeur seule,
     * saisie avant qu'on puisse en mettre plusieurs, reste valide. Comme
     * `backoffice`, ce n'est pas un champ de fiche (voir shopFields.ts).
     */
    erp: z
      .object({
        entity: z
          .string()
          .refine((value) => parseEntities(value) !== null, `Entités ERP attendues : des numéros séparés par des virgules, par exemple « 4, 9 » (au plus ${MAX_ENTITIES})`)
          .optional(),
      })
      .optional(),
  })
  .strict();

export type ShopSettings = z.infer<typeof shopSettingsSchema>;

/** Les back-offices que le parc sait alimenter. Voir docs/bouton-back-office.md. */
export const BACKOFFICE_KINDS = ["prestashop", "medusa", "pim", "autre"] as const;
export type BackofficeKind = (typeof BACKOFFICE_KINDS)[number];

export type ShopAdminRow = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  api_key_prefix: string;
  api_key_issued_at: string | null;
  api_key_last_used_at: string | null;
  webhook_url: string | null;
  settings: ShopSettings;
  templates: number;
};

export async function listShopsForAdmin(): Promise<ShopAdminRow[]> {
  const rows = await sql<(Omit<ShopAdminRow, "settings"> & { settings: unknown })[]>`
    SELECT s.id, s.slug, s.name, s.active, s.api_key_prefix,
           s.api_key_issued_at, s.api_key_last_used_at, s.webhook_url, s.settings,
           (SELECT count(*)::int FROM templates t WHERE t.shop_id = s.id AND t.kind = 'template') AS templates
    FROM shops s
    ORDER BY s.active DESC, s.name
  `;

  return rows.map((row) => ({
    ...row,
    settings: shopSettingsSchema.safeParse(row.settings ?? {}).data ?? {},
  }));
}

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

/**
 * Cree une boutique ET emet sa cle du meme coup.
 *
 * Les deux sont indissociables : une boutique sans cle ne peut rien faire, et
 * separer les deux gestes garantit qu'un jour l'un sera oublie. La cle rendue
 * ici est la SEULE occasion de la lire — la base n'en garde que le sha256.
 */
export async function createShop(
  slug: string,
  name: string
): Promise<{ id: string; key: string } | { error: string }> {
  if (!SLUG_PATTERN.test(slug)) {
    return { error: "Slug invalide : minuscules, chiffres et tirets, 2 a 63 caracteres." };
  }
  if (name.trim().length < 2) {
    return { error: "Le nom doit faire au moins 2 caracteres." };
  }

  const { key, prefix, hash } = generateApiKey();

  try {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO shops (slug, name, api_key_prefix, api_key_hash, api_key_issued_at)
      VALUES (${slug}, ${name.trim()}, ${prefix}, ${hash}, now())
      RETURNING id
    `;
    return { id: rows[0].id, key };
  } catch {
    return { error: "Une boutique porte deja ce slug." };
  }
}

export async function updateShop(
  id: string,
  patch: { name?: string; active?: boolean; webhookUrl?: string | null; settings?: ShopSettings }
): Promise<ShopAdminRow | null> {
  await sql`
    UPDATE shops SET
      name        = COALESCE(${patch.name ?? null}, name),
      active      = COALESCE(${patch.active ?? null}, active),
      webhook_url = ${patch.webhookUrl === undefined ? sql`webhook_url` : patch.webhookUrl},
      settings    = ${patch.settings === undefined ? sql`settings` : sql.json(patch.settings as never)}
    WHERE id = ${id}
  `;

  const rows = await listShopsForAdmin();
  return rows.find((row) => row.id === id) ?? null;
}

/**
 * Fait tourner la cle API d'une boutique.
 *
 * L'ANCIENNE EST INVALIDE IMMEDIATEMENT — il n'y a pas de periode de
 * recouvrement, et c'est assume : deux cles valides en meme temps veulent dire
 * qu'on ne sait plus laquelle est en service, donc qu'on ne fera jamais tourner
 * la seconde. L'interface previent avant, et `api_key_last_used_at` dit si la
 * boutique s'en sert encore.
 */
export async function rotateApiKey(id: string): Promise<{ key: string; slug: string } | null> {
  const { key, prefix, hash } = generateApiKey();

  // Le slug est rendu avec la cle pour que le journal des actions porte un nom
  // lisible plutot qu'un UUID : on relit une trace pour comprendre, pas pour
  // faire une jointure a la main.
  const rows = await sql<{ slug: string }[]>`
    UPDATE shops
    SET api_key_prefix = ${prefix},
        api_key_hash = ${hash},
        api_key_issued_at = now(),
        api_key_last_used_at = NULL
    WHERE id = ${id}
    RETURNING slug
  `;

  return rows[0] ? { key, slug: rows[0].slug } : null;
}

/** Les entites ERP d'une boutique active, dans l'ordre du reglage ; vide si elles ne sont pas renseignees. */
export async function shopErpEntities(slug: string): Promise<string[]> {
  const rows = await sql<{ settings: unknown }[]>`SELECT settings FROM shops WHERE slug = ${slug} AND active LIMIT 1`;
  return parseEntities(shopSettingsSchema.safeParse(rows[0]?.settings ?? {}).data?.erp?.entity) ?? [];
}

/** Reglages d'une boutique, tels qu'ils alimentent le bloc `shop` d'un payload. */
export async function shopSeedFor(slug: string): Promise<Record<string, unknown> | null> {
  const rows = await sql<{ name: string; settings: unknown }[]>`
    SELECT name, settings FROM shops WHERE slug = ${slug} AND active LIMIT 1
  `;
  if (!rows[0]) return null;

  const settings = shopSettingsSchema.safeParse(rows[0].settings ?? {}).data ?? {};
  return { name: rows[0].name, ...settings };
}
