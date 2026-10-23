import { z } from "zod";
import { originOf, requireApi } from "@/lib/guard";
import { activationUrl, buildInvitationMail, sendMail } from "@/lib/mailer";
import { assignableRoles, can, ROLE_LABELS, ROLES } from "@/lib/roles";
import {
  audit,
  countAdmins,
  createUser,
  deleteNeverUsedUser,
  findUserById,
  isProtected,
  issueToken,
  listUsers,
  transferSuperadmin,
  updateUser,
} from "@/lib/users";

/**
 * Gestion des comptes, reservee au role administrateur.
 *
 * LE LIEN D'ACTIVATION EST RENVOYE A L'ECRAN QUAND LE COURRIEL N'EST PAS PARTI.
 * C'est le choix central de cette route, et il merite d'etre defendu : un lien
 * affiche est un lien qui peut etre copie-colle dans une conversation, donc une
 * fuite potentielle. Mais l'alternative est pire — un Studio installe sans
 * relais SMTP (le cas au premier jour de chaque environnement) ou un relais en
 * panne rend l'ouverture de comptes IMPOSSIBLE, et la reponse habituelle a cette
 * impasse est un mot de passe partage, c'est-a-dire exactement ce que ces
 * comptes remplacent.
 *
 * Le compromis est borne : le lien n'apparait que si l'envoi a echoue, il ne
 * vaut qu'une fois, il expire, et l'emettre a nouveau invalide le precedent.
 *
 * DEUX GARDE-FOUS SUR LE DERNIER ADMINISTRATEUR. On ne peut ni retrograder ni
 * desactiver le dernier compte administrateur actif. Sans eux, une seule
 * mauvaise manoeuvre laisse une instance sans personne pour en ouvrir l'acces —
 * il faudrait alors un acces SSH et `pnpm admin` pour s'en sortir.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("inviter"),
    email: z.string().min(3).max(320),
    name: z.string().min(2).max(120),
    role: z.enum(ROLES),
  }),
  z.object({ action: z.literal("reinviter"), id: z.uuid() }),
  z.object({ action: z.literal("role"), id: z.uuid(), role: z.enum(ROLES) }),
  z.object({ action: z.literal("actif"), id: z.uuid(), active: z.boolean() }),
  z.object({ action: z.literal("supprimer"), id: z.uuid() }),
  z.object({ action: z.literal("transferer-super"), id: z.uuid() }),
]);

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

export async function GET(): Promise<Response> {
  const auth = await requireApi("admin:users");
  if (auth instanceof Response) return auth;

  return Response.json({ ok: true, users: await listUsers() });
}

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("admin:users");
  if (actor instanceof Response) return actor;

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

  if (body.action === "inviter") {
    /*
     * LA MEME REGLE QUE POUR UNE PROMOTION — ET ELLE MANQUAIT ICI.
     *
     * Le garde `toucheUnAdministrateur` ci-dessous ne s'applique qu'aux actions
     * qui designent un compte EXISTANT par son identifiant. Une invitation n'a
     * pas de cible : elle passait donc sans aucun controle de role.
     *
     * CE QUE CELA OUVRAIT, verifie de bout en bout : un administrateur
     * ordinaire, a qui l'on refuse de PROMOUVOIR un compte en administrateur,
     * pouvait en CREER un — et meme un super-administrateur — par invitation.
     * Le resultat est le meme par un autre chemin, et le titulaire du lien
     * devenait super-administrateur. L'index unique de la migration 007 ne le
     * rattrapait que s'il en existait deja un, et alors sous la forme d'un 409
     * « Un compte existe deja avec cette adresse » qui n'explique rien.
     */
    if (!assignableRoles(actor.role).includes(body.role)) {
      return fail(
        403,
        body.role === "superadmin"
          ? "Le role de super-administrateur ne s'accorde pas : il se transmet."
          : "Seul le super-administrateur peut accorder le role d'administrateur."
      );
    }

    const created = await createUser({
      email: body.email,
      name: body.name,
      role: body.role,
      createdBy: actor.id,
    });
    if ("error" in created) {
      return fail(409, created.error);
    }

    await audit(actor, "compte.invite", created.user.email, { role: created.user.role });

    return Response.json({
      ok: true,
      user: created.user,
      ...(await deliverInvitation(request, created.user, actor.name)),
    });
  }

  const target = await findUserById(body.id);
  if (!target) {
    return fail(404, "Compte introuvable.");
  }

  /*
   * GERER UN ADMINISTRATEUR DEMANDE admin:superuser, et c'est le coeur de cette
   * fonctionnalite.
   *
   * Avant, deux administrateurs pouvaient se desactiver mutuellement : seuls
   * « pas le dernier actif » et « pas soi-meme » les empechaient d'aller au
   * bout, et un desaccord entre deux personnes de meme rang se reglait a celui
   * qui cliquait le premier. Desormais cela remonte a une seule personne.
   *
   * La garde porte sur la CIBLE et non sur l'action : promouvoir quelqu'un
   * administrateur est aussi sensible que d'en desactiver un, sinon le
   * verrouillage se contourne en se donnant un allie.
   */
  const toucheUnAdministrateur =
    target.role === "admin" ||
    target.role === "superadmin" ||
    (body.action === "role" && (body.role === "admin" || body.role === "superadmin"));

  if (toucheUnAdministrateur && !can(actor.role, "admin:superuser")) {
    return fail(
      403,
      target.role === "superadmin"
        ? "Le compte du super-administrateur ne se gere pas depuis ici."
        : "Seul le super-administrateur peut accorder ou retirer le role d'administrateur."
    );
  }

  // Le super-administrateur est protege contre la suppression et la
  // desactivation, y compris par lui-meme : sans cette regle on atteint zero
  // super-administrateur, et il faut un acces SSH pour s'en sortir. La seule
  // sortie est le transfert.
  /*
   * LE ROLE EST DANS CETTE LISTE, et il y a manque a la premiere version.
   *
   * Le garde-fou ne couvrait que `supprimer` et `actif`. Le super-administrateur
   * pouvait donc SE RETIRER SON PROPRE ROLE par le selecteur de role : reponse
   * « ok », zero super-administrateur, et plus que `pnpm superadmin` en SSH
   * pour s'en sortir. J'avais ecrit la garantie — « la seule sortie est la
   * transmission » — sans l'implementer, et c'est un essai de bout en bout qui
   * l'a montre, pas une relecture.
   *
   * Les trois actions sont donc refusees sur ce compte, POUR TOUT LE MONDE, y
   * compris son titulaire. `transferer-super` est le seul chemin, et il garantit
   * qu'il y a toujours quelqu'un qui repond de l'instance.
   */
  if (
    isProtected(target) &&
    (body.action === "supprimer" || body.action === "actif" || body.action === "role")
  ) {
    return fail(
      409,
      "Le role de super-administrateur ne se retire pas : il se transmet. Utiliser « Transmettre le role »."
    );
  }

  if (body.action === "transferer-super") {
    /*
     * SEUL LE TITULAIRE TRANSMET. La garde « toucheUnAdministrateur » ci-dessus
     * porte sur la CIBLE : un administrateur qui designait un editeur passait au
     * travers, et transferSuperadmin ne verifiait pas le role du sortant. Sur une
     * instance sans super-administrateur, il confiait donc le role a qui il
     * voulait ; avec un titulaire, l'index unique le bloquait en erreur 500
     * (audit du 16/10/2026). transferSuperadmin le reverifie en base.
     */
    if (!can(actor.role, "admin:superuser")) {
      return fail(403, "Seul le super-administrateur peut transmettre son role.");
    }
    const resultat = await transferSuperadmin(actor.id, target.id);
    if ("error" in resultat) return fail(409, resultat.error);

    await audit(actor, "super.transfere", target.email, { depuis: actor.email });
    return Response.json({ ok: true });
  }

  if (body.action === "reinviter") {
    /*
     * UN COMPTE DEJA ACTIVE NE SE REINVITE PAS. Le lien d'invitation pose un
     * nouveau mot de passe ; si le courriel ne part pas, il s'affiche a l'ecran
     * de l'administrateur — qui pouvait ainsi prendre le compte d'un collegue et
     * agir sous son nom. L'interface ne proposait deja l'action qu'aux comptes
     * jamais actives ; le serveur ne le verifiait pas. Un compte active qui a
     * perdu son mot de passe passe par « Mot de passe oublie », qui n'ecrit
     * qu'a son titulaire.
     */
    if (target.has_password) {
      return fail(409, "Ce compte est deja active : son titulaire passe par « Mot de passe oublie ».");
    }
    await audit(actor, "compte.reinvite", target.email);
    return Response.json({ ok: true, ...(await deliverInvitation(request, target, actor.name)) });
  }

  if (body.action === "role") {
    if (body.role === "superadmin") {
      // Il ne s'ACCORDE pas, il se TRANSMET : l'unicite est tenue par la base,
      // et une promotion directe echouerait sur l'index avec un message
      // incomprehensible. L'action dediee retrograde le sortant d'abord.
      return fail(422, "Le role de super-administrateur se transmet, il ne s'accorde pas.");
    }
    if (target.role === "admin" && body.role !== "admin" && (await countAdmins()) <= 1) {
      return fail(409, "C'est le dernier administrateur actif : lui retirer le role fermerait l'administration.");
    }

    const updated = await updateUser(target.id, { role: body.role });
    await audit(actor, "compte.role-change", target.email, { avant: target.role, apres: body.role });
    return Response.json({ ok: true, user: updated });
  }

  if (body.action === "actif") {
    if (!body.active && target.id === actor.id) {
      return fail(409, "On ne desactive pas son propre compte.");
    }
    if (!body.active && target.role === "admin" && (await countAdmins()) <= 1) {
      return fail(409, "C'est le dernier administrateur actif.");
    }

    const updated = await updateUser(target.id, { active: body.active });
    await audit(actor, body.active ? "compte.reactive" : "compte.desactive", target.email);
    return Response.json({ ok: true, user: updated });
  }

  // body.action === "supprimer"
  if (target.id === actor.id) {
    return fail(409, "On ne supprime pas son propre compte.");
  }

  const removed = await deleteNeverUsedUser(target.id);
  if ("error" in removed) {
    return fail(409, removed.error);
  }

  await audit(actor, "compte.supprime", target.email, { role: target.role });
  return Response.json({ ok: true });
}

/**
 * Emet un jeton, tente l'envoi, et rend de quoi depanner si l'envoi a echoue.
 *
 * L'ordre compte : le jeton est emis AVANT l'envoi. Si l'on inversait, un relais
 * lent ferait apparaitre un courriel avec un lien pas encore valide.
 */
async function deliverInvitation(
  request: Request,
  user: { id: string; email: string; name: string; role: keyof typeof ROLE_LABELS },
  invitedBy: string
): Promise<{ mail: { delivered: boolean; transport: string; error?: string }; link?: string }> {
  const { token, expiresAt } = await issueToken(user.id, "invitation");
  const origin = originOf(request);

  const sent = await sendMail(
    buildInvitationMail({
      to: user.email,
      name: user.name,
      roleLabel: ROLE_LABELS[user.role],
      origin,
      token,
      invitedBy,
      expiresAt,
    })
  );

  return {
    mail: sent,
    ...(sent.delivered ? {} : { link: activationUrl(origin, token) }),
  };
}
