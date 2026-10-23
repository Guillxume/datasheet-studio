import { requireApi } from "@/lib/guard";
import { setCategoryHidden } from "@/lib/datasheetsStore";
import { audit } from "@/lib/users";

/**
 * Masquer ou reafficher une categorie de la consultation (migration 014).
 *
 * Reserve a consultation:configure — l'administration. L'effet est immediat pour
 * tous les comptes : la categorie sort de la liste, du zip et du book, parce que
 * le filtre vit dans la lecture de l'index (src/lib/datasheetsStore.ts), pas dans
 * l'ecran.
 */

export const dynamic = "force-dynamic";

const MAX_DEPTH = 12;
const MAX_LABEL = 200;

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("consultation:configure");
  if (actor instanceof Response) return actor;

  let body: { boutique?: unknown; path?: unknown; hidden?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Corps JSON illisible." }, { status: 400 });
  }

  const shop = typeof body.boutique === "string" ? body.boutique.trim() : "";
  const path = Array.isArray(body.path) ? body.path : [];
  const valid =
    shop !== "" &&
    path.length > 0 &&
    path.length <= MAX_DEPTH &&
    path.every((label) => typeof label === "string" && label.trim() !== "" && label.length <= MAX_LABEL) &&
    typeof body.hidden === "boolean";
  if (!valid) {
    return Response.json({ ok: false, error: "boutique, path (fil de categories) et hidden sont requis." }, { status: 422 });
  }

  const fil = path as string[];
  if (!(await setCategoryHidden(shop, fil, body.hidden as boolean, actor.id))) {
    return Response.json({ ok: false, error: "Boutique inconnue." }, { status: 404 });
  }

  await audit(actor, body.hidden ? "consultation.categorie-masquee" : "consultation.categorie-affichee", shop, {
    categorie: fil.join(" > "),
  });
  return Response.json({ ok: true });
}
