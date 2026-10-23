/**
 * Lecture du nombre de pages d'un PDF.
 *
 * Le nombre de pages est LE chiffre qui manquait a l'apercu. « Le template
 * tient-il en une page ? » est la question posee a chaque composition, et la
 * reponse etait jusqu'ici « ouvrir le PDF et faire defiler ». Sur un parc de plus
 * de mille fiches, c'est aussi le seul indicateur qui dise si un profil de
 * donnees hostile fait basculer la fiche sur une deuxieme page.
 *
 * On ne depend pas d'une bibliotheque de parsing : la structure ecrite par le
 * Chromium de Gotenberg est un PDF 1.4 sans flux d'objets, ou l'arbre de pages est
 * en clair. Verifie par mesure sur un rendu a quatre pages : un unique
 * « /Count 4 » et quatre objets « /Type /Page ».
 */

/** Objet de l'arbre de pages : c'est lui qui porte le total. */
const PAGE_TREE_COUNT = /\/Type\s*\/Pages\b[\s\S]{0,400}?\/Count\s+(\d+)|\/Count\s+(\d+)[\s\S]{0,400}?\/Type\s*\/Pages\b/g;

/** Repli : compter les objets page eux-memes, sans confondre avec `/Pages`. */
const PAGE_OBJECT = /\/Type\s*\/Page(?!s)/g;

/**
 * @returns le nombre de pages, ou null si la structure n'a pas pu etre lue.
 *
 * null plutot que 0 ou 1 : un appelant doit pouvoir distinguer « une page » de
 * « je n'ai pas su lire », et afficher un chiffre faux serait pire que de n'en
 * afficher aucun.
 */
export function pdfPageCount(pdf: Buffer | Uint8Array): number | null {
  // latin1 : chaque octet devient un caractere, sans tentative de decodage UTF-8
  // qui corromprait les flux binaires et pourrait avaler un marqueur.
  const text = Buffer.from(pdf).toString("latin1");

  let best = 0;
  for (const match of text.matchAll(PAGE_TREE_COUNT)) {
    const value = Number(match[1] ?? match[2]);
    // Un arbre de pages imbrique porte des totaux partiels : la racine, donc le
    // total, est le plus grand.
    if (Number.isFinite(value) && value > best) {
      best = value;
    }
  }
  if (best > 0) return best;

  const objects = text.match(PAGE_OBJECT);
  return objects && objects.length > 0 ? objects.length : null;
}
