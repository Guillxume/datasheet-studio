import { sql } from "./db";
import { TemplateResolver, unsafePattern, type MatchInput } from "./templateRules";

export { AUTO_TEMPLATE } from "./templateRules";

/**
 * Les regles de template d'une boutique, lues en base.
 *
 * La CORRESPONDANCE est dans src/lib/templateRules.ts, partagee avec les
 * collecteurs. Ce module-ci ne fait que la nourrir : c'est le pendant de
 * `FileTemplateResolver.load` cote collecteur, qui lit un fichier JSON.
 *
 * PAS DE CACHE, et c'est un choix mesure. Une resolution coute une requete sur
 * un index par boutique, pour une poignee de lignes — devant les 44 ms d'un
 * rendu Chromium, c'est du bruit. Un cache introduirait la question « depuis
 * combien de temps cette regle est-elle celle que je crois », qui est
 * exactement ce qu'on ne veut pas se poser en reglant un catalogue.
 */

export type TemplateRule = {
  id: string;
  category: string[] | null;
  category_any: string[] | null;
  ref_pattern: string | null;
  brand: string | null;
  template_slug: string;
  note: string | null;
};

export type ResolutionSource = "explicite" | "regle" | "defaut";

export type Resolution = {
  slug: string;
  by: ResolutionSource;
};

export async function listRules(shopId: string): Promise<TemplateRule[]> {
  return sql<TemplateRule[]>`
    SELECT id, category, category_any, ref_pattern, brand, template_slug, note
    FROM template_rules
    WHERE shop_id = ${shopId}
    ORDER BY coalesce(array_length(category, 1), 0) DESC, template_slug
  `;
}

export async function defaultTemplateSlug(shopId: string): Promise<string | null> {
  const rows = await sql<{ default_template_slug: string | null }[]>`
    SELECT default_template_slug FROM shops WHERE id = ${shopId}
  `;
  return rows[0]?.default_template_slug ?? null;
}

/**
 * Le template a servir pour ce produit, et COMMENT il a ete choisi.
 *
 * Le « comment » n'est pas decoratif : il est journalise, et c'est ce qui rend
 * visible une regle devenue caduque. Une categorie renommee en back-office ne
 * leve aucune erreur — les fiches retombent simplement sur le defaut, et sans
 * cette trace personne ne le remarquerait avant de regarder un PDF.
 *
 * Rend `null` quand il n'y a ni regle correspondante ni defaut : l'appelant doit
 * le dire clairement plutot que de retenir un slug au hasard.
 */
export async function resolveForProduct(
  shopId: string,
  input: MatchInput
): Promise<Resolution | null> {
  const [rules, fallback] = await Promise.all([listRules(shopId), defaultTemplateSlug(shopId)]);

  const resolver = new TemplateResolver(
    {
      rules: rules.map((rule) => ({
        ...(rule.category ? { category: rule.category } : {}),
        ...(rule.category_any ? { category_any: rule.category_any } : {}),
        ...(rule.ref_pattern ? { ref: rule.ref_pattern } : {}),
        ...(rule.brand ? { brand: rule.brand } : {}),
        template: rule.template_slug,
      })),
      ...(fallback ? { default: fallback } : {}),
    },
    undefined
  );

  const slug = resolver.resolve(input);
  if (slug === null) return null;

  // Distinguer la regle du defaut sans redemander au moteur : si le slug retenu
  // est celui du defaut ET qu'aucune regle ne le designe, c'est le defaut qui a
  // parle. Une regle qui pointe explicitement vers le meme slug que le defaut
  // compte comme une regle — elle a bien correspondu.
  const parUneRegle = rules.some((rule) => rule.template_slug === slug);
  return { slug, by: parUneRegle ? "regle" : "defaut" };
}

// ---------------------------------------------------------------------------
// Ecriture
// ---------------------------------------------------------------------------

export type RuleInput = {
  category?: string[] | null;
  category_any?: string[] | null;
  ref_pattern?: string | null;
  brand?: string | null;
  template_slug: string;
  note?: string | null;
};

export async function createRule(
  shopId: string,
  input: RuleInput
): Promise<{ id: string } | { error: string }> {
  const criteres = [input.category, input.category_any, input.ref_pattern, input.brand].filter(
    (value) => value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0)
  );

  if (criteres.length === 0) {
    return {
      error: "Une regle sans critere s'appliquerait a tout : utiliser le template par defaut.",
    };
  }

  // Une expression reguliere fautive doit etre refusee A LA SAISIE et non au
  // rendu : compilee dans le moteur, elle ferait echouer chaque fiche du lot
  // avec un message qui ne designe pas la regle.
  if (input.ref_pattern) {
    // Invalide OU dangereuse (ReDoS) : voir unsafePattern.
    const raison = unsafePattern(input.ref_pattern);
    if (raison) return { error: `Reference : ${raison}.` };
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO template_rules (shop_id, category, category_any, ref_pattern, brand, template_slug, note)
    VALUES (${shopId},
            ${input.category?.length ? input.category : null},
            ${input.category_any?.length ? input.category_any : null},
            ${input.ref_pattern || null},
            ${input.brand || null},
            ${input.template_slug},
            ${input.note || null})
    RETURNING id
  `;

  return { id: rows[0].id };
}

export async function deleteRule(shopId: string, id: string): Promise<void> {
  // Le shop_id est dans la clause : une regle ne se supprime que depuis sa
  // propre boutique, meme si l'identifiant est connu.
  await sql`DELETE FROM template_rules WHERE id = ${id} AND shop_id = ${shopId}`;
}

export async function setDefaultTemplate(shopId: string, slug: string | null): Promise<void> {
  await sql`UPDATE shops SET default_template_slug = ${slug} WHERE id = ${shopId}`;
}
