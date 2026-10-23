import { COMPONENT_BLOCK } from "./components";

/**
 * Appliquer un composant a l'en-tete ou au pied de plusieurs templates — la
 * partie pure.
 *
 * Retour utilisateur : « on a cree des en-tetes et pieds sans composant, on
 * aimerait pouvoir tout remplacer facilement ». Ouvrir chaque template, vider sa
 * zone et y poser le bloc Composant est exactement le travail repetitif que les
 * composants devaient eviter.
 *
 * La zone choisie est REMPLACEE par un unique bloc « Composant » qui cite le
 * composant. Le changement part en BROUILLON ; la publication est une option, et
 * elle se refuse la ou elle publierait autre chose que ce changement — voir
 * publishDecision.
 */

export type ZoneName = "header" | "footer";

export type ZoneSummary = {
  /** Nombre de blocs a la racine de la zone. */
  blocks: number;
  /** La zone ne contient que ce composant : rien a faire. */
  alreadyApplied: boolean;
};

type Node = { type?: unknown; props?: { component?: unknown } };

export function summarizeZone(tree: unknown, componentSlug: string): ZoneSummary {
  const content = (tree as { content?: unknown } | null | undefined)?.content;
  const nodes = Array.isArray(content) ? (content as Node[]) : [];
  return {
    blocks: nodes.length,
    alreadyApplied:
      nodes.length === 1 &&
      nodes[0]?.type === COMPONENT_BLOCK &&
      nodes[0]?.props?.component === componentSlug,
  };
}

/** L'arbre d'une zone qui ne contient que le composant. */
export function zoneCitingComponent(componentSlug: string, blockId: string) {
  return {
    root: { props: {} },
    content: [{ type: COMPONENT_BLOCK, props: { id: blockId, component: componentSlug } }],
    zones: {},
  };
}

/**
 * Un template peut-il citer ce composant ?
 *
 * Un composant de bibliotheque : tous les templates. Un composant de boutique :
 * les seuls templates de cette boutique — c'est la regle de l'editeur (un
 * template de bibliotheque ne propose que les composants de bibliotheque), sans
 * quoi les autres boutiques imprimeraient une zone vide.
 */
export function canTarget(componentShopId: string | null, templateShopId: string | null): boolean {
  return componentShopId === null || componentShopId === templateShopId;
}

export type PublishDecision =
  /** Publication non demandee. */
  | "draft"
  /** Le template etait a jour : publier ne livre que ce changement. */
  | "publish"
  /** Un brouillon attendait deja : le publier livrerait aussi ses modifications. */
  | "pending-draft"
  /** Jamais publie : le publier le mettrait en ligne pour la premiere fois. */
  | "never-published";

/**
 * Peut-on publier ce template dans la foulee ?
 *
 * DECIDE AVANT L'ENREGISTREMENT : celui-ci cree justement un brouillon. Les deux
 * refus protegent la meme chose — ne livrer en production que ce que la personne
 * a demande. Les templates Acme sont partages entre recette et production :
 * publier y touche la production dans la seconde.
 */
export function publishDecision(
  requested: boolean,
  versions: { publishedVersion: number | null; draftVersion: number }
): PublishDecision {
  if (!requested) return "draft";
  if (versions.publishedVersion === null) return "never-published";
  if (versions.draftVersion !== versions.publishedVersion) return "pending-draft";
  return "publish";
}
