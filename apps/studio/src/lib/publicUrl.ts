import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Garde contre la falsification de requete cote serveur (SSRF).
 *
 * LE DEFAUT QU'ELLE CORRIGE, ET IL ETAIT REEL. `fetchRemoteImages` appelait
 * `fetch(url)` sur n'importe quelle URL venue du payload, redirections suivies,
 * sans aucun filtrage — puis inlinait le resultat EN BASE64 DANS LE PDF. Une
 * boutique authentifiee pouvait donc se faire livrer le contenu de
 * http://169.254.169.254/latest/meta-data/ ou de n'importe quel service HTTP du
 * reseau interne, dans un document qu'elle recoit.
 *
 * Le seul garde-fou etait `content-type: image/*` — un service qui sert une
 * image, ou un serveur controle par l'appelant, passait au travers.
 *
 * « MAIS IL FAUT UNE CLE API VALIDE. » Oui. Et cette cle vit dans la
 * configuration d'un module PrestaShop, sur un serveur qui n'est pas le notre.
 * C'est exactement le modele de menace qu'on vient d'abandonner en remplacant le
 * mot de passe partage : on ne parie pas sur le fait qu'un secret distribue ne
 * fuitera pas.
 *
 * CE QUE CE MODULE GARANTIT :
 *   - schema http ou https, rien d'autre ;
 *   - toutes les adresses resolues sont publiques ;
 *   - chaque redirection est revalidee, une par une.
 *
 * CE QU'IL NE GARANTIT PAS, ecrit ici pour ne pas donner de fausse assurance :
 * entre la resolution DNS et la connexion, un serveur hostile peut faire changer
 * sa reponse DNS pour pointer sur une adresse privee — c'est le « DNS
 * rebinding ». S'en premunir demanderait de se connecter a l'ADRESSE deja
 * validee en forcant l'en-tete Host, ce qui casse la verification du certificat
 * TLS, ou un client HTTP a `lookup` personnalise que Node n'expose pas sans
 * dependance supplementaire. Le risque residuel est accepte : il exige un
 * attaquant qui controle un domaine ET sa zone DNS, la ou le defaut corrige ici
 * ne demandait qu'une chaine de caracteres.
 */

/** Trois sauts : au-dela, c'est une boucle ou un service qui ne veut pas repondre. */
const MAX_REDIRECTS = 3;

/**
 * Classification d'une adresse IPv4, en toutes lettres.
 *
 * Ecrite a la main plutot que tiree d'une bibliotheque : la liste tient en dix
 * lignes, elle est testee exhaustivement (publicUrl.test.ts), et une dependance
 * de plus pour ca ne se justifie pas — voir CONTRIBUTING.md §6.
 */
function isPrivateIPv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    // Une adresse qu'on ne sait pas lire est traitee comme privee : le doute
    // profite au reseau interne, jamais a l'appelant.
    return true;
  }

  const [a, b] = octets;

  return (
    a === 0 ||                          // 0.0.0.0/8      « cet hote »
    a === 10 ||                         // 10.0.0.0/8     prive
    a === 127 ||                        // 127.0.0.0/8    boucle locale
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    (a === 169 && b === 254) ||         // 169.254.0.0/16 lien-local — les metadonnees cloud
    (a === 172 && b >= 16 && b <= 31) ||// 172.16.0.0/12  prive
    (a === 192 && b === 168) ||         // 192.168.0.0/16 prive
    (a === 192 && b === 0) ||           // 192.0.0.0/24 et 192.0.2.0/24 (doc)
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 essais de debit
    (a === 198 && b === 51) ||          // 198.51.100.0/24 doc
    (a === 203 && b === 0) ||           // 203.0.113.0/24  doc
    a >= 224                            // 224.0.0.0/4 multicast, 240.0.0.0/4 reserve
  );
}

/**
 * Developpe une IPv6 en ses huit groupes de 16 bits, ou `null` si illisible.
 *
 * INDISPENSABLE, ET LE TEST L'A PROUVE. `new URL()` normalise l'adresse :
 * `http://[::ffff:10.0.0.1]/` ressort avec `hostname` valant `[::ffff:a00:1]`.
 * Une comparaison sur la notation pointee laissait donc passer exactement le
 * contournement qu'elle etait censee fermer. On raisonne sur les octets, pas sur
 * l'ecriture.
 */
function expandIPv6(value: string): number[] | null {
  const [avant, apres, ...reste] = value.split("::");
  if (reste.length > 0) return null;

  const lire = (part: string): number[] =>
    part === "" ? [] : part.split(":").map((g) => Number.parseInt(g, 16));

  const tete = lire(avant);
  const queue = apres === undefined ? [] : lire(apres);

  const groupes =
    apres === undefined
      ? tete
      : [...tete, ...new Array(8 - tete.length - queue.length).fill(0), ...queue];

  if (groupes.length !== 8 || groupes.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) {
    return null;
  }
  return groupes;
}

