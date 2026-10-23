import { sql } from "./db";
import type { SortKey } from "./datasheets";

/**
 * L'index des fiches techniques — acces base.
 *
 * Alimente par chaque rendu reussi de POST /api/v1/render, lu par /consultation.
 * Voir la migration 009 pour ce que le Studio accepte de ne pas savoir : un
 * produit jamais genere n'y figure pas. La partie pure (cles, noms de fichiers)
 * est dans datasheets.ts.
 */

export type DatasheetEntry = {
  shopId: string;
  productKey: string;
  locale: string;
  productId: string | null;
  productRef: string | null;
  productName: string;
  datasheetUrl: string | null;
  templateSlug: string | null;
  templateVersion: number | null;
  /** Fil de categories, du plus general au plus precis. */
  categoryPath: string[];
  /**
   * References de declinaison et fournisseur (migration 017), deja passees par
   * indexedRefs. null : le payload n'en portait pas, l'index garde les siennes.
   */
  variantSkus: string[] | null;
  supplierSkus: string[] | null;
};

export type DatasheetRow = {
  product_key: string;
  locale: string;
  product_id: string | null;
  product_ref: string | null;
  product_name: string;
  datasheet_url: string | null;
  template_slug: string | null;
  template_version: number | null;
  category_path: string[];
  rendered_at: string;
};

/**
 * Une ligne de la liste, avec ce qui a fait repondre la recherche quand ce n'est
 * pas visible a l'ecran : la reference de declinaison ou fournisseur trouvee.
 * Les listes entieres ne remontent pas — mille references par produit, sur des
 * milliers de lignes, pour en montrer une.
 */
export type DatasheetListRow = DatasheetRow & {
  matched_variant_sku: string | null;
  matched_supplier_sku: string | null;
};

/**
 * Cree ou met a jour la ligne d'un produit.
 *
 * L'ADRESSE N'EST JAMAIS EFFACEE PAR UN RENDU QUI N'EN PORTE PAS : un appel ponctuel
 * sans `datasheet_url` (un outil de test, un ancien collecteur) ne doit pas faire
 * perdre le lien qu'un rendu precedent du module avait donne. Meme regle pour les
 * references de declinaison et fournisseur — mais une liste VIDE, elle, efface.
 */
export async function recordDatasheet(entry: DatasheetEntry): Promise<void> {
  await sql`
    INSERT INTO datasheets (
      shop_id, product_key, locale, product_id, product_ref, product_name,
      datasheet_url, template_slug, template_version, category_path, variant_skus, supplier_skus, rendered_at
    ) VALUES (
      ${entry.shopId}, ${entry.productKey}, ${entry.locale}, ${entry.productId}, ${entry.productRef},
      ${entry.productName}, ${entry.datasheetUrl}, ${entry.templateSlug}, ${entry.templateVersion},
      ${entry.categoryPath}::text[], coalesce(${entry.variantSkus}::text[], '{}'),
      coalesce(${entry.supplierSkus}::text[], '{}'), now()
    )
    ON CONFLICT (shop_id, product_key, locale) DO UPDATE SET
      product_id = EXCLUDED.product_id,
      product_ref = EXCLUDED.product_ref,
      product_name = EXCLUDED.product_name,
      datasheet_url = COALESCE(EXCLUDED.datasheet_url, datasheets.datasheet_url),
      template_slug = EXCLUDED.template_slug,
      template_version = EXCLUDED.template_version,
      category_path = EXCLUDED.category_path,
      variant_skus = coalesce(${entry.variantSkus}::text[], datasheets.variant_skus),
      supplier_skus = coalesce(${entry.supplierSkus}::text[], datasheets.supplier_skus),
      rendered_at = now()
  `;
}

/**
 * « Cette fiche n'est ni rangee sous une categorie masquee, ni masquee elle-meme »
 * — voir les migrations 014 et 015. Pose dans CHAQUE lecture de l'index destinee a la consultation
 * (liste, selection pour le zip et le book, categories des intercalaires) : un
 * masquage qui ne vaudrait qu'a l'ecran laisserait une requete fabriquee a la
 * main mettre la fiche dans un book.
 *
 * Comparaison sur le DEBUT du fil : masquer {Vestiaires} masque aussi
 * {Vestiaires, Casiers}. `d` designe la table datasheets dans la requete.
 * Une fonction et non une constante : un fragment neuf par requete.
 */
