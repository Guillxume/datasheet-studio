import { sql } from "./db";
import { AUTO_TEMPLATE as RESERVED_SLUG } from "./templateRules";

/**
 * Acces aux templates pour l'editeur.
 *
 * MODELE DE BROUILLON, sans colonne dediee : le brouillon est toujours la
 * version au numero le plus eleve. Si cette version est celle qui est publiee,
 * la premiere edition en cree une nouvelle (numero + 1) ; les enregistrements
 * suivants la modifient sur place.
 *
 * Consequence utile : publier ne consiste qu'a deplacer published_version_id, ce
 * qui est atomique, et l'historique des versions reste intact — une fiche rendue
 * avec `version: 12` continuera de sortir a l'identique.
 */

export type TemplateTrees = {
  body: unknown;
  header: unknown | null;
  footer: unknown | null;
  css: string | null;
  settings: Record<string, unknown>;
};

export type TemplateRow = {
  id: string;
  slug: string;
  name: string;
  shop_id: string | null;
  shop_slug: string | null;
  published_version: number | null;
  draft_version: number;
  is_draft_published: boolean;
  updated_at: string;
  /** « template » ou « component » (migration 011). */
  kind: TemplateKind;
};

/**
 * Un composant vit dans la meme table qu'un template (migration 011) : il en a
 * le cycle de vie. Les requetes qui servent les boutiques filtrent sur
 * « template » ; l'editeur, la duplication et la suppression traitent les deux.
 */
export type TemplateKind = "template" | "component";

const EMPTY_TREE = { root: { props: {} }, content: [], zones: {} };

export async function listAllTemplates(): Promise<TemplateRow[]> {
  return sql<TemplateRow[]>`
    SELECT t.id,
           t.slug,
           t.name,
           t.shop_id,
           s.slug AS shop_slug,
           pv.number AS published_version,
           COALESCE(mv.number, 0) AS draft_version,
           (pv.number IS NOT NULL AND pv.number = mv.number) AS is_draft_published,
           t.updated_at,
           t.kind
    FROM templates t
    LEFT JOIN shops s ON s.id = t.shop_id
    LEFT JOIN template_versions pv ON pv.id = t.published_version_id
    LEFT JOIN LATERAL (
      SELECT number FROM template_versions WHERE template_id = t.id ORDER BY number DESC LIMIT 1
    ) mv ON true
    ORDER BY (t.shop_id IS NULL) DESC, s.slug NULLS FIRST, t.name
  `;
}

export async function getTemplateBySlug(slug: string, shopSlug: string | null): Promise<TemplateRow | null> {
  const rows = await sql<TemplateRow[]>`
    SELECT t.id, t.slug, t.name, t.shop_id, s.slug AS shop_slug,
           pv.number AS published_version,
           COALESCE(mv.number, 0) AS draft_version,
           (pv.number IS NOT NULL AND pv.number = mv.number) AS is_draft_published,
           t.updated_at,
           t.kind
    FROM templates t
    LEFT JOIN shops s ON s.id = t.shop_id
    LEFT JOIN template_versions pv ON pv.id = t.published_version_id
    LEFT JOIN LATERAL (
      SELECT number FROM template_versions WHERE template_id = t.id ORDER BY number DESC LIMIT 1
    ) mv ON true
    WHERE t.slug = ${slug}
      AND ${shopSlug === null ? sql`t.shop_id IS NULL` : sql`s.slug = ${shopSlug}`}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

/** Contenu du brouillon, c'est-a-dire de la version la plus recente. */
export async function getDraft(templateId: string): Promise<TemplateTrees> {
  const rows = await sql<
    { body: unknown; header: unknown; footer: unknown; css: string | null; settings: Record<string, unknown> }[]
  >`
    SELECT body, header, footer, css, settings
    FROM template_versions
    WHERE template_id = ${templateId}
    ORDER BY number DESC
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return { body: EMPTY_TREE, header: null, footer: null, css: null, settings: {} };
  }

  return {
    body: row.body ?? EMPTY_TREE,
    header: row.header ?? null,
    footer: row.footer ?? null,
    css: row.css,
    settings: row.settings ?? {},
  };
}

/**
 * Contenu de la version PUBLIEE, ou null si aucune ne l'est.
 *
 * Double de `resolveTemplate` (src/lib/templates.ts) en apparence seulement :
 * celui-la resout un SLUG pour une boutique authentifiee, avec la regle de
 * masquage bibliotheque/boutique qui fait tout son interet. Ici le template est
 * deja identifie — la page d'import l'a choisi dans une liste — et l'appelant
 * n'est pas une boutique porteuse de cle, mais l'utilisateur du Studio.
 */
