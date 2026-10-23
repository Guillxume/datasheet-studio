import { createHash } from "node:crypto";

/**
 * Le mot de passe choisi figure-t-il dans une fuite de donnees connue ?
 *
 * POURQUOI CE CONTROLE EXISTE. La menace reelle contre un formulaire de
 * connexion expose sur Internet n'est pas qu'on devine un mot de passe : c'est
 * qu'un robot essaie des couples adresse/mot de passe DEJA FUITES ailleurs. La
 * politique de longueur (src/lib/passwordPolicy.ts) protege contre le hasard,
 * pas contre la reutilisation : un mot de passe de vingt caracteres repris d'un
 * site compromis en 2023 tombe au premier essai.
 *
 * Le plafond par IP de Traefik ATTENUE le bourrage d'identifiants — un botnet
 * reparti sur mille adresses passe sous le seuil. Ce controle-ci s'attaque a la
 * cause : on ne peut plus reutiliser un mot de passe compromis.
 *
 * ---------------------------------------------------------------------------
 * LE MOT DE PASSE NE QUITTE JAMAIS CE PROCESSUS, et c'est la seule chose a
 * comprendre avant d'accepter un appel reseau sur ce chemin.
 *
 * Le procede est le k-anonymat de Have I Been Pwned :
 *
 *   1. on calcule le SHA-1 du mot de passe, localement ;
 *   2. on envoie les CINQ PREMIERS caracteres hexadecimaux de cette empreinte ;
 *   3. le service repond la liste de TOUS les suffixes qu'il connait pour ce
 *      prefixe — environ deux mille — avec leur nombre d'occurrences ;
 *   4. on cherche notre suffixe dans cette liste, localement.
 *
 * Le service apprend donc qu'un mot de passe commencant par ces cinq caracteres
 * a ete verifie. Cinq caracteres hexadecimaux, c'est un espace de 1 048 576
 * valeurs : il ne peut ni identifier le mot de passe, ni savoir s'il a ete
 * trouve. Ni le mot de passe ni son empreinte complete ne partent.
 *
 * SHA-1 ICI N'EST PAS UN CHOIX DE SECURITE. C'est le format de l'index de HIBP,
 * imposé par l'API. Le stockage, lui, reste en scrypt (src/lib/password.ts).
 * ---------------------------------------------------------------------------
 *
 * IL ECHOUE OUVERT, deliberement. Si le service est injoignable, le mot de passe
 * est ACCEPTE. Refuser l'activation d'un compte parce qu'une API tierce est en
 * panne serait un plus mauvais echange : le compte reste inutilisable, la
 * personne ne comprend pas, et la reponse habituelle a cette impasse est de
 * desactiver le controle pour de bon.
 */

/**
 * L'hote du service, surchargeable.
 *
 * DEUX RAISONS, et la premiere n'est pas la testabilite. HIBP publie son jeu de
 * donnees en telechargement, et une API compatible s'auto-heberge : une
 * installation qui refuse tout appel sortant peut donc garder ce controle en
 * pointant sur sa propre copie. Le contrat est le meme — GET /range/<prefixe>.
 *
 * La seconde : cela rend le delai d'attente eprouvable contre un serveur qui
 * accepte la connexion et ne repond jamais. Une fausse `fetch` ne le prouve pas,
 * puisqu'elle ignore le signal d'annulation — c'est justement ce qu'un premier
 * essai a montre.
 *
 * Ce n'est PAS une surface d'attaque : la valeur vient de l'environnement du
 * serveur, comme GOTENBERG_URL, jamais d'un appelant.
 */
function hote(): string {
  return (process.env.PWNED_API_URL ?? "https://api.pwnedpasswords.com").replace(/\/+$/, "");
}

/**
 * Trois secondes. C'est une attente que quelqu'un subit en cliquant
 * « Enregistrer », donc elle doit rester courte — et le controle echouant
 * ouvert, la depasser ne coute qu'un mot de passe non verifie.
 */
const TIMEOUT_MS = 3_000;

/**
 * Pas de passage par src/lib/publicUrl.ts, et ce n'est pas un oubli : l'URL
 * n'est PAS fournie par un appelant, elle est construite ici a partir d'une
 * constante et de cinq caracteres hexadecimaux valides par construction. La
 * garde anti-SSRF protege les URLs qui viennent du payload ; il n'y en a pas ici.
 */
