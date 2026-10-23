/**
 * L'en-tete `x-render-warnings` : ce qui l'ecrit, ce qui le relit.
 *
 * Un asset introuvable ne fait pas echouer un rendu — c'est un choix du
 * contrat, et le bon : perdre un picto ne doit pas perdre la fiche. Mais
 * l'appelant doit pouvoir le SAVOIR sans consulter la base du Studio, d'ou cet
 * en-tete, URL-encode, separateur " | ".
 *
 * POURQUOI CE MODULE EXISTE — un defaut constate, pas une precaution.
 *
 * Les trois routes de rendu ecrivaient
 * `encodeURIComponent(warnings.join(" | ")).slice(0, 900)`. La troncature
 * portait donc sur la chaine DEJA ENCODEE, et coupait une sequence `%XX` en
 * deux des que le 900e caractere tombait au mauvais endroit — ce qui arrive des
 * qu'un avertissement porte un accent ou une URL. `decodeURIComponent` leve
 * alors « URI malformed » sur l'en-tete ENTIER : l'appelant ne perd pas le
 * dernier avertissement, il les perd TOUS.
 *
 * Constate en rendant un export PrestaShop reel de 6763 lignes, dont les
 * produits portent plusieurs images distantes injoignables : le message
 * d'avertissement depasse alors largement 900 caracteres.
 *
 * La correction tient en une phrase : on tronque la SOURCE, jamais son encodage.
 * Et le decodeur reste tolerant, parce qu'un proxy peut abimer un en-tete que
 * nous aurons ecrit correctement.
 */

export const WARNING_SEPARATOR = " | ";

/**
 * 900 caracteres : les serveurs et proxies plafonnent couramment une ligne
 * d'en-tete a 4 ou 8 Kio, tous en-tetes confondus. La marge est large, et elle
 * doit le rester — un rendu ne doit jamais echouer parce qu'il avait trop de
 * choses a signaler.
 */
const MAX_HEADER = 900;

const ELLIPSIS = "...";

export function encodeWarningsHeader(
  warnings: readonly string[],
  max: number = MAX_HEADER
): string {
  const text = warnings.join(WARNING_SEPARATOR);
  const whole = encodeURIComponent(text);
  if (whole.length <= max) return whole;

  /*
   * Decoupe par POINT DE CODE et non par unite UTF-16 : couper entre les deux
   * moities d'une paire de substitution (un emoji dans un nom de fichier)
   * ferait lever encodeURIComponent lui-meme.
   */
  const points = [...text];
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (encodeURIComponent(points.slice(0, middle).join("") + ELLIPSIS).length <= max) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return encodeURIComponent(points.slice(0, low).join("") + ELLIPSIS);
}

/** Les en-tetes a poser sur la reponse — aucun quand il n'y a rien a dire. */
export function warningsHeaders(warnings: readonly string[]): Record<string, string> {
  return warnings.length === 0 ? {} : { "x-render-warnings": encodeWarningsHeader(warnings) };
}

export function decodeWarningsHeader(header: string | null): string[] {
  if (!header) return [];
  try {
    return decodeURIComponent(header)
      .split(WARNING_SEPARATOR)
      .filter((warning) => warning !== "");
  } catch {
    // L'en-tete a ete abime en route. Le rendre brut vaut mieux que de laisser
    // croire qu'il n'y avait rien a signaler.
    return [header];
  }
}