export async function getPublished(templateId: string): Promise<TemplateTrees | null> {
  const rows = await sql<
    { body: unknown; header: unknown; footer: unknown; css: string | null; settings: Record<string, unknown> }[]
  >`
    SELECT v.body, v.header, v.footer, v.css, v.settings
    FROM template_versions v
    JOIN templates t ON t.published_version_id = v.id
    WHERE t.id = ${templateId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    body: row.body ?? EMPTY_TREE,
    header: row.header ?? null,
    footer: row.footer ?? null,
    css: row.css,
    settings: row.settings ?? {},
  };
}

/**
 * Enregistre le brouillon.
 *
 * Cree une nouvelle version si la plus recente est deja publiee : on ne modifie
 * JAMAIS une version publiee, sous peine de changer sous les pieds des boutiques
 * un rendu qu'elles croient figé.
 */
export async function saveDraft(templateId: string, trees: TemplateTrees): Promise<number> {
  return sql.begin(async (tx) => {
    const rows = await tx<{ id: string; number: number; published: boolean }[]>`
      SELECT v.id,
             v.number,
             (t.published_version_id = v.id) AS published
      FROM template_versions v
      JOIN templates t ON t.id = v.template_id
      WHERE v.template_id = ${templateId}
      ORDER BY v.number DESC
      LIMIT 1
    `;

    const latest = rows[0];
    const payload = {
      body: tx.json(trees.body as never),
      header: trees.header === null ? null : tx.json(trees.header as never),
      footer: trees.footer === null ? null : tx.json(trees.footer as never),
      css: trees.css,
      settings: tx.json(trees.settings as never),
    };

    let number: number;

    if (!latest || latest.published) {
      number = latest ? latest.number + 1 : 1;
      await tx`
        INSERT INTO template_versions (template_id, number, body, header, footer, css, settings)
        VALUES (${templateId}, ${number}, ${payload.body}, ${payload.header}, ${payload.footer},
                ${payload.css}, ${payload.settings})
      `;
    } else {
      number = latest.number;
      await tx`
        UPDATE template_versions
        SET body = ${payload.body}, header = ${payload.header}, footer = ${payload.footer},
            css = ${payload.css}, settings = ${payload.settings}
        WHERE id = ${latest.id}
      `;
    }

    await tx`UPDATE templates SET updated_at = now() WHERE id = ${templateId}`;

    return number;
  });
}

/** Publie le brouillon : un simple deplacement de pointeur, donc atomique. */
export async function publishDraft(templateId: string): Promise<number | null> {
  return sql.begin(async (tx) => {
    const rows = await tx<{ id: string; number: number }[]>`
      SELECT id, number FROM template_versions
      WHERE template_id = ${templateId}
      ORDER BY number DESC
      LIMIT 1
    `;

    const draft = rows[0];
    if (!draft) {
      return null;
    }

    await tx`
      UPDATE templates
      SET published_version_id = ${draft.id}, updated_at = now()
      WHERE id = ${templateId}
    `;

    return draft.number;
  });
}

export async function createTemplate(
  slug: string,
  name: string,
  shopSlug: string | null,
  kind: TemplateKind = "template"
): Promise<{ id: string } | { error: string }> {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
    return { error: "Slug invalide : minuscules, chiffres et tirets, 2 a 63 caracteres." };
  }

  /*
   * « auto » est RESERVE : c'est la valeur que le contrat de rendu accepte pour
   * demander au Studio de choisir le template d'apres les regles de categorie
   * (voir src/lib/templateRulesStore.ts). Un template qui porterait ce slug
   * rendrait le contrat ambigu — le meme mot dirait deux choses.
   */
  if (slug === RESERVED_SLUG) {
    return { error: `« ${RESERVED_SLUG} » est reserve : c'est la valeur qui demande au Studio de choisir le template.` };
  }

  let shopId: string | null = null;
  if (shopSlug !== null) {
    const shops = await sql<{ id: string }[]>`SELECT id FROM shops WHERE slug = ${shopSlug}`;
    if (!shops[0]) {
      return { error: `Boutique inconnue : ${shopSlug}` };
    }
    shopId = shops[0].id;
  }

  try {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO templates (shop_id, slug, name, kind)
      VALUES (${shopId}, ${slug}, ${name}, ${kind})
      RETURNING id
    `;
    return { id: rows[0].id };
  } catch {
    // Les index partiels garantissent l'unicite par boutique et en bibliotheque.
    // Un composant et un template partagent l'espace des slugs d'une portee.
    return { error: "Un template ou un composant porte deja ce slug pour cette portee." };
  }
}

/**
 * Duplique la version publiee (ou le brouillon a defaut) vers une autre portee.
 *
 * Sert la mutualisation reelle du parc : partir du modele commun puis le faire
 * diverger pour un site, sans toucher aux autres.
 */
export async function duplicateTemplate(
  templateId: string,
  targetShopSlug: string | null,
  slug: string,
  name: string
): Promise<{ id: string } | { error: string }> {
  const source = await sql<
    {
      body: unknown;
      header: unknown;
      footer: unknown;
      css: string | null;
      settings: Record<string, unknown>;
      kind: TemplateKind;
    }[]
  >`
    SELECT v.body, v.header, v.footer, v.css, v.settings, t.kind
    FROM template_versions v
    JOIN templates t ON t.id = v.template_id
    WHERE v.template_id = ${templateId}
    ORDER BY (v.id = t.published_version_id) DESC, v.number DESC
    LIMIT 1
  `;

  if (!source[0]) {
    return { error: "Le template source n'a aucune version." };
  }

  // Un composant duplique reste un composant.
  const created = await createTemplate(slug, name, targetShopSlug, source[0].kind);
  if ("error" in created) {
    return created;
  }

  await saveDraft(created.id, {
    body: source[0].body,
    header: source[0].header ?? null,
    footer: source[0].footer ?? null,
    css: source[0].css,
    settings: source[0].settings ?? {},
  });

  return created;
}

/**
 * Supprime un template et tout son historique.
 *
 * SUPPRESSION REELLE, PAS UN DRAPEAU. Un template masque resterait resolu par
 * slug si la colonne etait oubliee quelque part, et la regle de masquage
 * bibliotheque/boutique (src/lib/templates.ts) deviendrait dependante d'un
 * troisieme etat. Le CASCADE de db/migrations/001 emporte les versions ;
 * render_logs.template_id est en ON DELETE SET NULL, donc le journal des rendus
 * survit — amoindri, mais pas troue.
 *
 * CE QUE L'APPELANT DOIT VERIFIER AVANT : qu'aucune boutique ne s'en sert. La
 * base ne le sait pas — le lien entre un module PrestaShop et un slug de
 * template vit dans la configuration du module, pas ici. D'ou le compte de
 * rendus recents rendu par `templateUsage`, que l'interface affiche avant de
 * demander confirmation.
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await sql`DELETE FROM templates WHERE id = ${templateId}`;
}

/** Nombre de rendus de production servis par ce template sur les 90 derniers jours. */
export async function templateUsage(templateId: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM render_logs
    WHERE template_id = ${templateId}
      AND created_at > now() - interval '90 days'
  `;
  return rows[0]?.n ?? 0;
}