const notHidden = () => sql`NOT EXISTS (
  SELECT 1 FROM hidden_categories h
  WHERE h.shop_id = d.shop_id
    AND d.category_path[1:cardinality(h.path)] = h.path
) AND NOT EXISTS (
  SELECT 1 FROM hidden_datasheets x
  WHERE x.shop_id = d.shop_id AND x.product_key = d.product_key
)`;

/**
 * Les fiches d'une boutique, triees par nom.
 *
 * LA RECHERCHE PORTE SUR LE NOM, L'IDENTIFIANT ET LES REFERENCES — celle du
 * produit, de ses declinaisons et de ses fournisseurs (migration 017) : c'est
 * l'un d'eux qu'on a en tete en cherchant une fiche. `position` et non `ILIKE` :
 * le texte saisi ne doit pas pouvoir devenir un motif — un « % » ou un « _ »
 * tape pour de bon chercherait n'importe quoi.
 */
export async function listDatasheets(
  shopSlug: string,
  query = "",
  sort: SortKey = "nom"
): Promise<DatasheetListRow[]> {
  const needle = query.trim().toLowerCase();
  // LA REFERENCE EXACTE D'ABORD, sinon la premiere qui contient le texte. Le
  // catalogue Acme range des compositions parmi ses references fournisseur
  // (« {109423:1,105651:1} ») : chercher « 109423 » doit afficher 109423, qui
  // est aussi dans la liste, et non la composition qui la precede.
  const firstMatch = (refs: ReturnType<typeof sql>) => sql`(
    SELECT ref FROM unnest(${refs}) WITH ORDINALITY AS r(ref, n)
    WHERE ${needle} <> '' AND position(${needle} IN lower(ref)) > 0
    ORDER BY lower(ref) = ${needle} DESC, n
    LIMIT 1
  )`;
  return sql<DatasheetListRow[]>`
    SELECT d.product_key, d.locale, d.product_id, d.product_ref, d.product_name, d.datasheet_url,
           d.template_slug, d.template_version, d.category_path, d.rendered_at,
           ${firstMatch(sql`d.variant_skus`)} AS matched_variant_sku,
           ${firstMatch(sql`d.supplier_skus`)} AS matched_supplier_sku
    FROM datasheets d
    JOIN shops s ON s.id = d.shop_id
    WHERE s.slug = ${shopSlug}
      AND ${notHidden()}
      AND (
        ${needle} = ''
        OR position(${needle} IN lower(d.product_name)) > 0
        OR position(${needle} IN lower(coalesce(d.product_id, ''))) > 0
        OR position(${needle} IN lower(coalesce(d.product_ref, ''))) > 0
        OR EXISTS (
          SELECT 1 FROM unnest(d.variant_skus || d.supplier_skus) AS ref
          WHERE position(${needle} IN lower(ref)) > 0
        )
      )
    ORDER BY ${orderBy(sort)}
  `;
}

/**
 * L'ordre de la liste, en SQL : une boutique de plusieurs milliers de produits
 * se trie mieux dans la base que dans l'onglet.
 *
 * Chaque tri finit par le nom, puis la cle et la langue : deux lignes ne sont
 * jamais a egalite, et l'ordre ne change pas d'un affichage a l'autre.
 */
function orderBy(sort: SortKey) {
  const tail = sql`lower(d.product_name), d.product_key, d.locale`;
  switch (sort) {
    case "categorie":
      // Les produits sans categorie en dernier, comme leur intercalaire.
      return sql`(d.category_path[1] IS NULL OR d.category_path[1] = ''), lower(d.category_path[1]), ${tail}`;
    case "id":
      // Les identifiants numeriques dans l'ordre des nombres : « 99 » avant
      // « 100 », que l'ordre alphabetique inverserait.
      return sql`(coalesce(d.product_id, d.product_key) ~ '^[0-9]{1,18}$') DESC,
                 CASE WHEN coalesce(d.product_id, d.product_key) ~ '^[0-9]{1,18}$'
                      THEN coalesce(d.product_id, d.product_key)::bigint END,
                 coalesce(d.product_id, d.product_key), ${tail}`;
    case "date":
      return sql`d.rendered_at DESC, ${tail}`;
    default:
      return tail;
  }
}

