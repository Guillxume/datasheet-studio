/**
 * Composants reutilisables — la partie pure.
 *
 * Un composant est un fragment de template (un pied de page, un bandeau de
 * coordonnees) compose une fois et place dans plusieurs templates par le bloc
 * « Composant », qui ne porte que son slug. Le modifier puis le publier change
 * tous les templates qui l'utilisent.
 *
 * LE COMPOSANT EST DEPLIE AVANT LE RENDU : chaque bloc « Composant » est remplace
 * par le contenu publie du composant, et le moteur de rendu ne sait rien des
 * composants. C'est ce qui garde intact un rendu eprouve sur tout le parc —
 * expansion en amont, rendu inchange.
 *
 * PAS DE COMPOSANT DANS UN COMPOSANT : un bloc « Composant » trouve dans le
 * contenu d'un composant est retire au depliage. Sans cette regle, deux
 * composants qui se citent l'un l'autre deplieraient a l'infini ; et l'editeur
 * ne propose de toute facon pas le bloc quand on compose un composant.
 */

export const COMPONENT_BLOCK = "Composant";

export type Node = { type: string; props?: Record<string, unknown> };

function isNode(value: unknown): value is Node {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { type?: unknown }).type === "string" &&
    (value as { props?: unknown }).props !== null &&
    typeof (value as { props?: unknown }).props === "object"
  );
}

/** Un tableau de noeuds Puck : le contenu d'une zone, ou la valeur d'un slot. */
function isNodeArray(value: unknown): value is Node[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNode);
}

function slugOf(node: Node): string {
  const value = node.props?.component;
  return typeof value === "string" ? value.trim() : "";
}

/** Les slugs de composants cites, a n'importe quelle profondeur. */
export function componentSlugsIn(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => componentSlugsIn(item, found));
  } else if (value !== null && typeof value === "object") {
    if (isNode(value) && value.type === COMPONENT_BLOCK) {
      const slug = slugOf(value);
      if (slug) found.add(slug);
    }
    Object.values(value as Record<string, unknown>).forEach((item) => componentSlugsIn(item, found));
  }
  return found;
}

/**
 * Le contenu d'un composant, tel qu'on le place : ses blocs.
 *
 * L'editeur range tout corps dans des blocs « Page » (src/lib/pages.ts). Un
 * composant n'en est pas une : on prend les blocs que ses pages contiennent.
 */
export function componentContent(body: unknown): Node[] {
  const content = (body as { content?: unknown } | null | undefined)?.content;
  if (!Array.isArray(content)) return [];
  const nodes = content.filter(isNode);
  if (nodes.length > 0 && nodes.every((node) => node.type === "Page")) {
    return nodes.flatMap((page) => (Array.isArray(page.props?.content) ? page.props!.content.filter(isNode) : []));
  }
  return nodes;
}

/**
 * Copie profonde d'un contenu de composant pour UNE occurrence : identifiants
 * prefixes (un composant place deux fois ne doit pas produire deux blocs de meme
 * id), et blocs « Composant » imbriques retires.
 */
function instantiate(nodes: Node[], prefix: string): Node[] {
  const copy = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const items = isNodeArray(value) ? value.filter((node) => node.type !== COMPONENT_BLOCK) : value;
      return items.map(copy);
    }
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) out[key] = copy(inner);
      if (isNode(value) && typeof value.props?.id === "string") {
        (out.props as Record<string, unknown>).id = `${prefix}/${value.props.id}`;
      }
      return out;
    }
    return value;
  };
  return copy(nodes.filter((node) => node.type !== COMPONENT_BLOCK)) as Node[];
}

/**
 * Remplace chaque bloc « Composant » par le contenu que `resolve` donne pour son
 * slug. Un composant introuvable (supprime, jamais publie, d'une autre boutique)
 * disparait : la fiche sort sans lui plutot que d'echouer — l'editeur, lui, le
 * signale.
 *
 * Rend une COPIE : les arbres charges ne sont jamais modifies en place.
 */
export function expandComponents<T>(value: T, resolve: (slug: string) => Node[] | null): T {
  const walk = (current: unknown): unknown => {
    if (Array.isArray(current)) {
      if (isNodeArray(current)) {
        return current.flatMap((node) => {
          if (node.type !== COMPONENT_BLOCK) return [walk(node)];
          const content = resolve(slugOf(node));
          const prefix = typeof node.props?.id === "string" ? node.props.id : slugOf(node);
          return content ? instantiate(content, prefix) : [];
        });
      }
      return current.map(walk);
    }
    if (current !== null && typeof current === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(current as Record<string, unknown>)) out[key] = walk(inner);
      return out;
    }
    return current;
  };
  return walk(value) as T;
}
