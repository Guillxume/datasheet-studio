import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { COMPONENT_BLOCK, componentContent, componentSlugsIn, expandComponents, type Node } from "./components";
import {
  canTarget,
  publishDecision,
  summarizeZone,
  zoneCitingComponent,
  type PublishDecision,
  type ZoneName,
  type ZoneSummary,
} from "./componentApply";
import { getDraft, publishDraft, saveDraft } from "./repository";

/**
 * Composants reutilisables — acces base. La partie pure est dans components.ts.
 *
 * PORTEE : comme pour les templates, le composant d'une boutique MASQUE le
 * composant de bibliotheque de meme slug. Un template commun peut ainsi citer
 * « pied-de-page » et recevoir, pour chaque boutique, son propre pied de page.
 */

/**
 * Deplie les blocs « Composant » d'arbres de template, pour une boutique (ou la
 * seule bibliotheque quand `shopId` est null), avec la version PUBLIEE de chaque
 * composant. Sans composant cite, les arbres sont rendus tels quels, sans requete.
 */
export async function expandTreesForShop<T>(trees: T, shopId: string | null): Promise<T> {
  const slugs = [...componentSlugsIn(trees)];
  if (slugs.length === 0) return trees;

  const rows = await sql<{ slug: string; body: unknown }[]>`
    SELECT DISTINCT ON (t.slug) t.slug, v.body
    FROM templates t
    JOIN template_versions v ON v.id = t.published_version_id
    WHERE t.kind = 'component'
      AND t.slug = ANY(${slugs})
      AND ${shopId === null ? sql`t.shop_id IS NULL` : sql`(t.shop_id = ${shopId} OR t.shop_id IS NULL)`}
    ORDER BY t.slug, (t.shop_id IS NULL)
  `;
  const contents = new Map(rows.map((row) => [row.slug, componentContent(row.body)]));
  return expandComponents(trees, (slug) => contents.get(slug) ?? null);
}

/** L'identifiant d'une boutique par son slug ; null pour la bibliotheque ou une boutique inconnue. */
export async function shopIdOf(shopSlug: string | null): Promise<string | null> {
  if (shopSlug === null) return null;
  const rows = await sql<{ id: string }[]>`SELECT id FROM shops WHERE slug = ${shopSlug}`;
  return rows[0]?.id ?? null;
}

export type EditorComponent = {
  slug: string;
  name: string;
  shared: boolean;
  /** null : jamais publie. Le contenu montre est alors celui du brouillon. */
  publishedVersion: number | null;
  content: Node[];
};

/**
 * Les composants qu'un template de cette portee peut citer, avec le contenu a
 * montrer dans le canvas : la version publiee — celle que les fiches portent —
 * ou, faute de mieux, le brouillon.
 *
 * Un template de BIBLIOTHEQUE ne voit que les composants de bibliotheque : il
 * sert plusieurs boutiques, et le composant d'une seule n'a pas a y entrer.
 */
export async function listComponentsFor(shopSlug: string | null): Promise<EditorComponent[]> {
  const rows = await sql<{ slug: string; name: string; shared: boolean; published: number | null; body: unknown }[]>`
    SELECT DISTINCT ON (t.slug)
           t.slug, t.name, (t.shop_id IS NULL) AS shared, pv.number AS published,
           COALESCE(pv.body, dv.body) AS body
    FROM templates t
    LEFT JOIN shops s ON s.id = t.shop_id
    LEFT JOIN template_versions pv ON pv.id = t.published_version_id
    LEFT JOIN LATERAL (
      SELECT body FROM template_versions WHERE template_id = t.id ORDER BY number DESC LIMIT 1
    ) dv ON true
    WHERE t.kind = 'component'
      AND ${shopSlug === null ? sql`t.shop_id IS NULL` : sql`(s.slug = ${shopSlug} OR t.shop_id IS NULL)`}
    ORDER BY t.slug, (t.shop_id IS NULL)
  `;
  return rows
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      shared: row.shared,
      publishedVersion: row.published,
      content: componentContent(row.body),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export type Dependent = { id: string; slug: string; name: string; shopSlug: string | null };

/**
 * Les templates dont la version PUBLIEE cite ce composant : ceux dont les fiches
 * changent quand on le publie.
 *
 * Un composant de boutique compte aussi les templates de bibliotheque qui citent
 * son slug — pour cette boutique, c'est lui qu'ils deplient.
 */
export async function dependentsOf(componentId: string): Promise<Dependent[]> {
  const rows = await sql<{ id: string; slug: string; name: string; shop_slug: string | null }[]>`
    WITH c AS (SELECT slug, shop_id FROM templates WHERE id = ${componentId} AND kind = 'component')
    SELECT t.id, t.slug, t.name, s.slug AS shop_slug
    FROM templates t
    CROSS JOIN c
    LEFT JOIN shops s ON s.id = t.shop_id
    JOIN template_versions v ON v.id = t.published_version_id
    WHERE t.kind = 'template'
      AND (c.shop_id IS NULL OR t.shop_id = c.shop_id OR t.shop_id IS NULL)
      AND (
        jsonb_path_exists(v.body, '$.** ? (@.type == $type && @.props.component == $slug)', jsonb_build_object('type', ${COMPONENT_BLOCK}::text, 'slug', c.slug))
        OR jsonb_path_exists(coalesce(v.header, 'null'::jsonb), '$.** ? (@.type == $type && @.props.component == $slug)', jsonb_build_object('type', ${COMPONENT_BLOCK}::text, 'slug', c.slug))
        OR jsonb_path_exists(coalesce(v.footer, 'null'::jsonb), '$.** ? (@.type == $type && @.props.component == $slug)', jsonb_build_object('type', ${COMPONENT_BLOCK}::text, 'slug', c.slug))
      )
    ORDER BY s.slug NULLS FIRST, t.name
  `;
  return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, shopSlug: row.shop_slug }));
}

