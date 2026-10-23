import { sql } from "./db";
import type { TemplateTrees } from "./render";
import { expandTreesForShop } from "./componentStore";

export type ResolvedTemplate = {
  templateId: string;
  templateName: string;
  versionId: string;
  versionNumber: number;
  trees: TemplateTrees;
};

type VersionRow = {
  template_id: string;
  template_name: string;
  version_id: string;
  number: number;
  body: unknown;
  header: unknown;
  footer: unknown;
  css: string | null;
  settings: Record<string, unknown> | null;
};

/**
 * Resout un slug de template pour une boutique donnee.
 *
 * Un template propre a la boutique masque un template de bibliotheque portant
 * le meme slug : c'est ce qui permet a un site de partir du modele commun puis
 * de le surcharger sans renommer, ni toucher aux autres sites.
 */
export async function resolveTemplate(
  shopId: string,
  slug: string,
  version: "published" | number
): Promise<ResolvedTemplate | null> {
  const rows =
    version === "published"
      ? await sql<VersionRow[]>`
          SELECT t.id AS template_id, t.name AS template_name,
                 v.id AS version_id, v.number, v.body, v.header, v.footer, v.css, v.settings
          FROM templates t
          JOIN template_versions v ON v.id = t.published_version_id
          WHERE t.slug = ${slug}
            AND t.kind = 'template'
            AND (t.shop_id = ${shopId} OR t.shop_id IS NULL)
          ORDER BY (t.shop_id IS NULL)
          LIMIT 1
        `
      : await sql<VersionRow[]>`
          SELECT t.id AS template_id, t.name AS template_name,
                 v.id AS version_id, v.number, v.body, v.header, v.footer, v.css, v.settings
          FROM templates t
          JOIN template_versions v ON v.template_id = t.id
          WHERE t.slug = ${slug}
            AND t.kind = 'template'
            AND v.number = ${version}
            AND (t.shop_id = ${shopId} OR t.shop_id IS NULL)
          ORDER BY (t.shop_id IS NULL)
          LIMIT 1
        `;

  const row = rows[0];
  if (!row) return null;

  const settings = row.settings ?? {};
  return {
    templateId: row.template_id,
    templateName: row.template_name,
    versionId: row.version_id,
    versionNumber: row.number,
    // Les blocs « Composant » sont deplies ici, avec la version publiee de
    // chaque composant pour CETTE boutique : le moteur de rendu ne les voit pas.
    trees: await expandTreesForShop(
      {
        body: row.body as TemplateTrees["body"],
        header: (row.header ?? null) as TemplateTrees["header"],
        footer: (row.footer ?? null) as TemplateTrees["footer"],
        css: row.css,
        geometry: (settings.geometry ?? null) as TemplateTrees["geometry"],
      },
      shopId
    ),
  };
}

export type TemplateSummary = {
  slug: string;
  name: string;
  shared: boolean;
  published_version: number | null;
  updated_at: string;
};

/** Alimente le select du back-office : templates du site + bibliotheque commune. */
export async function listTemplates(shopId: string): Promise<TemplateSummary[]> {
  return sql<TemplateSummary[]>`
    SELECT t.slug,
           t.name,
           (t.shop_id IS NULL) AS shared,
           v.number AS published_version,
           t.updated_at
    FROM templates t
    LEFT JOIN template_versions v ON v.id = t.published_version_id
    WHERE (t.shop_id = ${shopId} OR t.shop_id IS NULL)
      -- Un composant n'est pas un template : une boutique ne doit pas pouvoir
      -- le choisir comme modele de fiche.
      AND t.kind = 'template'
    ORDER BY (t.shop_id IS NULL), t.name
  `;
}

/**
 * Statuts ecrits dans render_logs. Le journal les lit, ils sont donc un contrat.
 *
 *   ok                rendu servi
 *   ok_with_warnings  rendu servi, mais des references manquaient
 *   error             rendu impossible (template casse, Chromium en echec)
 *   saturated         refuse faute de place — voir src/lib/renderQueue.ts
 */
export type RenderStatus = "ok" | "ok_with_warnings" | "error" | "saturated";

export async function logRender(entry: {
  /**
   * null quand le rendu ne vient d'aucune boutique : la page d'import peut
   * travailler sur la seule bibliotheque commune. La colonne est nullable et le
   * journal fait deja un LEFT JOIN — une ligne sans boutique s'y affiche.
   */
  shopId: string | null;
  templateId: string | null;
  version: number | null;
  productRef: string | null;
  locale: string;
  status: RenderStatus;
  durationMs: number;
  /** Attente en file. Distingue un rendu lent d'un rendu qui a attendu son tour. */
  queuedMs?: number;
  bytes: number | null;
  warnings: string[];
  error: string | null;
  /**
   * COMMENT le template a ete choisi : 'explicite' (l'appelant a nomme un
   * slug), 'regle' (une regle de categorie a correspondu), 'defaut' (aucune
   * n'a correspondu).
   *
   * Ce n'est pas de la statistique. Les regles comparent des LIBELLES de
   * categorie : renommer une categorie en back-office ne leve rien, les fiches
   * retombent simplement sur le defaut et sortent. C'est cette colonne, avec le
   * fil d'ariane ci-dessous, qui rend la panne visible dans /journal.
   */
  resolvedBy?: "explicite" | "regle" | "defaut" | null;
  categoryPath?: readonly string[] | null;
}): Promise<void> {
  await sql`
    INSERT INTO render_logs
      (shop_id, template_id, version, product_ref, locale, status, duration_ms, queued_ms,
       bytes, warnings, error, resolved_by, category_path)
    VALUES
      (${entry.shopId}, ${entry.templateId}, ${entry.version}, ${entry.productRef}, ${entry.locale},
       ${entry.status}, ${entry.durationMs}, ${entry.queuedMs ?? null}, ${entry.bytes},
       ${sql.json(entry.warnings)}, ${entry.error}, ${entry.resolvedBy ?? null},
       ${entry.categoryPath?.length ? entry.categoryPath.join(" > ") : null})
  `;
}
