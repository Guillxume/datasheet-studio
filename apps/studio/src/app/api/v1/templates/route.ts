import { authenticate } from "@/lib/auth";
import { listTemplates } from "@/lib/templates";

/**
 * GET /api/v1/templates
 *
 * Alimente le select de la page de configuration du module. Retourne les
 * templates propres a la boutique appelante ET ceux de la bibliotheque commune.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const shop = await authenticate(request);
  if (!shop) {
    return Response.json({ error: "Cle API absente ou invalide" }, { status: 401 });
  }

  const templates = await listTemplates(shop.id);

  return Response.json({
    shop: { slug: shop.slug, name: shop.name },
    templates: templates.map((template) => ({
      slug: template.slug,
      name: template.name,
      shared: template.shared,
      published_version: template.published_version,
      // Un template sans version publiee ne peut pas etre selectionne : le
      // module doit pouvoir le griser plutot que d'echouer au rendu.
      selectable: template.published_version !== null,
      updated_at: template.updated_at,
    })),
  });
}
