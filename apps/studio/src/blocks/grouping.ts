import { COMPONENT_BLOCK } from "@/lib/components";
import { PAGE_BLOCK } from "@/lib/pages";

/**
 * Grouper, degrouper, transformer en composant — la partie pure.
 *
 * Retour utilisateur : « grouper des elements pour faciliter leur deplacement »,
 * et « creer un composant depuis le template plutot que de faire le travail deux
 * fois ». Puck n'a pas de selection multiple : on groupe donc de proche en
 * proche — « Grouper avec le suivant », a repeter, chaque clic ajoutant le bloc
 * suivant au groupe.
 *
 * Ces fonctions prennent l'arbre de donnees de Puck et en rendent un NOUVEAU
 * (jamais de mutation : Puck compare les references). Les zones sont designees
 * comme chez Puck : « root:default-zone » pour la racine, « <id>:<slot> » pour
 * un slot. Le pont avec Puck (BlockActionBar.tsx) se contente d'appliquer.
 */

export const GROUP_BLOCK = "Group";
export const ROOT_ZONE = "root:default-zone";

export type TreeNode = { type: string; props: Record<string, unknown> & { id: string } };
type Tree = { content?: unknown[]; root?: unknown; zones?: unknown };

const isNode = (value: unknown): value is TreeNode =>
  value !== null &&
  typeof value === "object" &&
  typeof (value as { type?: unknown }).type === "string" &&
  typeof (value as { props?: { id?: unknown } }).props?.id === "string";

/** Les blocs d'une zone, ou `null` si la zone n'existe pas dans cet arbre. */
export function zoneItems(tree: Tree, zone: string): TreeNode[] | null {
  if (zone === ROOT_ZONE) return (tree.content ?? []).filter(isNode);

  const [ownerId, slot] = zone.split(":");
  let found: TreeNode[] | null = null;
  const walk = (nodes: unknown[]): void => {
    for (const node of nodes) {
      if (found || !isNode(node)) continue;
      if (node.props.id === ownerId) {
        const value = node.props[slot];
        found = Array.isArray(value) ? value.filter(isNode) : null;
        return;
      }
      for (const value of Object.values(node.props)) if (Array.isArray(value)) walk(value);
    }
  };
  walk(tree.content ?? []);
  return found;
}

/** Une copie de l'arbre ou la zone `zone` est remplacee par `next(items)`. */
function updateZone<T extends Tree>(tree: T, zone: string, next: (items: TreeNode[]) => TreeNode[]): T {
  if (zone === ROOT_ZONE) return { ...tree, content: next((tree.content ?? []).filter(isNode)) };

  const [ownerId, slot] = zone.split(":");
  const walk = (nodes: unknown[]): unknown[] =>
    nodes.map((node) => {
      if (!isNode(node)) return node;
      if (node.props.id === ownerId) {
        const value = Array.isArray(node.props[slot]) ? (node.props[slot] as unknown[]).filter(isNode) : [];
        return { ...node, props: { ...node.props, [slot]: next(value) } };
      }
      let changed = false;
      const props: Record<string, unknown> = { ...node.props };
      for (const [key, value] of Object.entries(node.props)) {
        if (!Array.isArray(value)) continue;
        const walked = walk(value);
        if (walked.some((item, index) => item !== value[index])) {
          props[key] = walked;
          changed = true;
        }
      }
      return changed ? { ...node, props: props as TreeNode["props"] } : node;
    });
  return { ...tree, content: walk(tree.content ?? []) };
}

/**
 * « Grouper avec le suivant » est-il possible ? Il faut un bloc suivant dans la
 * meme zone, et que ni l'un ni l'autre ne soit une Page — les pages ne vivent
 * qu'a la racine du corps.
 */
export function canGroupWithNext(tree: Tree, zone: string, index: number): boolean {
  const items = zoneItems(tree, zone);
  const current = items?.[index];
  const next = items?.[index + 1];
  return Boolean(current && next && current.type !== PAGE_BLOCK && next.type !== PAGE_BLOCK);
}

/**
 * Le bloc et son suivant, reunis dans un Groupe qui prend leur place. Si le bloc
 * EST deja un Groupe, le suivant le rejoint, en dernier : c'est ce qui permet
 * d'etendre un groupe clic apres clic. Le groupe reste a `index`.
 */
export function groupWithNext<T extends Tree>(
  tree: T,
  zone: string,
  index: number,
  newGroupId: string
): T {
  if (!canGroupWithNext(tree, zone, index)) return tree;

  return updateZone(tree, zone, (items) => {
    const current = items[index];
    const next = items[index + 1];
    const group: TreeNode =
      current.type === GROUP_BLOCK
        ? {
            ...current,
            props: {
              ...current.props,
              content: [...(Array.isArray(current.props.content) ? current.props.content : []), next],
            },
          }
        : {
            type: GROUP_BLOCK,
            // Sans espacement propre : le groupe reprend celui de la zone.
            props: { id: newGroupId, avoidBreak: false, content: [current, next] },
          };
    return [...items.slice(0, index), group, ...items.slice(index + 2)];
  });
}

/** Le Groupe remplace par ses blocs, a sa place et dans son ordre. */
export function ungroup<T extends Tree>(tree: T, zone: string, index: number): T {
  const group = zoneItems(tree, zone)?.[index];
  if (!group || group.type !== GROUP_BLOCK) return tree;
  const children = Array.isArray(group.props.content) ? group.props.content.filter(isNode) : [];
  return updateZone(tree, zone, (items) => [...items.slice(0, index), ...children, ...items.slice(index + 1)]);
}

/**
 * Ce que devient le composant cree depuis un bloc : les blocs d'un Groupe (le
 * groupe n'etait que l'enveloppe de la selection), le bloc lui-meme sinon.
 *
 * Refuse — `null` — une Page (on prend son contenu en la vidant dans un Groupe
 * d'abord) et un bloc Composant : pas de composant dans un composant, et le
 * depliage les retirerait de toute facon (src/lib/components.ts).
 */
export function componentContentFrom(node: TreeNode): TreeNode[] | null {
  if (node.type === PAGE_BLOCK || node.type === COMPONENT_BLOCK) return null;
  const content =
    node.type === GROUP_BLOCK
      ? (Array.isArray(node.props.content) ? node.props.content : []).filter(isNode)
      : [node];
  const hasNested = JSON.stringify(content).includes(`"type":"${COMPONENT_BLOCK}"`);
  return content.length === 0 || hasNested ? null : content;
}

/**
 * Le corps a enregistrer pour le nouveau composant : une page, comme tout corps
 * dans l'editeur (src/lib/pages.ts) — c'est ce que l'editeur du composant
 * ouvrira, et ce que componentContent() deplie.
 */
export function componentBody(content: TreeNode[], pageId: string): Tree {
  return {
    root: { props: {} },
    content: [{ type: PAGE_BLOCK, props: { id: pageId, mode: "always", onlyIf: "", content } }],
    zones: {},
  };
}

/** Le bloc remplace, a sa place, par le bloc « Composant » qui cite `slug`. */
export function replaceWithComponent<T extends Tree>(
  tree: T,
  zone: string,
  index: number,
  slug: string,
  newId: string
): T {
  return updateZone(tree, zone, (items) =>
    items[index]
      ? [
          ...items.slice(0, index),
          { type: COMPONENT_BLOCK, props: { id: newId, component: slug } },
          ...items.slice(index + 1),
        ]
      : items
  );
}

/** Un slug valide pour createTemplate() a partir d'un nom affiche : « Pied de page Acme » -> « pied-de-page-acme ». */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/, "");
}