/**
 * Les lignes designees par une selection, DANS LA BOUTIQUE DEMANDEE SEULEMENT.
 *
 * C'est ce filtre qui fait que le zip ne telecharge que des adresses envoyees
 * par la boutique elle-meme : la requete du navigateur ne porte que des cles,
 * jamais d'URL.
 */
export async function datasheetsBySelection(
  shopSlug: string,
  selection: { locale: string; productKey: string }[]
): Promise<DatasheetRow[]> {
  if (selection.length === 0) return [];
  const locales = selection.map((item) => item.locale);
  const keys = selection.map((item) => item.productKey);

  return sql<DatasheetRow[]>`
    SELECT d.product_key, d.locale, d.product_id, d.product_ref, d.product_name, d.datasheet_url,
           d.template_slug, d.template_version, d.category_path, d.rendered_at
    FROM datasheets d
    JOIN shops s ON s.id = d.shop_id
    JOIN unnest(${locales}::text[], ${keys}::text[]) AS wanted(locale, product_key)
      ON wanted.locale = d.locale AND wanted.product_key = d.product_key
    WHERE s.slug = ${shopSlug}
      AND ${notHidden()}
    ORDER BY lower(d.product_name), d.product_key, d.locale
  `;
}

/** Les icones choisies pour les categories d'une boutique, par nom de categorie. */
export async function categoryIcons(shopSlug: string): Promise<Map<string, string>> {
  const rows = await sql<{ category: string; icon: string }[]>`
    SELECT c.category, c.icon
    FROM category_icons c
    JOIN shops s ON s.id = c.shop_id
    WHERE s.slug = ${shopSlug}
  `;
  return new Map(rows.map((row) => [row.category, row.icon]));
}

/** Pose l'icone d'une categorie ; false si la boutique n'existe pas. */
export async function setCategoryIcon(shopSlug: string, category: string, icon: string): Promise<boolean> {
  const rows = await sql`
    INSERT INTO category_icons (shop_id, category, icon)
    SELECT id, ${category}, ${icon} FROM shops WHERE slug = ${shopSlug}
    ON CONFLICT (shop_id, category) DO UPDATE SET icon = EXCLUDED.icon, updated_at = now()
    RETURNING shop_id
  `;
  return rows.length > 0;
}

/**
 * Les categories de niveau 1 des fiches connues d'une boutique, avec leur
 * effectif : ce que les reglages du book proposent d'associer a un intercalaire.
 */
export async function topCategories(shopSlug: string): Promise<{ category: string; count: number }[]> {
  return sql<{ category: string; count: number }[]>`
    SELECT d.category_path[1] AS category, count(*)::int AS count
    FROM datasheets d
    JOIN shops s ON s.id = d.shop_id
    WHERE s.slug = ${shopSlug} AND coalesce(d.category_path[1], '') <> ''
      AND ${notHidden()}
    GROUP BY 1
    ORDER BY 2 DESC, 1
  `;
}

export type CategoryNode = {
  /** Le fil complet, du plus general au plus precis. */
  path: string[];
  /** Fiches rangees sous ce fil (sous-categories comprises), masquees ou non. */
  count: number;
  /** Masquee elle-meme. */
  hidden: boolean;
  /** Masquee parce qu'une categorie au-dessus d'elle l'est. */
  hiddenByParent: boolean;
};

/**
 * Toutes les categories connues de l'index d'une boutique, a tous les niveaux,
 * avec leur effectif et leur etat — ce que la page de reglage montre. Chaque
 * prefixe du fil d'une fiche est une categorie : la fiche {A, B, C} compte pour
 * A, A > B et A > B > C. Triees dans l'ordre de l'arbre.
 *
 * Une categorie masquee qui n'a plus aucune fiche (renommee cote boutique) est
 * rendue aussi, avec un effectif nul : sinon elle resterait masquee sans qu'on
 * puisse la retrouver pour la reafficher.
 */