/**
 * Republie les templates qui dependent d'un composant qu'on vient de publier.
 *
 * POURQUOI : les boutiques gardent leurs PDF en cache et ne les regenerent que
 * quand la version publiee d'un template CHANGE (le module la reverifie toutes
 * les cinq minutes). Publier un composant sans bouger ces versions laisserait
 * les boutiques servir l'ancien pied de page indefiniment. Chaque template
 * concerne recoit donc une nouvelle version publiee — memes arbres, puisque le
 * composant est deplie au rendu — dont la note dit pourquoi.
 *
 * UN BROUILLON EN COURS EST PRESERVE. Le brouillon d'un template est sa version
 * la plus recente. Si elle n'etait pas publiee, inserer la republication par
 * dessus l'aurait cachee : elle est recopiee a la suite, et reste le brouillon.
 */
export async function republishDependents(componentId: string, componentName: string): Promise<Dependent[]> {
  const dependents = await dependentsOf(componentId);
  const note = `Republication automatique : composant « ${componentName} » publie.`;

  await sql.begin(async (tx) => {
    for (const template of dependents) {
      const [state] = await tx<{ published_id: string; published_number: number; latest_id: string; latest_number: number }[]>`
        SELECT pv.id AS published_id, pv.number AS published_number, lv.id AS latest_id, lv.number AS latest_number
        FROM templates t
        JOIN template_versions pv ON pv.id = t.published_version_id
        JOIN LATERAL (
          SELECT id, number FROM template_versions WHERE template_id = t.id ORDER BY number DESC LIMIT 1
        ) lv ON true
        WHERE t.id = ${template.id}
        FOR UPDATE OF t
      `;
      if (!state) continue;

      const [republished] = await tx<{ id: string }[]>`
        INSERT INTO template_versions (template_id, number, body, header, footer, css, settings, note)
        SELECT template_id, ${state.latest_number + 1}, body, header, footer, css, settings, ${note}
        FROM template_versions WHERE id = ${state.published_id}
        RETURNING id
      `;
      await tx`UPDATE templates SET published_version_id = ${republished.id}, updated_at = now() WHERE id = ${template.id}`;

      if (state.latest_id !== state.published_id) {
        await tx`
          INSERT INTO template_versions (template_id, number, body, header, footer, css, settings, note)
          SELECT template_id, ${state.latest_number + 2}, body, header, footer, css, settings, note
          FROM template_versions WHERE id = ${state.latest_id}
        `;
      }
    }
  });

  return dependents;
}

/**
 * Les templates dont une version publiee OU le brouillon cite ce composant :
 * le supprimer les ferait sortir sans lui. La suppression est refusee tant
 * qu'il y en a.
 */
export async function templatesCiting(componentId: string): Promise<Dependent[]> {
  const rows = await sql<{ id: string; slug: string; name: string; shop_slug: string | null }[]>`
    WITH c AS (SELECT slug, shop_id FROM templates WHERE id = ${componentId} AND kind = 'component')
    SELECT DISTINCT t.id, t.slug, t.name, s.slug AS shop_slug
    FROM templates t
    CROSS JOIN c
    LEFT JOIN shops s ON s.id = t.shop_id
    JOIN template_versions v ON v.template_id = t.id
    WHERE t.kind = 'template'
      AND (c.shop_id IS NULL OR t.shop_id = c.shop_id OR t.shop_id IS NULL)
      AND (v.id = t.published_version_id
           OR v.number = (SELECT max(number) FROM template_versions WHERE template_id = t.id))
      AND (
        jsonb_path_exists(v.body, '$.** ? (@.type == $type && @.props.component == $slug)', jsonb_build_object('type', ${COMPONENT_BLOCK}::text, 'slug', c.slug))
        OR jsonb_path_exists(coalesce(v.header, 'null'::jsonb), '$.** ? (@.type == $type && @.props.component == $slug)', jsonb_build_object('type', ${COMPONENT_BLOCK}::text, 'slug', c.slug))
        OR jsonb_path_exists(coalesce(v.footer, 'null'::jsonb), '$.** ? (@.type == $type && @.props.component == $slug)', jsonb_build_object('type', ${COMPONENT_BLOCK}::text, 'slug', c.slug))
      )
  `;
  return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, shopSlug: row.shop_slug }));
}