function isPrivateIPv6(address: string): boolean {
  const value = address.toLowerCase().split("%")[0]; // retire l'identifiant de zone

  // Adresse IPv4 encapsulee, sous SES DEUX ecritures : ::ffff:10.0.0.1 et
  // ::ffff:a00:1 designent la meme machine, et les deux doivent etre jugees
  // comme de l'IPv4.
  const pointee = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (pointee) return isPrivateIPv4(pointee[1]);

  const groupes = expandIPv6(value);
  if (groupes === null) return true; // illisible : on refuse

  const mappee = groupes.slice(0, 5).every((g) => g === 0) && groupes[5] === 0xffff;
  if (mappee) {
    const a = groupes[6] >> 8, b = groupes[6] & 0xff, c = groupes[7] >> 8, d = groupes[7] & 0xff;
    return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
  }

  if (value === "::" || value === "::1") return true;        // non specifiee, boucle locale
  if (/^f[cd]/.test(value)) return true;                     // fc00::/7  unique-local
  if (/^fe[89ab]/.test(value)) return true;                  // fe80::/10 lien-local
  if (/^ff/.test(value)) return true;                        // ff00::/8  multicast
  if (/^(2001:db8|64:ff9b|2002:)/.test(value)) return true;  // doc, NAT64, 6to4

  return false;
}

/** Une adresse qu'on refuse de joindre. Module pur : c'est ce qui la rend testable. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true; // ni IPv4 ni IPv6 : on ne sait pas, donc on refuse
}

export type UrlVerdict = { ok: true; url: URL } | { ok: false; raison: string };

/** Controles qui ne demandent pas le reseau. Separes pour etre testes sans DNS. */
export function inspectUrl(raw: string): UrlVerdict {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, raison: "URL illisible" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, raison: `schema refuse (${url.protocol.replace(":", "")})` };
  }

  // Une identite dans l'URL (http://user:pass@hote/) ne sert a rien ici et sert
  // beaucoup a qui veut brouiller la lecture d'un journal.
  if (url.username !== "" || url.password !== "") {
    return { ok: false, raison: "identifiants dans l'URL" };
  }

  const hote = url.hostname.replace(/^\[|\]$/g, "");

  // Une adresse litterale est jugee tout de suite, sans DNS.
  if (isIP(hote) !== 0) {
    return isBlockedAddress(hote)
      ? { ok: false, raison: `adresse non publique (${hote})` }
      : { ok: true, url };
  }

  // `localhost` et le domaine de test .localhost ne resolvent pas forcement en
  // 127.0.0.1 selon la configuration : on les ecarte par le nom, en plus du
  // controle d'adresse qui suivra.
  if (hote === "localhost" || hote.endsWith(".localhost") || hote.endsWith(".internal")) {
    return { ok: false, raison: `nom d'hote non public (${hote})` };
  }

  return { ok: true, url };
}

/** Controle complet : forme, puis TOUTES les adresses derriere le nom. */
export async function isPublicUrl(raw: string): Promise<UrlVerdict> {
  const verdict = inspectUrl(raw);
  if (!verdict.ok) return verdict;

  const hote = verdict.url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hote) !== 0) return verdict;

  let adresses: { address: string }[];
  try {
    // `all: true` EST INDISPENSABLE : un nom qui resout sur une adresse publique
    // ET une adresse privee passerait si l'on ne regardait que la premiere.
    adresses = await lookup(hote, { all: true });
  } catch {
    return { ok: false, raison: `nom introuvable (${hote})` };
  }

  if (adresses.length === 0) {
    return { ok: false, raison: `nom sans adresse (${hote})` };
  }

  const bloquee = adresses.find((entry) => isBlockedAddress(entry.address));
  return bloquee
    ? { ok: false, raison: `adresse non publique (${hote} -> ${bloquee.address})` }
    : verdict;
}

export type SafeFetchResult =
  | { ok: true; response: Response }
  | { ok: false; raison: string };

/**
 * `fetch` avec revalidation a CHAQUE saut.
 *
 * `redirect: "manual"` et non "follow" : c'est le coeur du correctif. Une URL
 * publique qui redirige vers http://10.0.0.5/ contournait entierement un
 * controle fait avant l'appel — et c'est le contournement le plus courant.
 */
export async function safeFetch(
  raw: string,
  init: { timeoutMs: number; accept?: string }
): Promise<SafeFetchResult> {
  let cible = raw;

  for (let saut = 0; saut <= MAX_REDIRECTS; saut += 1) {
    const verdict = await isPublicUrl(cible);
    if (!verdict.ok) return { ok: false, raison: verdict.raison };

    let response: Response;
    try {
      response = await fetch(verdict.url, {
        redirect: "manual",
        signal: AbortSignal.timeout(init.timeoutMs),
        headers: init.accept ? { accept: init.accept } : undefined,
      });
    } catch (cause) {
      return { ok: false, raison: cause instanceof Error ? cause.message : String(cause) };
    }

    if (response.status < 300 || response.status >= 400) {
      return { ok: true, response };
    }

    const suivante = response.headers.get("location");
    if (!suivante) {
      return { ok: false, raison: `redirection ${response.status} sans destination` };
    }

    // Une destination relative se resout contre l'URL courante, comme le ferait
    // le navigateur — et repasse par le meme controle au tour suivant.
    cible = new URL(suivante, verdict.url).toString();
  }

  return { ok: false, raison: `plus de ${MAX_REDIRECTS} redirections` };
}
