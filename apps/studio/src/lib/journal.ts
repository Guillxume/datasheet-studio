import { sql } from "./db";

/**
 * Lecture de render_logs.
 *
 * La table etait alimentee depuis le premier jour et personne ne la lisait : durees,
 * poids, avertissements et erreurs de chaque rendu de production, avec un index
 * partiel sur les echecs, invisibles. Sur un parc qui genere en masse, « est-ce que
 * ca se passe bien en ce moment ? » n'avait aucune reponse hors d'un accès psql.
 *
 * Les centiles ecartent les requetes REFUSEES (status = 'saturated') : leur duree
 * est celle d'un refus, quelques millisecondes, et les compter ferait baisser le
 * p95 au moment precis ou le service se degrade.
 */

/** Fenetres proposees, en heures. Une valeur hors liste retombe sur 24 h. */
export const JOURNAL_WINDOWS = [
  { hours: 1, label: "1 heure" },
  { hours: 24, label: "24 heures" },
  { hours: 168, label: "7 jours" },
  { hours: 720, label: "30 jours" },
];

export const DEFAULT_WINDOW_HOURS = 24;

export function resolveWindowHours(raw: string | undefined): number {
  const value = Number(raw);
  return JOURNAL_WINDOWS.some((entry) => entry.hours === value) ? value : DEFAULT_WINDOW_HOURS;
}

export type JournalSummary = {
  total: number;
  ok: number;
  with_warnings: number;
  errors: number;
  saturated: number;
  p50_ms: number | null;
  p95_ms: number | null;
  p95_queued_ms: number | null;
  max_queued_ms: number | null;
  avg_bytes: number | null;
};

export async function readSummary(hours: number): Promise<JournalSummary> {
  const rows = await sql<JournalSummary[]>`
    SELECT count(*)::int                                        AS total,
           count(*) FILTER (WHERE status = 'ok')::int            AS ok,
           count(*) FILTER (WHERE status = 'ok_with_warnings')::int AS with_warnings,
           count(*) FILTER (WHERE status = 'error')::int         AS errors,
           count(*) FILTER (WHERE status = 'saturated')::int     AS saturated,
           percentile_disc(0.5) WITHIN GROUP (ORDER BY duration_ms)
             FILTER (WHERE status <> 'saturated')                AS p50_ms,
           percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms)
             FILTER (WHERE status <> 'saturated')                AS p95_ms,
           percentile_disc(0.95) WITHIN GROUP (ORDER BY queued_ms)
             FILTER (WHERE queued_ms IS NOT NULL)                AS p95_queued_ms,
           max(queued_ms)                                       AS max_queued_ms,
           avg(bytes) FILTER (WHERE bytes IS NOT NULL)::int      AS avg_bytes
    FROM render_logs
    WHERE created_at > now() - ${hours} * interval '1 hour'
  `;

  return rows[0];
}

export type TemplateStat = {
  template: string | null;
  shop: string | null;
  version: number | null;
  total: number;
  errors: number;
  with_warnings: number;
  p95_ms: number | null;
  avg_bytes: number | null;
};

/**
 * Par template ET par boutique : un meme template de bibliotheque sert plusieurs
 * sites, et c'est justement la combinaison qui echoue — un catalogue dont les
 * produits sont plus fournis, une identite aux couleurs plus sombres.
 */
export async function readByTemplate(hours: number): Promise<TemplateStat[]> {
  return sql<TemplateStat[]>`
    SELECT t.name                                               AS template,
           s.slug                                               AS shop,
           max(l.version)                                       AS version,
           count(*)::int                                        AS total,
           count(*) FILTER (WHERE l.status = 'error')::int       AS errors,
           count(*) FILTER (WHERE l.status = 'ok_with_warnings')::int AS with_warnings,
           percentile_disc(0.95) WITHIN GROUP (ORDER BY l.duration_ms)
             FILTER (WHERE l.status <> 'saturated')              AS p95_ms,
           avg(l.bytes) FILTER (WHERE l.bytes IS NOT NULL)::int  AS avg_bytes
    FROM render_logs l
    LEFT JOIN templates t ON t.id = l.template_id
    LEFT JOIN shops s ON s.id = l.shop_id
    WHERE l.created_at > now() - ${hours} * interval '1 hour'
    GROUP BY t.name, s.slug
    ORDER BY count(*) FILTER (WHERE l.status = 'error') DESC, count(*) DESC
  `;
}