export async function listShops(): Promise<{ slug: string; name: string }[]> {
  return sql<{ slug: string; name: string }[]>`
    SELECT slug, name FROM shops WHERE active ORDER BY name
  `;
}

/**
 * Les trois nombres graves sur la plaque d'identite (voir src/components/Plate.tsx).
 *
 * POURQUOI « PUBLIES » ET PAS SEULEMENT « TEMPLATES ». Un template sans version
 * publiee ne rend RIEN : l'API repond 404 a la boutique qui le demande. L'ecart
 * entre les deux nombres est donc la seule mesure qui dise si la machine est
 * prete a servir, et c'est pour cela qu'elle porte l'accent de la plaque.
 *
 * UNE SEULE REQUETE, ET SUR CHAQUE PAGE. Trois `count(*)` sur des tables de
 * quelques dizaines de lignes, en un aller-retour : le cout est celui d'une
 * requete de plus par page, mesurable mais negligeable devant celles que les
 * pages font deja. Le faire par page aurait donne une plaque qui change de
 * contenu selon l'ecran — ce qui n'est plus une plaque.
 */
export async function studioCounters(): Promise<{
  templates: number;
  published: number;
  shops: number;
}> {
  const rows = await sql<{ templates: number; published: number; shops: number }[]>`
    SELECT (SELECT count(*)::int FROM templates WHERE kind = 'template')               AS templates,
           (SELECT count(*)::int FROM templates
             WHERE kind = 'template' AND published_version_id IS NOT NULL)              AS published,
           (SELECT count(*)::int FROM shops WHERE active)                             AS shops
  `;
  return rows[0] ?? { templates: 0, published: 0, shops: 0 };
}
