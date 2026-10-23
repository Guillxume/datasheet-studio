/**
 * Pages explicites du corps d'une fiche.
 *
 * CE QUI CHANGE, ET POURQUOI. Jusqu'ici le corps etait UN flux continu que
 * Chromium paginait tout seul ; les « pages » n'existaient nulle part dans le
 * modele. Composer une deuxieme page revenait a poser un saut et a esperer que
 * ce qui suivait tombe au bon endroit — impossible a regler dans le studio,
 * puisque la surface de la page suivante n'apparaissait qu'une fois remplie.
 *
 * Desormais le corps est une LISTE DE BLOCS `Page`. Chaque page est une surface
 * editable, avec sa propre condition d'impression, et l'ordre des pages est
 * l'ordre des blocs. La coupure physique est posee par la feuille d'impression
 * (`.ds-page + .ds-page`), pas par un bloc invisible : une page conditionnelle
 * qui ne s'imprime pas ne laisse donc aucune coupure derriere elle.
 *
 * COMPATIBILITE. Un modele enregistre avant ce changement porte ses blocs
 * directement a la racine du corps. Le chemin PDF les rend exactement comme
 * avant — sans bloc `Page`, la regle de coupure ne s'applique a rien. Seul le
 * STUDIO a besoin de pages explicites pour dessiner des surfaces : la conversion
 * a donc lieu a l'ouverture de l'editeur, et se fixe au premier enregistrement.
 * Aucune migration de base n'est requise pour que les modeles existants
 * continuent de sortir a l'identique.
 *
 * Module sans dependance : il est lu par l'editeur (navigateur) comme par le
 * chemin de rendu (serveur).
 */

export const PAGE_BLOCK = "Page";

/** Identifiant du bloc cree par la conversion. Deterministe, donc testable. */
export const CONVERTED_PAGE_ID = "Page-page-1";

type Noeud = { type?: unknown; props?: Record<string, unknown> };

type ArbreCorps = {
  root?: { props?: Record<string, unknown> };
  content?: unknown[];
  zones?: Record<string, unknown>;
};

const estNoeud = (valeur: unknown): valeur is Noeud =>
  typeof valeur === "object" && valeur !== null;

/** Les blocs du corps sont-ils DEJA des pages ? */
export function bodyHasPages(tree: unknown): boolean {
  const content = (tree as ArbreCorps | undefined)?.content;
  if (!Array.isArray(content) || content.length === 0) return false;
  return content.every((noeud) => estNoeud(noeud) && noeud.type === PAGE_BLOCK);
}

/**
 * Rend le corps editable en pages, sans jamais perdre de contenu.
 *
 * Trois cas, et un seul produit une conversion :
 *   - deja des pages          -> rendu tel quel (identite, pas de copie) ;
 *   - corps vide              -> une page vide, pour qu'il y ait ou deposer ;
 *   - blocs libres            -> une page dont le contenu est ces blocs.
 *
 * Un corps MIXTE (des pages ET des blocs libres) ne peut pas etre produit par
 * l'editeur — la zone racine n'accepte que des pages — mais il peut arriver d'un
 * modele bricole a la main. Il est traite comme des blocs libres : tout est
 * range dans une page unique, ce qui est reversible a la main et ne perd rien.
 * L'alternative (ignorer les blocs libres) les ferait disparaitre en silence.
 */
export function normalizeBodyTree<T>(tree: T): T {
  const arbre = (tree ?? {}) as ArbreCorps;
  if (bodyHasPages(arbre)) return tree;

  const contenu = Array.isArray(arbre.content) ? arbre.content : [];

  return {
    ...arbre,
    content: [
      {
        type: PAGE_BLOCK,
        props: {
          id: CONVERTED_PAGE_ID,
          content: contenu,
          mode: "always",
          onlyIf: "",
        },
      },
    ],
  } as unknown as T;
}

/**
 * Une page s'imprime-t-elle pour ce produit ?
 *
 * `onlyIf` arrive DEJA resolu au bloc : la valeur du produit, pas le token. Un
 * champ laisse vide et un token qui se resout en vide sont donc la meme chaine,
 * d'ou le mode en champ separe — sans lui, une page conditionnelle dont le champ
 * n'est pas encore renseigne disparaitrait au lieu de s'imprimer.
 *
 * Les blancs ne valent pas du contenu : une description faite d'espaces, de
 * retours a la ligne ou d'espaces insecables ne doit pas couter une page.
 */
export function pageWillPrint(mode: unknown, onlyIf: unknown): boolean {
  if (mode !== "ifFilled") return true;
  return typeof onlyIf === "string" && onlyIf.trim() !== "";
}
