/**
 * Une requete d'ecriture vient-elle d'une page du Studio ? — module pur, lu par
 * le portail (src/proxy.ts).
 *
 * POURQUOI SAMESITE NE SUFFIT PAS. Le cookie de session est `SameSite=Lax` : un
 * autre SITE ne peut pas l'envoyer avec un POST. Mais « site » veut dire domaine
 * enregistrable, et les boutiques vivent sous le meme que le Studio
 * (www.acme.example, studio.acme.example). Une faille XSS sur n'importe
 * quelle boutique du parc suffisait donc a faire agir l'administrateur connecte
 * — inviter un compte, faire tourner une cle API, supprimer un template — sans
 * qu'il ait rien vu (audit du 16/10/2026, constat 6).
 *
 * L'ORIGINE, ELLE, EST EXACTE. Un navigateur pose `Origin` sur toute requete
 * d'ecriture, et une page ne peut ni l'omettre ni la falsifier. On exige qu'elle
 * designe l'hote meme qui recoit la requete. `Sec-Fetch-Site` sert de filet
 * quand `Origin` manque.
 *
 * UNE REQUETE SANS AUCUN DES DEUX PASSE : elle ne vient pas d'un navigateur
 * (curl, script, sonde), et sans navigateur il n'y a pas de session a detourner
 * — c'est le cookie que l'attaque emprunte, et seul un navigateur le joint
 * d'office. Le controle d'acces, lui, reste entier en aval (src/lib/guard.ts).
 */

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type HeaderBag = { get(name: string): string | null };

/** La raison du refus, ou null si la requete peut passer. */
export function refusCrossOrigin(method: string, headers: HeaderBag): string | null {
  if (!MUTATIONS.has(method.toUpperCase())) return null;

  // L'hote tel que le navigateur l'a vise. Traefik transmet l'en-tete Host
  // d'origine (passHostHeader, son defaut) ; x-forwarded-host couvre un
  // intermediaire qui le reecrirait. Une page ne peut poser ni l'un ni l'autre.
  const hote = headers.get("x-forwarded-host") ?? headers.get("host");

  const origin = headers.get("origin");
  if (origin !== null) {
    // « null » : document opaque (iframe sandboxee, redirection entre
    // origines). Rien de legitime n'ecrit au Studio depuis la.
    if (origin === "null") return "origine opaque";
    let vue: string;
    try {
      vue = new URL(origin).host;
    } catch {
      return "origine illisible";
    }
    return hote !== null && vue === hote ? null : `origine ${origin}`;
  }

  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    return `requete ${site}`;
  }
  return null;
}