export type WarningStat = { kind: string; example: string; total: number };

/**
 * Avertissements regroupes par NATURE.
 *
 * Un avertissement porte la reference fautive (« asset introuvable a images[0].src :
 * asset://img-0 ») : les compter tels quels donnerait une liste de milliers de
 * lignes uniques, ou l'on ne verrait pas que c'est le meme probleme. On neutralise
 * donc l'indice de tableau et ce qui suit le deux-points, en gardant un exemplaire
 * comme illustration.
 */
export async function readWarnings(hours: number): Promise<WarningStat[]> {
  return sql<WarningStat[]>`
    SELECT regexp_replace(regexp_replace(w, '\\[[0-9]+\\]', '[n]', 'g'), ' : .*$', '') AS kind,
           min(w)       AS example,
           count(*)::int AS total
    FROM (
      SELECT warnings
      FROM render_logs
      WHERE created_at > now() - ${hours} * interval '1 hour'
        AND jsonb_typeof(warnings) = 'array'
    ) r
    CROSS JOIN LATERAL jsonb_array_elements_text(r.warnings) AS w
    GROUP BY kind
    ORDER BY total DESC
    LIMIT 15
  `;
}

export type FailureRow = {
  created_at: string;
  shop: string | null;
  template: string | null;
  version: number | null;
  product_ref: string | null;
  status: string;
  duration_ms: number | null;
  error: string | null;
};

/** Les derniers echecs, avec de quoi rejouer : la boutique, le template, le produit. */
export async function readFailures(hours: number, limit = 25): Promise<FailureRow[]> {
  return sql<FailureRow[]>`
    SELECT l.created_at, s.slug AS shop, t.name AS template, l.version, l.product_ref,
           l.status, l.duration_ms, l.error
    FROM render_logs l
    LEFT JOIN templates t ON t.id = l.template_id
    LEFT JOIN shops s ON s.id = l.shop_id
    WHERE l.created_at > now() - ${hours} * interval '1 hour'
      AND l.status IN ('error', 'saturated')
    ORDER BY l.created_at DESC
    LIMIT ${limit}
  `;
}

export type DayStat = { day: string; total: number; errors: number; saturated: number };

export async function readByDay(hours: number): Promise<DayStat[]> {
  return sql<DayStat[]>`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD')  AS day,
           count(*)::int                                         AS total,
           count(*) FILTER (WHERE status = 'error')::int          AS errors,
           count(*) FILTER (WHERE status = 'saturated')::int      AS saturated
    FROM render_logs
    WHERE created_at > now() - ${hours} * interval '1 hour'
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 31
  `;
}

export type UnmatchedCategory = {
  category_path: string | null;
  shop: string | null;
  template: string | null;
  total: number;
  derniere: string;
};

/**
 * Les fiches rendues PAR DEFAUT, faute de regle correspondante.
 *
 * C'EST UNE ALARME, PAS UNE STATISTIQUE. Les regles de template comparent des
 * LIBELLES de categorie (voir src/lib/templateRules.ts). Renommer « Manutention »
 * en « Manutention & levage » dans un back-office ne leve strictement rien : les
 * regles cessent de correspondre, toutes les fiches concernees retombent sur le
 * template par defaut, et elles sortent. Aucune erreur, aucun avertissement.
 *
 * C'est exactement le defaut dont ce depot porte la cicatrice : l'ancien module
 * appariait les caracteristiques par libelle traduit, et tout cassait en silence
 * au premier renommage.
 *
 * Cette liste est la reponse : elle donne les chemins de categorie a couvrir,
 * classes par volume. Elle se lit sans connaitre le catalogue.
 */