export async function categoryTree(shopSlug: string): Promise<CategoryNode[]> {
  const rows = await sql<{ path: string[]; count: number }[]>`
    SELECT d.category_path[1:n] AS path, count(*)::int AS count
    FROM datasheets d
    JOIN shops s ON s.id = d.shop_id
    CROSS JOIN LATERAL generate_series(1, cardinality(d.category_path)) AS n
    WHERE s.slug = ${shopSlug} AND coalesce(d.category_path[n], '') <> ''
    GROUP BY 1
  `;
  const hidden = await hiddenCategories(shopSlug);
  const key = (path: string[]) => JSON.stringify(path);
  const hiddenKeys = new Set(hidden.map(key));

  const nodes = new Map(rows.map((row) => [key(row.path), { path: row.path, count: row.count }]));
  for (const path of hidden) if (!nodes.has(key(path))) nodes.set(key(path), { path, count: 0 });

  return [...nodes.values()]
    .map((node) => ({
      ...node,
      hidden: hiddenKeys.has(key(node.path)),
      hiddenByParent: node.path.some((_, index) => index > 0 && hiddenKeys.has(key(node.path.slice(0, index)))),
    }))
    .sort((a, b) => compareCategoryPaths(a.path, b.path));
}

/** L'ordre de l'arbre : un parent avant ses enfants, les freres par ordre alphabetique. */
export function compareCategoryPaths(a: string[], b: string[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const order = a[index].localeCompare(b[index], "fr", { sensitivity: "base" });
    if (order !== 0) return order;
  }
  return a.length - b.length;
}

/** Les fils masques d'une boutique. */
export async function hiddenCategories(shopSlug: string): Promise<string[][]> {
  const rows = await sql<{ path: string[] }[]>`
    SELECT h.path FROM hidden_categories h JOIN shops s ON s.id = h.shop_id WHERE s.slug = ${shopSlug}
  `;
  return rows.map((row) => row.path);
}

/** Masque ou reaffiche une categorie ; false si la boutique n'existe pas. */
export async function setCategoryHidden(
  shopSlug: string,
  path: string[],
  hidden: boolean,
  actorId: string | null
): Promise<boolean> {
  const shops = await sql<{ id: string }[]>`SELECT id FROM shops WHERE slug = ${shopSlug}`;
  if (!shops[0]) return false;
  if (hidden) {
    await sql`
      INSERT INTO hidden_categories (shop_id, path, created_by)
      VALUES (${shops[0].id}, ${path}::text[], ${actorId})
      ON CONFLICT (shop_id, path) DO NOTHING
    `;
  } else {
    await sql`DELETE FROM hidden_categories WHERE shop_id = ${shops[0].id} AND path = ${path}::text[]`;
  }
  return true;
}

export type HiddenDatasheet = {
  productKey: string;
  /** Repris de l'index ; null si le produit n'y figure plus. */
  productId: string | null;
  productName: string | null;
  categoryPath: string[];
  hiddenAt: string;
};

/**
 * Les produits masques d'une boutique (migration 015), avec de quoi les
 * reconnaitre — nom, identifiant, categorie — repris de l'index, toutes langues
 * confondues. Un produit masque qui a quitte l'index reste liste, par sa cle,
 * pour pouvoir le reafficher.
 */
export async function hiddenDatasheets(shopSlug: string): Promise<HiddenDatasheet[]> {
  const rows = await sql<
    { product_key: string; product_id: string | null; product_name: string | null; category_path: string[] | null; created_at: string }[]
  >`
    SELECT x.product_key, d.product_id, d.product_name, d.category_path, x.created_at
    FROM hidden_datasheets x
    JOIN shops s ON s.id = x.shop_id
    LEFT JOIN LATERAL (
      SELECT product_id, product_name, category_path FROM datasheets
      WHERE shop_id = x.shop_id AND product_key = x.product_key
      -- Le nom francais d'abord, s'il existe : c'est la langue de l'equipe.
      ORDER BY (locale = 'fr') DESC, rendered_at DESC LIMIT 1
    ) d ON true
    WHERE s.slug = ${shopSlug}
    ORDER BY lower(coalesce(d.product_name, x.product_key)), x.product_key
  `;
  return rows.map((row) => ({
    productKey: row.product_key,
    productId: row.product_id,
    productName: row.product_name,
    categoryPath: row.category_path ?? [],
    hiddenAt: row.created_at,
  }));
}

