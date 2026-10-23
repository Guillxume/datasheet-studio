import { z } from "zod";
import { isFeedbackActive } from "@/lib/feedbackSettings";
import { requireApi } from "@/lib/guard";
import { buildFeedbackMail, sendMail } from "@/lib/mailer";
import { audit, currentSuperadmin } from "@/lib/users";

/**
 * Envoi d'un retour au super-administrateur.
 *
 * LE MESSAGE EST TOUJOURS CONSIGNE DANS LE JOURNAL, meme quand le courriel
 * echoue ou qu'il n'y a personne a qui l'envoyer — meme regle que le mailer
 * (src/lib/mailer.ts) : un envoi qui echoue ne doit jamais faire disparaitre
 * ce que la personne a ecrit. C'est le meme journal que les autres decisions
 * du Studio (audit_log), donc visible sur /admin sans page dediee de plus.
 *
 * LA BASCULE EST REVERIFIEE ICI, pas seulement dans la barre de navigation :
 * masquer un lien ne protege rien (voir src/lib/guard.ts), et quelqu'un qui
 * a garde l'onglet /retours ouvert pendant que le super-administrateur
 * l'eteint ne doit pas pouvoir continuer a poster.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("feedback:send");
  if (actor instanceof Response) return actor;

  if (!(await isFeedbackActive())) {
    return Response.json(
      { ok: false, error: "Les retours ne sont pas activés sur cette instance." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Corps JSON illisible." }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Le retour est vide, ou dépasse 2000 caractères." },
      { status: 422 }
    );
  }

  const superadmin = await currentSuperadmin();

  // Etat possible (voir migration 007) : personne ne peut alors recevoir le
  // courriel, mais le retour n'est pas perdu pour autant, voir le journal.
  if (!superadmin) {
    await audit(actor, "retour.envoye", actor.email, { message: parsed.data.message, delivre: false });
    return Response.json({ ok: true, delivre: false });
  }

  const envoi = await sendMail(
    buildFeedbackMail({
      to: superadmin.email,
      authorName: actor.name,
      authorEmail: actor.email,
      message: parsed.data.message,
    })
  );

  await audit(actor, "retour.envoye", actor.email, {
    message: parsed.data.message,
    delivre: envoi.delivered,
  });

  return Response.json({ ok: true, delivre: envoi.delivered });
}