export async function readUnmatchedCategories(hours: number, limit = 20): Promise<UnmatchedCategory[]> {
  return sql<UnmatchedCategory[]>`
    SELECT l.category_path,
           s.slug                    AS shop,
           t.slug                    AS template,
           count(*)::int             AS total,
           max(l.created_at)         AS derniere
    FROM render_logs l
    LEFT JOIN shops s ON s.id = l.shop_id
    LEFT JOIN templates t ON t.id = l.template_id
    WHERE l.created_at > now() - ${hours} * interval '1 hour'
      AND l.resolved_by = 'defaut'
    GROUP BY 1, 2, 3
    ORDER BY 4 DESC
    LIMIT ${limit}
  `;
}

/* ------------------------------------------------------------------------- */
/* Retention                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * `render_logs` n'avait AUCUNE retention, et c'est le seul defaut de ce depot
 * qui empire tout seul.
 *
 * Une ligne par rendu, sans limite : un parc qui genere en masse en produit des
 * centaines de milliers par mois. La table grossit, les agregats de cette page
 * ralentissent, et la sauvegarde enfle — sans que personne ne decide rien. Un an
 * plus tard, la question « pourquoi le journal met huit secondes » n'a plus de
 * reponse simple.
 *
 * QUATRE-VINGT-DIX JOURS par defaut. C'est la fenetre au-dela de laquelle une
 * ligne de rendu ne sert plus a rien : on diagnostique un echec de la semaine,
 * on compare un mois a l'autre, on ne remonte pas a l'an dernier. La plus longue
 * fenetre proposee par l'interface est d'ailleurs bien en deca.
 *
 * `RENDER_LOG_RETENTION_DAYS=0` desactive la purge, pour qui voudrait tout
 * garder et l'archiver autrement.
 */
export function retentionDays(): number {
  const value = Number(process.env.RENDER_LOG_RETENTION_DAYS ?? 90);
  return Number.isFinite(value) && value >= 0 ? value : 90;
}

/**
 * Supprime un LOT de lignes perimees, et rend le nombre supprime.
 *
 * PAR LOT ET NON EN UNE FOIS : un premier passage sur une table laissee grossir
 * deux ans supprimerait des millions de lignes dans une seule transaction —
 * verrous tenus longtemps, journal WAL qui explose, et une page qui semble
 * plantee. Vingt mille lignes se suppriment en quelques dizaines de
 * millisecondes ; l'appelant recommence s'il veut aller au bout.
 *
 * La sous-requete s'appuie sur l'index `render_logs_recent (created_at DESC)`,
 * qui existe depuis la migration 001.
 */
export async function purgeRenderLogs(batch = 20_000): Promise<number> {
  const days = retentionDays();
  if (days === 0) return 0;

  const rows = await sql<{ id: string }[]>`
    DELETE FROM render_logs
    WHERE id IN (
      SELECT id FROM render_logs
      WHERE created_at < now() - ${days} * interval '1 day'
      LIMIT ${batch}
    )
    RETURNING id
  `;

  return rows.length;
}

/**
 * Purge opportuniste, au plus une fois par heure et par processus.
 *
 * APPELEE DEPUIS LA PAGE DU JOURNAL, et c'est le bon endroit : c'est la seule
 * page que la taille de cette table concerne, elle est consultee rarement, et la
 * personne attend deja des agregats. La faire tourner sur le chemin d'un rendu
 * ferait payer une suppression a une fiche qui n'a rien demande.
 *
 * NE BLOQUE PAS l'affichage et n'echoue jamais vers l'appelant : un journal qui
 * refuse de s'afficher parce qu'une suppression a echoue serait un mauvais
 * echange. Sur une grosse installation, preferer le cron : `pnpm purge`.
 */
let dernierePurge = 0;

export function purgeRenderLogsSiNecessaire(): void {
  const maintenant = Date.now();
  if (maintenant - dernierePurge < 60 * 60 * 1000) return;
  dernierePurge = maintenant;

  void purgeRenderLogs().catch((cause) => {
    console.error("purge du journal impossible :", cause instanceof Error ? cause.message : cause);
  });
}
