/**
 * Traduction des echecs SMTP — MODULE PUR, sans nodemailer.
 *
 * POURQUOI CE FICHIER EXISTE. Les erreurs de nodemailer sont exactes et
 * illisibles : « 535 5.7.8 Error: authentication failed », « self-signed
 * certificate in certificate chain », « connect ECONNREFUSED 10.0.0.5:587 ».
 * Chacune designe une cause precise et une correction en une ligne — mais il
 * faut connaitre le protocole pour la lire, et la personne qui configure le
 * relais du parc n'a pas a l'apprendre.
 *
 * Le code d'origine reste affiche a cote de la traduction : c'est lui qu'on
 * collera dans un ticket au fournisseur du relais.
 *
 * SEPARE DE mailer.ts pour la meme raison que passwordPolicy l'est de password :
 * un module pur se teste exhaustivement, et la table des cas est exactement ce
 * qui doit etre eprouve — pas l'envoi lui-meme.
 *
 * L'ORDRE DE LA TABLE COMPTE : le premier motif qui correspond gagne. Les cas
 * les plus specifiques doivent donc venir avant les plus larges. Les chaines
 * brutes utilisees dans mailError.test.ts sont OBSERVEES contre un vrai relais,
 * pas inventees — c'est ce qui donne sa valeur a cette table.
 */

export type MailDiagnostic = {
  /** Ce qu'il faut faire, en une phrase. */
  cause: string;
  /** Le champ de configuration a regarder, quand il y en a un. */
  regarder?: string;
  /** Le message d'origine, pour un ticket au fournisseur. */
  brut: string;
};

/**
 * Les motifs sont cherches dans le CODE d'erreur ET dans le message : nodemailer
 * expose `err.code` pour les echecs de transport (ECONNREFUSED, EAUTH) mais pas
 * pour les refus applicatifs du serveur, qui n'arrivent que sous forme de texte
 * avec leur code SMTP a trois chiffres.
 */
const CAS: Array<{ motif: RegExp; cause: string; regarder?: string }> = [
  {
    motif: /EAUTH|535|534|Invalid login|authentication fail|Username and Password not accepted/i,
    cause: "Le relais a refuse l'identifiant ou le mot de passe.",
    regarder: "MAIL_USER et MAIL_PASSWORD",
  },
  {
    motif: /ECONNREFUSED/i,
    cause: "Rien n'ecoute a cette adresse et sur ce port. Le relais est-il joignable depuis le conteneur ?",
    regarder: "MAIL_HOST et MAIL_PORT",
  },
  {
    motif: /ENOTFOUND|EAI_AGAIN|getaddrinfo/i,
    cause: "Le nom du relais ne resout pas. Depuis un conteneur, un nom d'hote local n'est pas forcement connu.",
    regarder: "MAIL_HOST",
  },
  {
    motif: /ETIMEDOUT|Greeting never received|timeout/i,
    cause:
      "Le relais ne repond pas. Un pare-feu bloque souvent le port 25 en sortie ; essayer 587 ou 465.",
    regarder: "MAIL_PORT",
  },
  {
    motif: /self[- ]signed|unable to verify|DEPTH_ZERO|CERT_|ERR_TLS/i,
    cause:
      "Le certificat TLS du relais n'est pas verifiable — typique d'un relais interne. C'est le seul cas ou MAIL_TLS_INSECURE=true se justifie, et uniquement sur un reseau de confiance.",
    regarder: "MAIL_SECURE et MAIL_TLS_INSECURE",
  },
  {
    // PAS de `ESOCKET` seul ici : nodemailer le pose aussi sur un
    // ECONNREFUSED (« ESOCKET connect ECONNREFUSED 127.0.0.1:1099 », observe).
    // Seul l'ordre de cette table les departageait, ce qui est une fragilite
    // inutile — les motifs propres a TLS suffisent.
    motif: /wrong version number|SSL routines|SSL alert|packet length too long/i,
    cause:
      "TLS et port ne s'accordent pas. Le 465 attend une connexion chiffree d'emblee (MAIL_SECURE=true), le 587 attend du STARTTLS (MAIL_SECURE=false).",
    regarder: "MAIL_PORT et MAIL_SECURE",
  },
  {
    motif: /EENVELOPE|550|553|Sender address rejected|not allowed|does not exist/i,
    cause:
      "Le relais refuse l'adresse d'expedition. La plupart n'acceptent qu'un domaine qu'ils gerent.",
    regarder: "MAIL_FROM",
  },
  {
    motif: /554|Relay access denied|not permitted to relay/i,
    cause: "Le relais refuse de router vers ce destinataire. Il faut s'authentifier, ou etre autorise par IP.",
    regarder: "MAIL_USER",
  },
  {
    motif: /421|4\.7\.0|too many|rate/i,
    cause: "Le relais nous limite temporairement. Reessayer plus tard ; ce n'est pas une erreur de configuration.",
  },
];

export function describeMailError(cause: unknown): MailDiagnostic {
  const brut =
    cause instanceof Error
      ? // `code` n'est pas dans le type Error mais nodemailer le pose : il porte
        // l'essentiel du diagnostic, autant le mettre en tete du texte cherche.
        `${(cause as { code?: string }).code ?? ""} ${cause.message}`.trim()
      : String(cause);

  const trouve = CAS.find((entry) => entry.motif.test(brut));

  return trouve
    ? { cause: trouve.cause, regarder: trouve.regarder, brut }
    : {
        cause: "Echec d'envoi non reconnu. Le message d'origine ci-dessous est ce qu'il faut transmettre.",
        brut,
      };
}
