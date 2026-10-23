import type { TransactionSql } from "postgres";
import { sql } from "./db";

/**
 * Les pages fixes du book d'une boutique : premieres et quatriemes de
 * couverture, intercalaires de categorie (migrations 012 et 016). Une boutique
 * a autant de couvertures qu'elle veut ; on choisit la sienne en composant.
 *
 * Ecrites par le seul super-administrateur (book:configure) ; lues par le
 * generateur de book. Les images sont des pages entieres, dessinees a part.
 */

export type BookPageKind = "couverture" | "quatrieme" | "intercalaire";

export type BookPage = {
  id: string;
  kind: BookPageKind;
  title: string | null;
  categories: string[];
  position: number;
  mime: string;
  bytes: number;
  updated_at: string;
};

/** Les images acceptees : celles que Chromium affiche pleine page sans conversion. */
export const BOOK_PAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
/** Une page A4 a 300 dpi en JPEG pese 1 a 3 Mo ; 15 Mo laisse de la marge a un PNG. */
export const MAX_BOOK_PAGE_BYTES = 15 * 1024 * 1024;

export async function listBookPages(shopSlug: string): Promise<BookPage[]> {
  return sql<BookPage[]>`
    SELECT p.id, p.kind, p.title, p.categories, p.position, p.mime, p.bytes, p.updated_at
    FROM book_pages p
    JOIN shops s ON s.id = p.shop_id
    WHERE s.slug = ${shopSlug}
    ORDER BY CASE p.kind WHEN 'couverture' THEN 0 WHEN 'intercalaire' THEN 1 ELSE 2 END, p.position, p.created_at
  `;
}

