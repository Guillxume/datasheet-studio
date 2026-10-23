/**
 * Envoi de courriel.
 *
 * Deux transports, choisis par MAIL_TRANSPORT :
 *
 *   log   (defaut) ecrit le message dans les journaux du conteneur. C'est le
 *         mode de developpement, et c'est aussi le mode de repli acceptable en
 *         ligne le temps qu'un relais SMTP soit fourni.
 *   smtp  nodemailer vers le relais du parc.
 *
 * LA REGLE QUI GOUVERNE CE MODULE : un envoi qui echoue ne doit JAMAIS faire
 * echouer l'action qui l'a declenche. Inviter quelqu'un cree le compte et le
 * jeton ; si le relais est injoignable, l'administrateur voit le lien a l'ecran
 * et le transmet lui-meme. L'inverse — annuler la creation du compte parce que
 * le SMTP tousse — laisserait un jeton emis sans compte utilisable et obligerait
 * a recommencer.
 *
 * C'est aussi pourquoi `sendMail` rend un resultat plutot que de lever.
 *
 * LES TEXTES ENVOYES SONT ACCENTUES, contrairement aux commentaires de ce
 * depot. La convention ASCII s'applique au CODE ; le corps d'un courriel est du
 * contenu lu par une personne, comme la documentation. « Votre acces au Studio,
 * avec le role Editeur » est parti pendant quelques jours, et ca se voit.
 */

import { describeMailError, type MailDiagnostic } from "./mailError";

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type MailResult = {
  delivered: boolean;
  transport: "smtp" | "log";
  error?: string;
  /** Traduction lisible de l'echec. Voir src/lib/mailError.ts. */
  diagnostic?: MailDiagnostic;
};

export function mailTransport(): "smtp" | "log" {
  return process.env.MAIL_TRANSPORT === "smtp" ? "smtp" : "log";
}

function from(): string {
  return process.env.MAIL_FROM ?? "Datasheet Studio <no-reply@localhost>";
}

/**
 * Le transporteur, cree UNE FOIS et reutilise.
 *
 * La version precedente en construisait un a chaque appel : chaque invitation
 * ouvrait donc sa propre connexion SMTP, avec sa poignee de main TLS et son
 * authentification. Invisible sur un envoi isole, absurde des qu'on invite cinq
 * personnes de suite — et certains relais comptent les connexions.
 *
 * `pool: true` garde la connexion ouverte entre deux messages. Les plafonds sont
 * volontairement bas : ce service envoie des invitations et des
 * reinitialisations, jamais une campagne.
 */
let transporteur: import("nodemailer").Transporter | null = null;

async function obtenirTransporteur(): Promise<import("nodemailer").Transporter> {
  if (transporteur !== null) return transporteur;

  // Import differe : sans lui, nodemailer entre dans le paquet serveur meme
  // quand le transport « log » est le seul utilise.
  const nodemailer = (await import("nodemailer")).default;

  const commun = {
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    // Un relais qui ne repond pas ne doit pas retenir une requete d'invitation.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    /*
     * MAIL_TLS_INSECURE existe pour UN cas et un seul : un relais interne dont
     * le certificat est auto-signe. Ce n'est pas un raccourci de configuration —
     * l'activer sur un relais joignable depuis Internet revient a accepter
     * n'importe quel interlocuteur, avec les identifiants SMTP a la cle.
     */
    ...(process.env.MAIL_TLS_INSECURE === "true"
      ? { tls: { rejectUnauthorized: false } }
      : {}),
  };

  /*
   * `{ url, ...commun }` ET NON `createTransport(url, commun)`. Le second
   * argument de createTransport n'a jamais ete des options de connexion : ce
   * sont les valeurs par defaut des MESSAGES. Passe ainsi, `commun` etait ignore
   * des qu'une MAIL_SMTP_URL etait definie — ni pool, ni delais d'attente, ni
   * MAIL_TLS_INSECURE. Nodemailer 10 le refuse au typage, ce qui l'a revele.
   */
  transporteur = process.env.MAIL_SMTP_URL
    ? nodemailer.createTransport({ ...commun, url: process.env.MAIL_SMTP_URL })
    : nodemailer.createTransport({
        ...commun,
        host: process.env.MAIL_HOST ?? "localhost",
        port: Number(process.env.MAIL_PORT ?? 587),
        // 465 attend une connexion chiffree d'emblee, 587 du STARTTLS. Le defaut
        // suit le port pour que le cas courant marche sans y penser.
        secure: process.env.MAIL_SECURE
          ? process.env.MAIL_SECURE === "true"
          : Number(process.env.MAIL_PORT ?? 587) === 465,
        auth: process.env.MAIL_USER
          ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD ?? "" }
          : undefined,
      });

  return transporteur;
}

