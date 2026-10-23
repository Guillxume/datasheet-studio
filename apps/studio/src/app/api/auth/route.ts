import { z } from "zod";
import { clientIp, originOf } from "@/lib/guard";
import { buildResetMail, sendMail } from "@/lib/mailer";
import { verifyPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/passwordPolicy";
import { checkPwnedPassword, pwnedCheckEnabled, pwnedProblem } from "@/lib/pwnedPassword";
import { endSession, purgeExpiredSessions, startSession } from "@/lib/session";
import {
  audit,
  consumeTokenAndSetPassword,
  findLoginCandidate,
  isLocked,
  issueToken,
  recentResetIssued,
  normalizeEmail,
  recordLoginAttempt,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/users";

/** Delai minimal entre deux liens de reinitialisation pour un meme compte. */
const RESET_COOLDOWN_SECONDS = 120;

/**
 * Connexion, deconnexion, activation, mot de passe oublie.
 *
 * UN SEUL POINT D'ENTREE A ACTIONS, comme /api/editor/template et pour la meme
 * raison : sur un outil interne, une surface reduite vaut mieux que la purete du
 * verbe HTTP. Les quatre actions partagent d'ailleurs l'essentiel — elles
 * repondent toutes en JSON a un formulaire, et aucune n'est appelee par une
 * machine.
 *
 * CETTE ROUTE EST HORS DU PORTAIL (voir src/middleware.ts) : par construction,
 * elle est appelee sans session.
 *
 * DEUX PRINCIPES QU'AUCUNE ACTION N'ENFREINT :
 *
 * 1. Les messages d'echec de connexion NE DISENT PAS ce qui a echoue. « Identifiants
 *    incorrects » couvre le compte inconnu, le mot de passe faux et le compte
 *    jamais active. Distinguer les trois donnerait la liste des adresses valides.
 *    Seul le verrouillage est annonce, parce qu'il faut bien expliquer l'attente.
 *
 * 2. « Mot de passe oublie » repond TOUJOURS la meme chose, adresse connue ou
 *    non. Meme raison.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("connexion"),
    email: z.string().min(1).max(320),
    password: z.string().min(1).max(200),
  }),
  z.object({ action: z.literal("deconnexion") }),
  z.object({
    action: z.literal("activation"),
    token: z.string().min(1).max(200),
    password: z.string().min(1).max(200),
  }),
  z.object({ action: z.literal("oubli"), email: z.string().min(1).max(320) }),
]);

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

/**
 * PLANCHER DE TEMPS DE REPONSE, pour les actions qui prennent une adresse.
 *
 * POURQUOI IL EST INDISPENSABLE. Depuis le correctif, un compte verrouille ne
 * declenche aucune derivation scrypt : il repond donc en quelques
 * millisecondes, la ou une verification reelle en prend 44. Cet ecart est
 * mesurable a distance, et il suffit a repondre « ce compte existe » — dix
 * requetes pour verrouiller une adresse, puis une pour lire sa vitesse.
 *
 * Le plancher egalise les chemins. Il coute un minuteur, pas 32 Mo — c'est
 * exactement ce qu'on cherchait a economiser en court-circuitant scrypt.
 *
 * 200 ms : confortablement au-dessus des 44 ms de la derivation plus les
 * aller-retours de base. Ce n'est pas une garantie absolue — une base
 * momentanement lente peut faire depasser le plancher, et l'ecart revient. Mais
 * les deux chemins subissent la meme lenteur, donc le signal reste noye.
 *
 * Une fois par douze heures pour une personne : imperceptible.
 */
const PLANCHER_MS = 200;

async function auPlancher(debut: number, reponse: Response): Promise<Response> {
  const reste = PLANCHER_MS - (Date.now() - debut);
  if (reste > 0) {
    await new Promise((resolve) => setTimeout(resolve, reste));
  }
  return reponse;
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "Corps JSON illisible.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return fail(422, "Requete invalide.");
  }
  const body = parsed.data;

  if (body.action === "deconnexion") {
    await endSession();
    return Response.json({ ok: true });
  }

  if (body.action === "connexion") {
    const debut = Date.now();
    const ip = clientIp(request);
    const user = await findLoginCandidate(body.email);

    /*
     * LE VERROU EST CONSULTE EN PREMIER, et c'est le correctif central de cette
     * route.
     *
     * La version precedente verifiait le mot de passe d'abord et ne regardait le
     * verrou que sur le chemin du succes. Un robot n'etait donc jamais ralenti :
     * chaque tentative, meme sur un compte verrouille, refaisait une derivation
     * scrypt — 44 ms et 32 Mo. Sur une URL publique (le nom du service figure
     * dans les journaux de Certificate Transparency), c'etait une porte qu'on
     * peut marteler et un levier de deni de service a tres bas cout.
     *
     * LE 429 EST EXPLICITE, ET CELA REVELE QUE LE COMPTE EXISTE. Onze requetes
     * sur une adresse suffisent : dix pour la verrouiller, une pour lire le 429.
     * C'est un oracle d'enumeration, et on le garde. Trois raisons :
     *
     *  1. il n'apprend rien. Les adresses du parc suivent
     *     prenom.nom@example.com — un attaquant les devine sans oracle, et le
     *     fermer ne ferait que deplacer le travail vers un annuaire public.
     *  2. l'alternative laisse une personne dehors sans explication. Un 401
     *     generique pendant le verrou, c'est quelqu'un qui retape son mot de
     *     passe correct dix fois en se demandant s'il a change.
     *  3. le canal qui compte reste ferme : « mot de passe oublie » repond a
     *     l'identique, meme message et meme duree, connue ou non.
     *
     * On pourrait le fermer — compter les echecs par ADRESSE ESSAYEE dans
     * login_attempts, compte existant ou pas, et rendre 429 dans les deux cas.
     * Quinze lignes et un index. Ce n'est pas fait parce que le point 1 rend le
     * gain nul ; si les adresses cessaient d'etre previsibles, ce serait le
     * correctif.
     */
    if (user && isLocked(user)) {
      recordLoginAttempt(body.email, ip, "verrouille");
      return auPlancher(
        debut,
        fail(
          429,
          "Trop de tentatives. Le compte est verrouille quelques minutes, ou reinitialisez votre mot de passe."
        )
      );
    }

    /*
     * Le mot de passe est verifie MEME quand le compte n'existe pas : verifyPassword
     * derive une empreinte a vide dans ce cas. Le plancher de reponse couvre
     * deja l'ecart de duree, mais deriver a vide reste la bonne habitude — le
     * jour ou le plancher serait retire, l'oracle ne reviendrait pas seul.
     */
    const ok = await verifyPassword(body.password, user?.password_hash ?? null);

    if (!user || !user.active || !ok) {
      recordLoginAttempt(
        body.email,
        ip,
        !user ? "inconnu" : !user.active ? "desactive" : "mot-de-passe"
      );

      if (user && user.active) {
        const verrouille = await recordLoginFailure(user.id);
        // Journalise UNE FOIS au declenchement, pas a chaque tentative suivante :
        // c'est le franchissement du seuil qui est un evenement, pas le fait
        // qu'un robot continue.
        if (verrouille) {
          await audit(null, "compte.verrouille", user.email, { ip, apres: 10 });
        }
      }

      return auPlancher(debut, fail(401, "Identifiants incorrects."));
    }

    await recordLoginSuccess(user.id);
    await purgeExpiredSessions();
    await startSession(user.id, {
      userAgent: request.headers.get("user-agent"),
      ip,
    });

    return auPlancher(debut, Response.json({ ok: true, role: user.role }));
  }

  if (body.action === "activation") {
    const problem = passwordProblem(body.password);
    if (problem !== null) {
      return fail(422, problem);
    }

    /*
     * APRES la politique de forme, et pour une bonne raison : un mot de passe
     * trop court est refuse sans appel reseau. Inutile de faire attendre
     * quelqu'un trois secondes pour lui dire qu'il manque deux caracteres.
     *
     * ECHOUE OUVERT — si le service est injoignable, le mot de passe passe. Voir
     * l'en-tete de src/lib/pwnedPassword.ts : refuser l'activation d'un compte
     * parce qu'une API tierce est en panne serait un plus mauvais echange.
     */
    const fuite = await checkPwnedPassword(body.password);
    const compromis = pwnedProblem(fuite);
    if (compromis !== null) {
      return fail(422, compromis);
    }
    if (fuite.etat === "indisponible" && pwnedCheckEnabled()) {
      // Journalise, sans bloquer : c'est le seul endroit ou l'on verra que le
      // controle ne fonctionne plus depuis trois semaines.
      console.warn(`controle des fuites indisponible : ${fuite.raison}`);
    }

    const result = await consumeTokenAndSetPassword(body.token, body.password);
    if ("error" in result) {
      return fail(400, result.error);
    }

    await audit({ id: result.user.id, email: result.user.email }, "compte.mot-de-passe-defini", result.user.email);

    // La session est ouverte dans la foulee : demander de se reconnecter juste
    // apres avoir choisi son mot de passe est une etape sans contenu.
    await startSession(result.user.id, {
      userAgent: request.headers.get("user-agent"),
      ip: clientIp(request),
    });

    return Response.json({ ok: true, role: result.user.role });
  }

  // body.action === "oubli"
  const debut = Date.now();
  const email = normalizeEmail(body.email);
  const user = await findLoginCandidate(email);

  /*
   * UN LIEN PAR COMPTE ET PAR DEUX MINUTES. Au-dela, rien n'est envoye — et la
   * reponse reste la meme, au meme plancher de duree : le plafond ne doit pas
   * redevenir un moyen de savoir si l'adresse existe. Le lien deja envoye reste
   * valable, c'est lui que la personne attend.
   */
  if (user && user.active && !(await recentResetIssued(user.id, RESET_COOLDOWN_SECONDS))) {
    const { token, expiresAt } = await issueToken(user.id, "reinitialisation");
    const mail = buildResetMail({
      to: user.email,
      name: user.name,
      origin: originOf(request),
      token,
      expiresAt,
    });

    /*
     * L'ENVOI N'EST PAS ATTENDU, et c'est un correctif — pas une optimisation.
     *
     * Le message rendu ci-dessous est volontairement identique pour une adresse
     * connue et pour une inconnue. Mais attendre `sendMail` annulait entierement
     * cette precaution : avec MAIL_TRANSPORT=smtp, une adresse connue repondait
     * apres la poignee de main SMTP — parfois plusieurs secondes — et une
     * inconnue en cinq millisecondes. Le formulaire redevenait un annuaire, avec
     * une seule requete par adresse et sans meme avoir a lire la reponse.
     *
     * L'envoi part donc en arriere-plan, et la journalisation avec lui. Un echec
     * de relais se lit dans les journaux du conteneur, comme avant.
     */
    void sendMail(mail)
      .then((sent) =>
        audit(null, "compte.reinitialisation-demandee", user.email, {
          transport: sent.transport,
          delivre: sent.delivered,
        })
      )
      .catch(() => {});
  }

  /*
   * Reponse identique dans tous les cas, y compris quand rien n'a ete envoye —
   * et au meme plancher de duree, sans quoi le message identique ne servirait a
   * rien.
   */
  return auPlancher(
    debut,
    Response.json({
      ok: true,
      message: "Si un compte existe pour cette adresse, un lien vient d'y etre envoye.",
    })
  );
}
