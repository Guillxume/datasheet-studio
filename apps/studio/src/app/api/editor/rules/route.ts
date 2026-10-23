import { z } from "zod";
import { requireApi } from "@/lib/guard";
import { sql } from "@/lib/db";
import { AUTO_TEMPLATE } from "@/lib/templateRules";
import {
  createRule,
  defaultTemplateSlug,
  deleteRule,
  listRules,
  resolveForProduct,
  setDefaultTemplate,
} from "@/lib/templateRulesStore";
import { audit } from "@/lib/users";

/**
 * Regles de template d'une boutique : lire, ecrire, et EPROUVER.
 *
 * PERMISSION templates:write. Ecrire une regle, c'est decider quel template
 * sert quel produit — c'est le meme geste que composer le template, pas une
 * tache d'administration. Un importateur n'a pas a y toucher ; un editeur, si.
 *
 * L'ACTION « essayer » EST CE QUI REND CES REGLES MAINTENABLES. Un jeu de
 * regles se verifie autrement en lancant un lot et en ouvrant des PDF. Ici on
 * tape un fil d'ariane et on lit le template retenu ET la raison — regle ou
 * defaut. C'est aussi le seul moyen de constater qu'une regle ne correspond plus
 * apres qu'une categorie a ete renommee, sans attendre qu'un lot de quatre cents
 * fiches sorte avec le mauvais modele.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Un fil d'ariane saisi a l'ecran : « Manutention > Transpalettes ». */
const segments = (value: string): string[] =>
  value
    .split(">")
    .map((part) => part.trim())
    .filter((part) => part !== "");

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("creer"),
    shop: z.string().min(1),
    category: z.string().max(500).optional(),
    category_any: z.string().max(500).optional(),
    ref_pattern: z.string().max(200).optional(),
    brand: z.string().max(200).optional(),
    template_slug: z.string().min(1).max(63),
    note: z.string().max(300).optional(),
  }),
  z.object({ action: z.literal("supprimer"), shop: z.string().min(1), id: z.uuid() }),
  z.object({
    action: z.literal("defaut"),
    shop: z.string().min(1),
    template_slug: z.string().max(63).nullable(),
  }),
  z.object({
    action: z.literal("essayer"),
    shop: z.string().min(1),
    category: z.string().max(500).optional(),
    brand: z.string().max(200).optional(),
    ref: z.string().max(200).optional(),
  }),
]);

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

async function shopIdOf(slug: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`SELECT id FROM shops WHERE slug = ${slug} AND active`;
  return rows[0]?.id ?? null;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireApi("templates:write");
  if (auth instanceof Response) return auth;

  const slug = new URL(request.url).searchParams.get("shop");
  if (!slug) return fail(422, "shop est requis.");

  const shopId = await shopIdOf(slug);
  if (shopId === null) return fail(404, `Boutique inconnue : ${slug}`);

  const [rules, defaut] = await Promise.all([listRules(shopId), defaultTemplateSlug(shopId)]);
  return Response.json({ ok: true, rules, default: defaut });
}

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("templates:write");
  if (actor instanceof Response) return actor;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "Corps JSON illisible.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return fail(422, parsed.error.issues[0]?.message ?? "Requete invalide.");
  }
  const body = parsed.data;

  const shopId = await shopIdOf(body.shop);
  if (shopId === null) return fail(404, `Boutique inconnue : ${body.shop}`);

  if (body.action === "essayer") {
    const resolution = await resolveForProduct(shopId, {
      categoryPath: segments(body.category ?? ""),
      brand: body.brand || null,
      ref: body.ref || null,
    });

    return Response.json({
      ok: true,
      // `null` est une reponse legitime et parlante : aucune regle, aucun
      // defaut, donc « auto » echouerait pour ce produit — mieux vaut le voir
      // ici qu'au 300e rendu.
      resolution,
    });
  }

  if (body.action === "defaut") {
    if (body.template_slug === AUTO_TEMPLATE) {
      return fail(422, `« ${AUTO_TEMPLATE} » est la valeur reservee du contrat, pas un template.`);
    }

    await setDefaultTemplate(shopId, body.template_slug || null);
    await audit(actor, "regles.defaut", body.shop, { template: body.template_slug });
    return Response.json({ ok: true });
  }

  if (body.action === "supprimer") {
    await deleteRule(shopId, body.id);
    await audit(actor, "regles.supprimee", body.shop, { id: body.id });
    return Response.json({ ok: true });
  }

  // body.action === "creer"
  if (body.template_slug === AUTO_TEMPLATE) {
    return fail(422, `« ${AUTO_TEMPLATE} » est la valeur reservee du contrat, pas un template.`);
  }

  const created = await createRule(shopId, {
    category: body.category ? segments(body.category) : null,
    category_any: body.category_any ? segments(body.category_any) : null,
    ref_pattern: body.ref_pattern || null,
    brand: body.brand || null,
    template_slug: body.template_slug,
    note: body.note || null,
  });

  if ("error" in created) return fail(422, created.error);

  await audit(actor, "regles.creee", body.shop, {
    template: body.template_slug,
    categorie: body.category ?? body.category_any ?? body.brand ?? body.ref_pattern,
  });

  return Response.json({ ok: true, id: created.id });
}