/**
 * Eprouve la configuration SANS envoyer de message.
 *
 * `transporter.verify()` ouvre la connexion, negocie TLS et s'authentifie, puis
 * raccroche. C'est ce qui permet de distinguer « le relais refuse mes
 * identifiants » de « le relais refuse cette adresse d'expedition » — deux
 * pannes qui se ressemblent quand on ne voit que « l'invitation n'est pas
 * arrivee ».
 */
export async function verifyMailer(): Promise<{ ok: true } | { ok: false; diagnostic: MailDiagnostic }> {
  if (mailTransport() === "log") {
    return {
      ok: false,
      diagnostic: {
        cause: "MAIL_TRANSPORT vaut « log » : rien n'est envoye, les messages sont ecrits dans les journaux du conteneur.",
        regarder: "MAIL_TRANSPORT",
        brut: "transport=log",
      },
    };
  }

  try {
    const t = await obtenirTransporteur();
    await t.verify();
    return { ok: true };
  } catch (cause) {
    // Le transporteur est jete : garder un pool casse ferait echouer les envois
    // suivants apres une correction de configuration, sans redemarrage.
    transporteur = null;
    return { ok: false, diagnostic: describeMailError(cause) };
  }
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  const transport = mailTransport();

  if (transport === "log") {
    // Le lien est la seule partie qu'on cherche dans les journaux : il est donc
    // ecrit tel quel, sur sa propre ligne, sans encadrement decoratif.
    console.log(
      [
        "--- COURRIEL (transport=log, non envoye) ---",
        `De     : ${from()}`,
        `A      : ${mail.to}`,
        `Objet  : ${mail.subject}`,
        "",
        mail.text,
        "--- fin ---",
      ].join("\n")
    );
    return { delivered: false, transport: "log" };
  }

  try {
    const t = await obtenirTransporteur();

    await t.sendMail({
      from: from(),
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: {
        /*
         * `Auto-Submitted: auto-generated` (RFC 3834) dit que ce message n'a pas
         * ete tape par une personne. Deux effets concrets : les repondeurs
         * d'absence et les accuses de reception ne s'y declenchent pas — sans
         * quoi une invitation envoyee a quelqu'un en conges produit une reponse
         * automatique vers no-reply@, qui rebondit.
         *
         * PAS de `List-Unsubscribe`, et c'est un choix : mail-tester en retire
         * des points, mais un lien de desabonnement sur une reinitialisation de
         * mot de passe n'a aucun sens — on ne se desabonne pas de sa propre
         * demande. Gmail ne l'exige que des envois EN MASSE.
         */
        "Auto-Submitted": "auto-generated",
      },
    });

    return { delivered: true, transport: "smtp" };
  } catch (cause) {
    const diagnostic = describeMailError(cause);
    transporteur = null; // voir verifyMailer : on ne garde pas un pool casse.

    // Les deux lignes : la cause lisible, puis le brut. Le journal du conteneur
    // est souvent le seul endroit ou l'on regarde apres coup.
    console.error(`Envoi SMTP echoue vers ${mail.to} : ${diagnostic.cause}`);
    console.error(`  ${diagnostic.brut}`);

    return { delivered: false, transport: "smtp", error: diagnostic.cause, diagnostic };
  }
}

// ---------------------------------------------------------------------------
// Composition des messages
// ---------------------------------------------------------------------------
//
// FONCTIONS PURES, testees dans mailer.test.ts. Elles ne touchent ni au reseau
// ni a la base : un test verifie que le lien construit est bien celui qu'on
// attend, ce qui est la seule chose qui puisse silencieusement casser ici.

export function activationUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/activation?jeton=${encodeURIComponent(token)}`;
}

/** Enveloppe HTML commune. Styles EN LIGNE : aucun client de messagerie ne lit une feuille externe. */
function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f2efea;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2e2b25">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e0d8;border-radius:8px">
<tr><td style="padding:28px 32px">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6355">Datasheet Studio</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#a8481a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">${escapeHtml(label)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#6b6355">Si le bouton ne fonctionne pas, copiez ce lien dans la barre d'adresse :</p>
<p style="margin:0;font-size:13px;word-break:break-all"><a href="${escapeHtml(href)}" style="color:#a8481a">${escapeHtml(href)}</a></p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildInvitationMail(input: {
  to: string;
  name: string;
  roleLabel: string;
  origin: string;
  token: string;
  invitedBy: string;
  expiresAt: Date;
}): Mail {
  const url = activationUrl(input.origin, input.token);
  const jours = Math.round((input.expiresAt.getTime() - Date.now()) / 86_400_000);

  const text = [
    `Bonjour ${input.name},`,
    "",
    `${input.invitedBy} vous a ouvert un accès au Datasheet Studio, avec le rôle « ${input.roleLabel} ».`,
    "",
    "Choisissez votre mot de passe ici :",
    url,
    "",
    `Ce lien est valable ${jours} jour(s) et ne sert qu'une fois.`,
    "Si vous n'attendiez pas ce message, ignorez-le : sans mot de passe, le compte reste inutilisable.",
  ].join("\n");

  const html = wrap(
    "Votre accès au Studio",
    `<p style="margin:0 0 12px;line-height:1.6">Bonjour ${escapeHtml(input.name)},</p>
     <p style="margin:0 0 12px;line-height:1.6">${escapeHtml(input.invitedBy)} vous a ouvert un accès au Datasheet Studio, avec le rôle <strong>${escapeHtml(input.roleLabel)}</strong>.</p>
     ${button(url, "Choisir mon mot de passe")}
     <p style="margin:20px 0 0;font-size:13px;color:#6b6355;line-height:1.6">Ce lien est valable ${jours} jour(s) et ne sert qu'une fois. Si vous n'attendiez pas ce message, ignorez-le : sans mot de passe, le compte reste inutilisable.</p>`
  );

  return { to: input.to, subject: "Votre accès au Datasheet Studio", text, html };
}