/** L'image d'une page, DANS la boutique demandee : un identifiant seul ne suffit pas a lire une autre boutique. */
export async function bookPageImage(id: string, shopSlug: string): Promise<{ mime: string; image: Buffer } | null> {
  if (!isUuid(id)) return null;
  const rows = await sql<{ mime: string; image: Buffer }[]>`
    SELECT p.mime, p.image FROM book_pages p JOIN shops s ON s.id = p.shop_id
    WHERE p.id = ${id} AND s.slug = ${shopSlug}
  `;
  return rows[0] ?? null;
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * Ajoute une couverture (premiere ou quatrieme), en fin de liste. Elle ne
 * remplace plus la precedente (migration 016) : pour changer l'image d'une
 * couverture existante, updatePage.
 */
export async function addCover(
  shopSlug: string,
  kind: "couverture" | "quatrieme",
  input: { title: string | null; image: { mime: string; data: Buffer } }
): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO book_pages (shop_id, kind, title, position, mime, bytes, image)
    SELECT s.id, ${kind}, ${input.title},
           (SELECT coalesce(max(position), 0) + 1 FROM book_pages WHERE shop_id = s.id AND kind = ${kind}),
           ${input.image.mime}, ${input.image.data.length}, ${input.image.data}
    FROM shops s WHERE s.slug = ${shopSlug}
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

/**
 * Cree un intercalaire, en fin de liste. Les categories donnees lui sont
 * rattachees, et RETIREES de tout autre intercalaire de la boutique : une
 * categorie n'ouvre qu'une section.
 */
export async function createDivider(
  shopSlug: string,
  input: { title: string; categories: string[]; image: { mime: string; data: Buffer } }
): Promise<string | null> {
  return sql.begin(async (tx) => {
    const [shop] = await tx<{ id: string }[]>`SELECT id FROM shops WHERE slug = ${shopSlug}`;
    if (!shop) return null;
    await releaseCategories(tx, shop.id, input.categories, null);
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO book_pages (shop_id, kind, title, categories, position, mime, bytes, image)
      VALUES (
        ${shop.id}, 'intercalaire', ${input.title}, ${input.categories}::text[],
        (SELECT coalesce(max(position), 0) + 1 FROM book_pages WHERE shop_id = ${shop.id} AND kind = 'intercalaire'),
        ${input.image.mime}, ${input.image.data.length}, ${input.image.data}
      )
      RETURNING id
    `;
    return row.id;
  });
}

/**
 * Modifie titre, image ou — pour un intercalaire seulement — categories d'une
 * page ; false si elle n'est pas de cette boutique.
 */
export async function updatePage(
  shopSlug: string,
  id: string,
  input: { title?: string; categories?: string[]; image?: { mime: string; data: Buffer } }
): Promise<boolean> {
  if (!isUuid(id)) return false;
  return sql.begin(async (tx) => {
    const [page] = await tx<{ shop_id: string; kind: BookPageKind }[]>`
      SELECT p.shop_id, p.kind FROM book_pages p JOIN shops s ON s.id = p.shop_id
      WHERE p.id = ${id} AND s.slug = ${shopSlug}
      FOR UPDATE OF p
    `;
    if (!page) return false;
    // Une couverture n'ouvre aucune categorie.
    if (page.kind !== "intercalaire") input = { ...input, categories: undefined };
    if (input.categories) await releaseCategories(tx, page.shop_id, input.categories, id);
    await tx`
      UPDATE book_pages SET
        title = coalesce(${input.title ?? null}, title),
        categories = coalesce(${input.categories ?? null}::text[], categories),
        mime = coalesce(${input.image?.mime ?? null}, mime),
        bytes = coalesce(${input.image ? input.image.data.length : null}::int, bytes),
        image = coalesce(${input.image?.data ?? null}::bytea, image),
        updated_at = now()
      WHERE id = ${id}
    `;
    return true;
  });
}

type Tx = TransactionSql<Record<string, never>>;

/** Retire ces categories des intercalaires de la boutique, sauf de `except`. */
async function releaseCategories(tx: Tx, shopId: string, categories: string[], except: string | null): Promise<void> {
  if (categories.length === 0) return;
  await tx`
    UPDATE book_pages
    SET categories = ARRAY(SELECT c FROM unnest(categories) AS c WHERE NOT (c = ANY(${categories}::text[]))),
        updated_at = now()
    WHERE shop_id = ${shopId} AND kind = 'intercalaire'
      AND categories && ${categories}::text[]
      AND (${except}::uuid IS NULL OR id <> ${except}::uuid)
  `;
}

/**
 * Echange la position d'une page avec sa voisine DE MEME NATURE (-1 : remonte,
 * +1 : descend) : l'ordre des intercalaires dans le book, ou celui des
 * couvertures proposees — la premiere est le choix par defaut.
 */
export async function movePage(shopSlug: string, id: string, direction: -1 | 1): Promise<boolean> {
  if (!isUuid(id)) return false;
  return sql.begin(async (tx) => {
    const pages = await tx<{ id: string; position: number }[]>`
      SELECT p.id, p.position FROM book_pages p JOIN shops s ON s.id = p.shop_id
      WHERE s.slug = ${shopSlug}
        AND p.kind = (SELECT kind FROM book_pages WHERE id = ${id})
      ORDER BY p.position, p.created_at
      FOR UPDATE OF p
    `;
    const index = pages.findIndex((page) => page.id === id);
    const other = pages[index + direction];
    if (index === -1 || !other) return index !== -1;
    // Renumerote toute la liste : deux positions egales (heritees d'un import)
    // rendraient l'echange sans effet.
    const order = pages.map((page) => page.id);
    [order[index], order[index + direction]] = [order[index + direction], order[index]];
    for (const [position, pageId] of order.entries()) {
      await tx`UPDATE book_pages SET position = ${position + 1} WHERE id = ${pageId}`;
    }
    return true;
  });
}

export async function deleteBookPage(shopSlug: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await sql`
    DELETE FROM book_pages p USING shops s
    WHERE s.id = p.shop_id AND s.slug = ${shopSlug} AND p.id = ${id}
    RETURNING p.id
  `;
  return rows.length > 0;
}