/** Masque ou reaffiche des produits ; false si la boutique n'existe pas. */
export async function setDatasheetsHidden(
  shopSlug: string,
  productKeys: string[],
  hidden: boolean,
  actorId: string | null
): Promise<boolean> {
  const shops = await sql<{ id: string }[]>`SELECT id FROM shops WHERE slug = ${shopSlug}`;
  if (!shops[0]) return false;
  if (productKeys.length === 0) return true;
  if (hidden) {
    await sql`
      INSERT INTO hidden_datasheets (shop_id, product_key, created_by)
      SELECT ${shops[0].id}, key, ${actorId} FROM unnest(${productKeys}::text[]) AS key
      ON CONFLICT (shop_id, product_key) DO NOTHING
    `;
  } else {
    await sql`
      DELETE FROM hidden_datasheets
      WHERE shop_id = ${shops[0].id} AND product_key = ANY(${productKeys}::text[])
    `;
  }
  return true;
}

export type SupplierRefRow = {
  /** La reference telle que l'index la garde. */
  ref: string;
  product_key: string;
  locale: string;
  product_id: string | null;
  product_name: string;
  datasheet_url: string | null;
  category_path: string[];
};

/**
 * Les references fournisseur d'une boutique et d'une langue qui peuvent repondre
 * aux morceaux d'un collage — l'import d'un book par references (bookImport.ts) :
 *
 *   - celles qui sont EGALES a un morceau, jamais une sous-chaine : un morceau
 *     de devis qui CONTIENT une reference n'est pas elle ;
 *   - les PACKAGES (« {109445:1,109417:1} ») dont AU MOINS UNE reference est
 *     citee. C'est un tri grossier, volontairement plus large : resolveImport
 *     exige ensuite qu'elles le soient toutes, avec la lecture exacte du format
 *     (packageParts) — une seule implementation de la regle, testee.
 *
 * `refs` arrive deja normalise (normalizeRef : sans casse, espaces reduits) ;
 * l'index l'est ici de la meme facon, sans quoi « TPM  2500 » enregistre avec
 * deux espaces ne serait jamais retrouve.
 *
 * Les fiches masquees n'existent pas pour l'import, comme pour la liste.
 */
export async function supplierRefMatches(shopSlug: string, locale: string, refs: string[]): Promise<SupplierRefRow[]> {
  if (refs.length === 0) return [];
  return sql<SupplierRefRow[]>`
    SELECT ref, d.product_key, d.locale, d.product_id, d.product_name, d.datasheet_url, d.category_path
    FROM datasheets d
    JOIN shops s ON s.id = d.shop_id
    CROSS JOIN LATERAL unnest(d.supplier_skus) AS ref
    WHERE s.slug = ${shopSlug}
      AND d.locale = ${locale}
      AND ${notHidden()}
      AND (
        lower(regexp_replace(btrim(ref), '\\s+', ' ', 'g')) = ANY(${refs}::text[])
        OR (
          btrim(ref) LIKE '{%'
          AND EXISTS (
            SELECT 1 FROM unnest(string_to_array(btrim(ref, '{} '), ',')) AS piece
            WHERE lower(regexp_replace(btrim(split_part(piece, ':', 1)), '\\s+', ' ', 'g')) = ANY(${refs}::text[])
          )
        )
      )
    ORDER BY lower(d.product_name), d.product_key
  `;
}

/**
 * Les langues de l'index d'une boutique, la plus fournie d'abord, avec le nombre
 * de fiches qui portent au moins une reference fournisseur : un import qui ne
 * trouve rien doit pouvoir dire si c'est le collage, ou l'index qui n'en a
 * encore aucune (connecteur pas a jour, fiches pas regenerees).
 */
export async function indexLocales(shopSlug: string): Promise<{ locale: string; count: number; withSupplierRefs: number }[]> {
  const rows = await sql<{ locale: string; count: number; with_refs: number }[]>`
    SELECT d.locale, count(*)::int AS count, count(*) FILTER (WHERE cardinality(d.supplier_skus) > 0)::int AS with_refs
    FROM datasheets d
    JOIN shops s ON s.id = d.shop_id
    WHERE s.slug = ${shopSlug} AND ${notHidden()}
    GROUP BY d.locale
    ORDER BY count(*) DESC, d.locale
  `;
  return rows.map((row) => ({ locale: row.locale, count: row.count, withSupplierRefs: row.with_refs }));
}