export function buildResetMail(input: {
  to: string;
  name: string;
  origin: string;
  token: string;
  expiresAt: Date;
}): Mail {
  const url = activationUrl(input.origin, input.token);
  const heures = Math.max(1, Math.round((input.expiresAt.getTime() - Date.now()) / 3_600_000));

  const text = [
    `Bonjour ${input.name},`,
    "",
    "Une réinitialisation de mot de passe a été demandée pour votre compte du Datasheet Studio.",
    "",
    "Choisissez un nouveau mot de passe ici :",
    url,
    "",
    `Ce lien est valable ${heures} heure(s) et ne sert qu'une fois.`,
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.",
  ].join("\n");

  const html = wrap(
    "Réinitialiser votre mot de passe",
    `<p style="margin:0 0 12px;line-height:1.6">Bonjour ${escapeHtml(input.name)},</p>
     <p style="margin:0 0 12px;line-height:1.6">Une réinitialisation de mot de passe a été demandée pour votre compte du Datasheet Studio.</p>
     ${button(url, "Choisir un nouveau mot de passe")}
     <p style="margin:20px 0 0;font-size:13px;color:#6b6355;line-height:1.6">Ce lien est valable ${heures} heure(s) et ne sert qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.</p>`
  );

  return { to: input.to, subject: "Réinitialiser votre mot de passe du Studio", text, html };
}

/**
 * Lien de creation de ticket Linear, pre-rempli.
 *
 * `https://linear.new?title=...&description=...` est un lien PUBLIC documente
 * par Linear (https://linear.app/docs/creating-issues, section « Create a new
 * issue URL ») : il ne demande aucune cle d'API ni configuration cote Studio,
 * et fonctionne dans n'importe quel navigateur ou la personne qui clique est
 * deja connectee a Linear. AUCUNE EQUIPE N'EST PRECISEE : le Studio ne sait pas
 * dans quel espace Linear le retour doit atterrir, et deviner produirait soit un
 * ticket au mauvais endroit, soit un lien casse. Sans le parametre `team`,
 * Linear demande simplement de choisir a l'ouverture.
 *
 * `URLSearchParams` encode l'espace en `+`, exactement la convention que Linear
 * documente pour ce lien.
 */
export function linearTicketUrl(input: { title: string; description: string }): string {
  const params = new URLSearchParams({ title: input.title, description: input.description });
  return `https://linear.new?${params.toString()}`;
}

export function buildFeedbackMail(input: {
  to: string;
  authorName: string;
  authorEmail: string;
  message: string;
}): Mail {
  const ticket = linearTicketUrl({
    title: `Retour — ${input.authorName}`,
    description: `${input.message}\n\n— Envoyé par ${input.authorName} (${input.authorEmail}) depuis le Datasheet Studio.`,
  });

  const text = [
    `${input.authorName} (${input.authorEmail}) a laissé un retour sur le Datasheet Studio :`,
    "",
    input.message,
    "",
    "Créer un ticket Linear à partir de ce retour :",
    ticket,
  ].join("\n");

  const html = wrap(
    "Nouveau retour",
    `<p style="margin:0 0 12px;line-height:1.6"><strong>${escapeHtml(input.authorName)}</strong> (${escapeHtml(input.authorEmail)}) a laissé un retour sur le Datasheet Studio :</p>
     <p style="margin:0 0 20px;padding:12px 16px;background:#f2efea;border-radius:6px;white-space:pre-wrap;line-height:1.6">${escapeHtml(input.message)}</p>
     ${button(ticket, "Créer un ticket Linear")}`
  );

  return { to: input.to, subject: `Nouveau retour — ${input.authorName}`, text, html };
}
