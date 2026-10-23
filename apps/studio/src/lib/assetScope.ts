import { STUDIO_ASSET } from "./cssAssets";

/**
 * Portee des assets lisibles par un rendu.
 *
 * MODULE SEPARE, et pour une raison que le premier jet a rendue visible : cette
 * decision est de la logique pure, mais elle vivait dans render.tsx, qui importe
 * assetStore -> db -> env. Le test unitaire exigeait donc une base de donnees
 * pour verifier une comparaison de chaines. Une regle d'isolation qu'on ne peut
 * pas tester sans infrastructure est une regle qu'on finira par ne plus tester.
 */

/**
 * Portee speciale : aucune restriction sur les assets lisibles.
 *
 * Reservee a l'apercu de l'editeur, ou la personne est deja authentifiee par le
 * proxy et edite precisement ce template. Toute autre valeur est un slug de
 * boutique, et restreint la lecture.
 */
export const RENDER_SCOPE_ANY = "*";

/**
 * Separe les references d'assets lisibles pour CE rendu de celles qui
 * appartiennent a une autre boutique.
 *
 * POURQUOI CETTE FONCTION EXISTE.
 *
 * La portee d'un asset vit dans son URL : `/assets/<portee>/<cle>`. Cette URL
 * est ecrite dans le TEMPLATE, alors que la boutique qui demande le rendu est
 * connue seulement de la requete. Rien ne rapprochait les deux : un template de
 * bibliotheque referencant `/assets/contoso-equipment/logo.png` faisait sortir
 * le logo d'contoso-equipment sur les fiches de TOUS les sites du parc, en
 * silence — aucune erreur, aucun avertissement, un PDF parfaitement valide avec
 * la mauvaise marque dessus.
 *
 * La regle appliquee ici est la plus etroite qui n'empeche aucun usage legitime :
 * un rendu ne peut lire que la BIBLIOTHEQUE COMMUNE et SA PROPRE boutique. Elle
 * ne restreint rien de ce que le modele prevoit, puisque l'identite visuelle
 * d'un site (logo, couleurs, coordonnees) arrive en DONNEE dans le payload et
 * non par la bibliotheque du Studio — voir le commentaire de la table
 * `templates` dans db/migrations/001_init.sql.
 *
 * Une reference refusee est traitee comme une reference introuvable : elle
 * devient une chaine vide et le bloc s'efface, plutot que de faire echouer une
 * fiche entiere. Elle est en revanche signalee separement, parce que les deux
 * causes n'appellent pas la meme correction — un asset absent se televerse, un
 * asset etranger se retire du template.
 */
export function partitionAssetRefs(
  refs: Iterable<string>,
  shopScope: string
): { readable: string[]; foreign: string[] } {
  const readable: string[] = [];
  const foreign: string[] = [];

  for (const ref of refs) {
    const match = ref.match(STUDIO_ASSET);
    if (!match) continue;

    const scope = decodeURIComponent(match[1]);
    // `shared` est la bibliotheque commune : lisible par tout le monde, c'est
    // sa raison d'etre.
    if (shopScope === RENDER_SCOPE_ANY || scope === "shared" || scope === shopScope) {
      readable.push(ref);
    } else {
      foreign.push(ref);
    }
  }

  return { readable, foreign };
}
