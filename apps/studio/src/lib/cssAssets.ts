/**
 * References a la bibliotheque du Studio DANS UNE FEUILLE DE STYLE.
 *
 * Module a part, et sans aucune dependance — meme raison que printCss.ts : la
 * logique est testable seule, alors que src/lib/render.tsx entraine src/lib/db.ts
 * par sa chaine de dependances et exige donc une base pour etre importe.
 *
 * POURQUOI CE CODE EXISTE. La feuille du template (`trees.css`, editee dans le
 * Studio) etait injectee telle quelle dans le document : ses `url(/assets/...)`
 * n'etaient ni collectees ni reecrites, contrairement a celles des props. Or le
 * Chromium de Gotenberg n'a aucune route reseau vers cette application — l'URL ne
 * resolvait donc rien, silencieusement.
 *
 * Consequence concrete, et c'est la raison de ce correctif : un `@font-face`
 * ecrit dans la feuille du template ne pouvait PAS charger sa police. Toute fiche
 * retombait sur la valeur de repli du `font-family` de printCss.ts, c'est-a-dire
 * Arial, sans qu'aucun message ne signale l'echec. La typographie d'un document
 * imprime n'etait atteignable par aucun chemin.
 */

/** Forme d'une reference de bibliotheque : /assets/<scope>/<cle>. */
export const STUDIO_ASSET = /^\/assets\/([^/]+)\/([^/?#]+)$/;

/**
 * `url(...)` pointant vers la bibliotheque.
 *
 * Les guillemets sont optionnels en CSS : la backreference \1 accepte les trois
 * formes — url(/assets/x), url('/assets/x') et url("/assets/x") — tout en
 * interdisant les paires depareillees.
 */
const CSS_ASSET_URL = /url\(\s*(['"]?)(\/assets\/[^)'"\s]+)\1\s*\)/g;

/** Collecte les references de bibliotheque presentes dans une feuille de style. */
export function collectCssAssetRefs(css: string | null | undefined, found: Set<string>): void {
  if (!css) return;

  for (const match of css.matchAll(CSS_ASSET_URL)) {
    // Le filtre sur la FORME evite de demander a la base un chemin qui ne peut
    // etre un asset (/assets/x sans cle, /assets/a/b/c).
    if (STUDIO_ASSET.test(match[2])) {
      found.add(match[2]);
    }
  }
}

/**
 * Reecrit les references de bibliotheque en data URI dans une feuille de style.
 *
 * Un asset introuvable laisse la declaration INTACTE, la ou `inlineStudioAssets`
 * vide la valeur pour les props. Les deux comportements sont volontairement
 * differents : une prop vide fait disparaitre son bloc, ce qui est le bon
 * comportement pour une image manquante ; une `url()` videe produirait une
 * declaration invalide, susceptible d'invalider la regle entiere qui la contient
 * — donc, pour un @font-face a plusieurs sources, de casser les polices restantes
 * plutot que la seule qui manque. L'asset absent est de toute facon deja remonte
 * en avertissement par loadStudioAssets().
 */
export function inlineCssAssets(
  css: string | null | undefined,
  assets: Map<string, string>
): string | null {
  // Une seule representation de « pas de feuille » : null. Renvoyer "" pour une
  // entree vide et null pour une entree absente donnerait deux valeurs pour le
  // meme etat, que chaque appelant devrait ensuite penser a traiter ensemble.
  if (!css) return null;

  return css.replace(CSS_ASSET_URL, (whole, _quote: string, ref: string) => {
    const inlined = assets.get(ref);
    // Les guillemets doubles sont surs : une data URI en base64 n'en contient
    // jamais (alphabet A-Z a-z 0-9 + / =).
    return inlined ? `url("${inlined}")` : whole;
  });
}
