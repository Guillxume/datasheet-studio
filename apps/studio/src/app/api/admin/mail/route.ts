import { z } from "zod";
import { originOf, requireApi } from "@/lib/guard";
import { mailTransport, sendMail, verifyMailer } from "@/lib/mailer";
import { audit } from "@/lib/users";

/**
 * Eprouver la configuration de courriel, depuis l'interface.
 *
 * POURQUOI CETTE ROUTE EXISTE. Sans elle, brancher un relais SMTP se diagnostique
 * en aveugle : on pose des variables, on invite quelqu'un, et si rien n'arrive on
 * ne sait pas si c'est l'authentification, le port, le certificat, l'adresse
 * d'expedition, ou le filtre antispam du destinataire. Chacune de ces causes a
 * une correction differente et un message SMTP illisible.
 *
 * DEUX ACTIONS, ET ELLES NE DISENT PAS LA MEME CHOSE :
 *
 *   verifier  ouvre la connexion, negocie TLS, s'authentifie, raccroche. Sans
 *             envoyer. Repond « le relais m'accepte » ou pas.
 *   test      envoie un vrai message. C'est le seul controle qui couvre
 *             l'adresse d'expedition et le routage — un relais peut tres bien
 *             nous authentifier puis refuser notre MAIL_FROM.
 *
 * Les deux sont necessaires : la premiere isole la moitie basse du probleme, la
 * seconde valide le reste.
 *
 * LE MESSAGE DE TEST NE PART QU'A L'ADRESSE DE L'APPELANT. Accepter un
 * destinataire libre ferait du Studio un moyen d'envoyer du courrier a n'importe
 * qui depuis le domaine du parc — authentifie, mais c'est exactement ce qu'on
 * appelle un relais ouvert.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verifier") }),
  z.object({ action: z.literal("test") }),
]);

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("admin:users");
  if (actor instanceof Response) return actor;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Corps JSON illisible." }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Requete invalide." }, { status: 422 });
  }

  if (parsed.data.action === "verifier") {
    const verdict = await verifyMailer();

    return Response.json({
      ok: true,
      transport: mailTransport(),
      joignable: verdict.ok,
      ...(verdict.ok ? {} : { diagnostic: verdict.diagnostic }),
    });
  }

  // action === "test"
  const origin = originOf(request);
  const envoi = await sendMail({
    to: actor.email,
    subject: "Test de configuration — Datasheet Studio",
    text: [
      `Bonjour ${actor.name},`,
      "",
      "Si vous lisez ceci, le relais de courriel du Datasheet Studio fonctionne :",
      "les invitations et les reinitialisations de mot de passe partiront.",
      "",
      `Instance : ${origin}`,
      "",
      "Ce message a ete demande depuis /admin. Personne d'autre ne l'a recu.",
    ].join("\n"),
    html: `<p>Bonjour ${actor.name.replace(/[<>&]/g, "")},</p>
<p>Si vous lisez ceci, le relais de courriel du Datasheet Studio fonctionne : les invitations et
les reinitialisations de mot de passe partiront.</p>
<p style="color:#6b6355;font-size:13px">Instance : ${origin}<br>
Ce message a ete demande depuis /admin. Personne d'autre ne l'a recu.</p>`,
  });

  await audit(actor, "courriel.test", actor.email, {
    transport: envoi.transport,
    delivre: envoi.delivered,
  });

  return Response.json({
    ok: true,
    destinataire: actor.email,
    transport: envoi.transport,
    delivre: envoi.delivered,
    ...(envoi.diagnostic ? { diagnostic: envoi.diagnostic } : {}),
  });
}
