import { PAGE_BLOCK } from "@/lib/pages";

/**
 * Panneau Calques — la partie pure : l'arbre affiche et le deplacement a faire.
 *
 * POURQUOI UN PANNEAU A NOUS. Retour utilisateur : « pouvoir deplacer les
 * elements depuis les calques ». L'Outline de Puck ne sait que selectionner, pas
 * deplacer — ni en 0.22.4, ni en 0.23.0 (verifie dans le code livre). Le seul
 * chemin pour deplacer un bloc etait donc le canvas, ou un depot sous des
 * Colonnes en pleine hauteur, par exemple, n'a nulle part ou atterrir.
 *
 * Ce module ne connait ni React ni Puck : il lit l'arbre de donnees et rend des
 * selecteurs `{ zone, index }` au format de Puck. Le composant (LayersPanel.tsx)
 * ne fait qu'afficher et appliquer ce qui sort d'ici.
 */

/** Identifiant compose de la zone racine chez Puck — voir ROOT_ZONE dans previewConfig.tsx. */
export const ROOT_ZONE = "root:default-zone";

type AnyNode = { type?: unknown; props?: Record<string, unknown> };

type SlotField = { type?: string; label?: string; allow?: string[]; disallow?: string[] };

export type LayerComponents = Record<
  string,
  { label?: string; fields?: Record<string, SlotField | undefined> }
>;

export type LayerSlot = {
  /** Nom de la prop slot (`left`, `content`...). */
  name: string;
  label: string;
  /** Zone Puck du slot : `<id du conteneur>:<nom du slot>`. */
  zone: string;
  items: LayerNode[];
};

export type LayerNode = {
  id: string;
  type: string;
  label: string;
  /** Ce qui distingue ce bloc de ses voisins de meme type : texte, composant cite... */
  hint: string;
  zone: string;
  index: number;
  slots: LayerSlot[];
};

/** Libelles des slots : ceux du registry n'en portent pas. */
const SLOT_LABELS: Record<string, Record<string, string>> = {
  Columns: { left: "Colonne 1", right: "Colonne 2", third: "Colonne 3" },
};

const HINT_PROPS = ["text", "content", "heading", "component", "html"];

function hintOf(props: Record<string, unknown>): string {
  for (const key of HINT_PROPS) {
    const value = props[key];
    if (typeof value === "string" && value.trim() !== "") {
      // Le HTML d'un Texte riche se lit mal tel quel : on n'en garde que le texte.
      const plain = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      return plain.length > 40 ? `${plain.slice(0, 39)}…` : plain;
    }
  }
  return "";
}

function slotNames(type: string, components: LayerComponents): string[] {
  const fields = components[type]?.fields ?? {};
  return Object.entries(fields)
    .filter(([, field]) => field?.type === "slot")
    .map(([name]) => name);
}

/**
 * La troisieme colonne n'est dessinee que si la repartition en declare trois
 * (voir Columns dans registry.tsx). On ne l'offre donc pas comme destination —
 * un bloc depose la serait invisible — sauf si elle contient deja quelque chose,
 * qu'il faut bien pouvoir en sortir.
 */
function slotIsShown(type: string, name: string, props: Record<string, unknown>): boolean {
  if (type !== "Columns" || name !== "third") return true;
  const ratio = typeof props.ratio === "string" ? props.ratio : "1fr 1fr";
  const items = Array.isArray(props.third) ? props.third : [];
  return ratio.trim().split(/\s+/).length >= 3 || items.length > 0;
}

export function buildLayers(
  content: unknown[],
  components: LayerComponents,
  zone = ROOT_ZONE
): LayerNode[] {
  const nodes: LayerNode[] = [];

  content.forEach((raw, index) => {
    const node = raw as AnyNode;
    const type = typeof node?.type === "string" ? node.type : "";
    const props = node?.props ?? {};
    const id = typeof props.id === "string" ? props.id : "";
    if (!type || !id) return;

    const names = slotNames(type, components);
    const slots = names
      .filter((name) => slotIsShown(type, name, props))
      .map((name) => {
        const slotZone = `${id}:${name}`;
        return {
          name,
          label: SLOT_LABELS[type]?.[name] ?? "Contenu",
          zone: slotZone,
          items: buildLayers(Array.isArray(props[name]) ? (props[name] as unknown[]) : [], components, slotZone),
        };
      });

    nodes.push({
      id,
      type,
      label: components[type]?.label ?? type,
      hint: hintOf(props),
      zone,
      index,
      slots,
    });
  });

  return nodes;
}

