import { requireApi } from "@/lib/guard";
import { MAX_SELECTION } from "@/lib/datasheets";
import { setDatasheetsHidden } from "@/lib/datasheetsStore";
import { audit } from "@/lib/users";

/**
 * Masquer ou reafficher des fiches de la consultation, produit par produit
 * (migration 015). Meme garde que les categories : consultation:configure,
 * l'administration. Effet immediat pour tous les comptes — liste, zip, book.
 *
 * Plusieurs produits par appel : la barre de selection de la consultation en
 * masque d'un coup. Plafond : celui d'une selection (MAX_SELECTION).
 */

export const dynamic = "force-dynamic";

const MAX_KEY = 200;

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("consultation:configure");
  if (actor instanceof Response) return actor;

  let body: { boutique?: unknown; products?: unknown; hidden?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Corps JSON illisible." }, { status: 400 });
  }

  const shop = typeof body.boutique === "string" ? body.boutique.trim() : "";
  const products = Array.isArray(body.products) ? body.products : [];
  const valid =
    shop !== "" &&
    products.length > 0 &&
    products.length <= MAX_SELECTION &&
    products.every((key) => typeof key === "string" && key.trim() !== "" && key.length <= MAX_KEY) &&
    typeof body.hidden === "boolean";
  if (!valid) {
    return Response.json(
      { ok: false, error: `boutique, products (1 a ${MAX_SELECTION} produits) et hidden sont requis.` },
      { status: 422 }
    );
  }

  const keys = [...new Set(products as string[])];
  if (!(await setDatasheetsHidden(shop, keys, body.hidden as boolean, actor.id))) {
    return Response.json({ ok: false, error: "Boutique inconnue." }, { status: 404 });
  }

  await audit(actor, body.hidden ? "consultation.fiche-masquee" : "consultation.fiche-affichee", shop, {
    produits: keys.slice(0, 50),
    nombre: keys.length,
  });
  return Response.json({ ok: true, count: keys.length });
}
