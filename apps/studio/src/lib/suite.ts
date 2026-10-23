/**
 * Destination apres connexion : le parametre `suite`, pose par le portail
 * (src/proxy.ts) et par requirePage (src/lib/guard.ts).
 *
 * VALIDEE ET NON SEULEMENT TRANSMISE : un parametre de requete est fourni par
 * qui forge le lien. Une destination hors du Studio fait de la page de
 * connexion un relais d'hameconnage — on se connecte sur le vrai Studio, et l'on
 * atterrit sur une copie qui redemande le mot de passe.
 *
 * PAR LE PARSEUR D'URL ET NON PAR UN PREFIXE. La premiere version refusait
 * `//` en tete et acceptait le reste ; `/\evil.example` passait, et le
 * navigateur — qui lit `\` comme `/` dans une URL http — partait sur
 * evil.example (audit du 16/10/2026). Tabulations et retours a la ligne, que le
 * navigateur supprime, donnaient le meme resultat. Plutot que d'enumerer les
 * ecritures, on resout la valeur comme le ferait le navigateur, et l'on exige
 * que l'origine n'ait pas change.
 */
const ORIGINE = "http://studio.invalid";

export function safeSuite(raw: string | undefined | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(raw, ORIGINE);
  } catch {
    return "/";
  }
  if (url.origin !== ORIGINE) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