/** Un bloc et tous ses descendants, a plat — pour retrouver ou il est, et ce qu'il contient. */
function flatten(nodes: LayerNode[], into: LayerNode[] = []): LayerNode[] {
  for (const node of nodes) {
    into.push(node);
    for (const slot of node.slots) flatten(slot.items, into);
  }
  return into;
}

export type LayerMove = {
  sourceZone: string;
  sourceIndex: number;
  destinationZone: string;
  destinationIndex: number;
};

/**
 * Le deplacement Puck qui pose `sourceId` a la position `index` de `zone` — index
 * compte dans la zone TELLE QU'ON LA VOIT, bloc deplace compris. `null` si le
 * depot est interdit ou ne change rien.
 *
 * Refuse :
 *   - un conteneur dans lui-meme ou dans un de ses descendants (Puck ne le
 *     refuse pas : le bloc disparaitrait avec la branche qui le porte) ;
 *   - une Page ailleurs qu'a la racine, et autre chose qu'une Page a la racine du
 *     corps (`pagesOnlyAtRoot`) — voir strayRootBlockMove ;
 *   - ce que le slot interdit dans le registry (`allow` / `disallow`).
 *
 * PUCK RETIRE PUIS INSERE dans une meme zone (reducer `move`) : descendre un bloc
 * de la position 1 « avant le 4e » revient a l'inserer en 3, une fois retire. La
 * correction est faite ici, et nulle part ailleurs.
 */
export function planLayerMove(
  layers: LayerNode[],
  components: LayerComponents,
  sourceId: string,
  zone: string,
  index: number,
  options: { pagesOnlyAtRoot: boolean }
): LayerMove | null {
  const all = flatten(layers);
  const source = all.find((node) => node.id === sourceId);
  if (!source) return null;

  // Le bloc ne peut pas entrer dans sa propre branche.
  const [zoneOwner, slotName] = zone.split(":");
  if (zone !== ROOT_ZONE && flatten([source]).some((node) => node.id === zoneOwner)) return null;

  const atRoot = zone === ROOT_ZONE;
  if (source.type === PAGE_BLOCK && !atRoot) return null;
  if (options.pagesOnlyAtRoot && atRoot && source.type !== PAGE_BLOCK) return null;

  if (!atRoot) {
    const owner = all.find((node) => node.id === zoneOwner);
    const field = owner ? components[owner.type]?.fields?.[slotName] : undefined;
    if (field?.disallow?.includes(source.type)) return null;
    if (field?.allow && !field.allow.includes(source.type)) return null;
  }

  const destinationIndex = source.zone === zone && source.index < index ? index - 1 : index;
  if (source.zone === zone && source.index === destinationIndex) return null;

  return {
    sourceZone: source.zone,
    sourceIndex: source.index,
    destinationZone: zone,
    destinationIndex,
  };
}

/**
 * Les conteneurs qui menent a `id`, du plus haut au plus proche — ceux qu'il faut
 * deplier pour que le bloc soit visible dans le panneau. Vide si `id` est a la
 * racine ou introuvable.
 */
export function ancestorsOf(layers: LayerNode[], id: string): string[] {
  const walk = (nodes: LayerNode[], path: string[]): string[] | null => {
    for (const node of nodes) {
      if (node.id === id) return path;
      for (const slot of node.slots) {
        const found = walk(slot.items, [...path, node.id]);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(layers, []) ?? [];
}

/** Tous les conteneurs (blocs a slots) : ce que « Tout replier » replie. */
export function containerIds(layers: LayerNode[]): string[] {
  return flatten(layers)
    .filter((node) => node.slots.length > 0)
    .map((node) => node.id);
}

/** Nombre de blocs, conteneurs compris, pages exclues : ce qu'affiche l'en-tete. */
export function blockCount(layers: LayerNode[]): number {
  return flatten(layers).filter((node) => node.type !== PAGE_BLOCK).length;
}
