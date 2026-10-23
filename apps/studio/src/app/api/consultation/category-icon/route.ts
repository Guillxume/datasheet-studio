import { requireApi } from "@/lib/guard";
import { isIconRef } from "@/lib/icons";
import { setCategoryIcon } from "@/lib/datasheetsStore";

/**
 * POST /api/consultation/category-icon — l'icone d'une categorie de niveau 1,
 * montree par son intercalaire. Corps : { boutique, category, icon }.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApi("datasheets:write");
  if (auth instanceof Response) return auth;

  let body: { boutique?: unknown; category?: unknown; icon?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Corps JSON illisible." }, { status: 400 });
  }

  const shop = typeof body.boutique === "string" ? body.boutique.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const icon = typeof body.icon === "string" ? body.icon.trim() : "";

  if (shop === "" || category === "" || category.length > 200) {
    return Response.json({ ok: false, error: "Boutique ou categorie manquante." }, { status: 422 });
  }
  // Seules les references que le Studio sait afficher entrent en base : une
  // valeur libre finirait en attribut src d'une image, sur une page partagee.
  if (!isIconRef(icon)) {
    return Response.json({ ok: false, error: "Icone inconnue." }, { status: 422 });
  }

  if (!(await setCategoryIcon(shop, category, icon))) {
    return Response.json({ ok: false, error: "Boutique introuvable." }, { status: 404 });
  }
  return Response.json({ ok: true, icon });
}