export function prefixeEtSuffixe(password: string): { prefixe: string; suffixe: string } {
  const empreinte = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  return { prefixe: empreinte.slice(0, 5), suffixe: empreinte.slice(5) };
}

export type PwnedVerdict =
  | { etat: "compromis"; occurrences: number }
  | { etat: "sain" }
  /** Le service n'a pas repondu. Le mot de passe est accepte — voir l'en-tete. */
  | { etat: "indisponible"; raison: string };

/**
 * Cherche un suffixe dans une reponse de l'API — FONCTION PURE, et c'est la
 * seule partie qui puisse se tromper en silence.
 *
 * LES ENTREES A COMPTEUR ZERO SONT DU REMBOURRAGE. Avec l'en-tete
 * `Add-Padding: true`, HIBP ajoute de fausses entrees pour que la TAILLE de la
 * reponse ne trahisse pas le nombre reel de suffixes connus — sans quoi un
 * observateur du reseau pourrait deduire des choses du volume. Mesure le
 * 02/09/2026 sur le prefixe 5BAA6 : 2 001 lignes avec rembourrage dont 24 a
 * compteur zero, 1 977 lignes sans.
 *
 * Les compter comme des correspondances rejetterait un bon mot de passe avec un
 * message incomprehensible. C'est peu probable et parfaitement evitable.
 */
export function chercherSuffixe(corps: string, suffixe: string): number | null {
  for (const ligne of corps.split("\n")) {
    const separateur = ligne.indexOf(":");
    if (separateur === -1) continue;

    if (ligne.slice(0, separateur).trim().toUpperCase() !== suffixe) continue;

    const occurrences = Number.parseInt(ligne.slice(separateur + 1).trim(), 10);
    if (!Number.isFinite(occurrences) || occurrences <= 0) return null; // rembourrage
    return occurrences;
  }

  return null;
}

/** `PWNED_PASSWORDS=off` desactive le controle, sans toucher au code. */
export function pwnedCheckEnabled(): boolean {
  return process.env.PWNED_PASSWORDS !== "off";
}

export async function checkPwnedPassword(password: string): Promise<PwnedVerdict> {
  if (!pwnedCheckEnabled()) {
    return { etat: "indisponible", raison: "controle desactive (PWNED_PASSWORDS=off)" };
  }

  const { prefixe, suffixe } = prefixeEtSuffixe(password);

  let corps: string;
  try {
    const response = await fetch(`${hote()}/range/${prefixe}`, {
      // Le rembourrage empeche de deduire quoi que ce soit de la taille de la
      // reponse. Il coute quelques kilo-octets.
      headers: { "Add-Padding": "true", "user-agent": "datasheet-studio" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return { etat: "indisponible", raison: `HTTP ${response.status}` };
    }
    corps = await response.text();
  } catch (cause) {
    return {
      etat: "indisponible",
      raison: cause instanceof Error ? cause.message : String(cause),
    };
  }

  const occurrences = chercherSuffixe(corps, suffixe);
  return occurrences === null ? { etat: "sain" } : { etat: "compromis", occurrences };
}

/**
 * Le message affiche a la personne, ou `null` si le mot de passe passe.
 *
 * IL N'ACCUSE PAS, ET C'EST VOULU. « Votre mot de passe est mauvais » est faux :
 * il peut etre long et unique et figurer quand meme dans une fuite, parce qu'il
 * a servi ailleurs. Le message dit le FAIT et sa consequence — il est dans les
 * dictionnaires des attaquants — puis demande autre chose. Le nombre
 * d'occurrences est donne parce qu'il emporte la conviction mieux qu'une
 * consigne.
 */
export function pwnedProblem(verdict: PwnedVerdict): string | null {
  if (verdict.etat !== "compromis") return null;

  const fois = new Intl.NumberFormat("fr-FR").format(verdict.occurrences);
  return (
    `Ce mot de passe figure dans des fuites de donnees connues (vu ${fois} fois). ` +
    `Il est peut-etre long et unique pour vous, mais il est deja dans les dictionnaires ` +
    `des attaquants : en choisir un autre.`
  );
}