export type ApplyTarget = {
  id: string;
  slug: string;
  name: string;
  shopSlug: string | null;
  publishedVersion: number | null;
  draftVersion: number;
  /** Etat de chaque zone dans le BROUILLON — c'est lui que l'application modifie. */
  header: ZoneSummary;
  footer: ZoneSummary;
};

/**
 * Les templates auxquels ce composant peut etre applique (voir canTarget), avec
 * l'etat actuel de leur en-tete et de leur pied : la personne doit voir ce
 * qu'elle s'apprete a remplacer.
 */
export async function applicationTargets(componentId: string): Promise<ApplyTarget[]> {
  const component = await sql<{ slug: string; shop_id: string | null }[]>`
    SELECT slug, shop_id FROM templates WHERE id = ${componentId} AND kind = 'component'
  `;
  if (!component[0]) return [];
  const { slug, shop_id: componentShop } = component[0];

  const rows = await sql<
    {
      id: string;
      slug: string;
      name: string;
      shop_id: string | null;
      shop_slug: string | null;
      published: number | null;
      draft: number | null;
      header: unknown;
      footer: unknown;
    }[]
  >`
    SELECT t.id, t.slug, t.name, t.shop_id, s.slug AS shop_slug,
           pv.number AS published, dv.number AS draft, dv.header, dv.footer
    FROM templates t
    LEFT JOIN shops s ON s.id = t.shop_id
    LEFT JOIN template_versions pv ON pv.id = t.published_version_id
    LEFT JOIN LATERAL (
      SELECT number, header, footer FROM template_versions WHERE template_id = t.id ORDER BY number DESC LIMIT 1
    ) dv ON true
    WHERE t.kind = 'template'
    ORDER BY (t.shop_id IS NULL) DESC, s.slug NULLS FIRST, t.name
  `;

  return rows
    .filter((row) => canTarget(componentShop, row.shop_id))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      shopSlug: row.shop_slug,
      publishedVersion: row.published,
      draftVersion: row.draft ?? 0,
      header: summarizeZone(row.header, slug),
      footer: summarizeZone(row.footer, slug),
    }));
}

export type ApplyOutcome = {
  slug: string;
  name: string;
  shopSlug: string | null;
  /** « unchanged » : la zone ne contenait deja que ce composant. */
  outcome: PublishDecision | "unchanged";
  /** Version enregistree (ou publiee) ; null si rien n'a change. */
  version: number | null;
};

/**
 * Remplace la zone `zone` des templates `targetIds` par le seul composant.
 *
 * Template par template, chacun dans sa transaction (saveDraft, publishDraft) :
 * une erreur sur l'un n'annule pas les autres, et le resultat dit ce qui est
 * arrive a chacun. Un identifiant hors de portee (voir canTarget) est ignore —
 * l'interface ne le propose pas, l'API ne l'accepte pas davantage.
 */
export async function applyComponentToZone(
  componentId: string,
  zone: ZoneName,
  targetIds: string[],
  publish: boolean
): Promise<ApplyOutcome[]> {
  const component = await sql<{ slug: string }[]>`
    SELECT slug FROM templates WHERE id = ${componentId} AND kind = 'component'
  `;
  if (!component[0]) return [];
  const { slug } = component[0];

  const wanted = new Set(targetIds);
  const targets = (await applicationTargets(componentId)).filter((target) => wanted.has(target.id));
  const outcomes: ApplyOutcome[] = [];

  for (const target of targets) {
    const base = { slug: target.slug, name: target.name, shopSlug: target.shopSlug };

    if (target[zone].alreadyApplied) {
      outcomes.push({ ...base, outcome: "unchanged", version: null });
      continue;
    }

    // Decidee AVANT l'enregistrement, qui cree justement un brouillon.
    const decision = publishDecision(publish, target);
    const draft = await getDraft(target.id);
    let version = await saveDraft(target.id, {
      ...draft,
      [zone]: zoneCitingComponent(slug, `${COMPONENT_BLOCK}-${randomUUID()}`),
    });
    if (decision === "publish") {
      version = (await publishDraft(target.id)) ?? version;
    }
    outcomes.push({ ...base, outcome: decision, version });
  }

  return outcomes;
}
