import { z } from "zod";
import { setFeedbackActive } from "@/lib/feedbackSettings";
import { requireApi } from "@/lib/guard";
import { audit } from "@/lib/users";

/**
 * Bascule de la page /retours, reservee au super-administrateur.
 *
 * admin:superuser ET NON admin:users : ce reglage n'est pas la gestion d'un
 * compte ou d'une boutique, c'est « ce que le seul super-administrateur peut
 * faire » au sens de src/lib/roles.ts — exactement la capacite deja prevue
 * pour ca.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ active: z.boolean() });

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("admin:superuser");
  if (actor instanceof Response) return actor;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Corps JSON illisible." }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Requête invalide." }, { status: 422 });
  }

  await setFeedbackActive(parsed.data.active, actor.id);
  await audit(actor, parsed.data.active ? "retours.active" : "retours.desactive", null);

  return Response.json({ ok: true, active: parsed.data.active });
}
