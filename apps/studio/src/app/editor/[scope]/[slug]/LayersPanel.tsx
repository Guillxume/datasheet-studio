"use client";

import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { createUsePuck } from "@puckeditor/core";
import { cn } from "@guillxume/ui/lib/utils";
import {
  BadgeCheck,
  Box,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CodeXml,
  Columns2,
  Component,
  FileText,
  GripVertical,
  Group,
  Hash,
  Heading,
  Image,
  Images,
  LayoutGrid,
  LayoutList,
  Minus,
  Move,
  MoveVertical,
  Palette,
  PanelBottom,
  PanelTop,
  Pilcrow,
  QrCode,
  Ruler,
  SeparatorHorizontal,
  Sparkles,
  Square,
  Table,
  type LucideIcon,
} from "lucide-react";
import {
  ancestorsOf,
  blockCount,
  buildLayers,
  containerIds,
  planLayerMove,
  ROOT_ZONE,
  type LayerComponents,
  type LayerMove,
  type LayerNode,
} from "@/blocks/layers";
import { PAGE_BLOCK } from "@/lib/pages";

/**
 * Panneau Calques, a la place de l'Outline de Puck : le meme arbre, plus le
 * glisser-deposer et le deplacement au clavier.
 *
 * Monte par `overrides.outline` (EditorClient.tsx) : Puck lui passe son propre
 * arbre en `children`, qu'on ignore — il ne sait pas deplacer. Etant rendu DANS
 * `<Puck>`, ce composant a acces a `usePuck()`.
 *
 * Glisser-deposer NATIF (HTML5) et non dnd-kit : celui de Puck pilote le canvas,
 * et lui confier aussi ce panneau melangerait deux surfaces de depot qui n'ont
 * pas les memes regles. Le calcul de ce qui est permis, et de l'index a envoyer a
 * Puck, est tout entier dans src/blocks/layers.ts.
 */

/** Ou le bloc tire serait pose, et quelle ligne le signale. */
type DropTarget = { zone: string; index: number; marker: string; move: LayerMove };

type Ctx = {
  dragId: string | null;
  target: DropTarget | null;
  selectedId: string | null;
  collapsed: Set<string>;
  aim: (event: DragEvent, zone: string, index: number, marker: string) => void;
  drop: (event: DragEvent) => void;
  startDrag: (event: DragEvent, id: string) => void;
  endDrag: () => void;
  select: (node: LayerNode) => void;
  toggle: (id: string) => void;
  nudge: (node: LayerNode, delta: -1 | 1) => void;
};

/** Le bloc correspondant dans le canvas : Puck pose `data-puck-component="<id>"`. */
const canvasBlock = (id: string) =>
  document.querySelector<HTMLElement>(`[data-puck-component="${CSS.escape(id)}"]`);

/**
 * Une icone par type de bloc : dans une fiche faite de dix « Paragraphe » et de
 * colonnes imbriquees, c'est la forme qu'on repere avant de lire le libelle.
 * Un type absent de la table (bloc futur) prend la boite generique.
 */
const ICONS: Record<string, LucideIcon> = {
  Page: FileText,
  Columns: Columns2,
  Panel: Square,
  Group: Group,
  Positioned: Move,
  Spacer: MoveVertical,
  Divider: Minus,
  PageBreak: SeparatorHorizontal,
  Heading: Heading,
  Text: Pilcrow,
  RichText: CodeXml,
  Image: Image,
  FeatureTable: Table,
  ImageGallery: Images,
  SchemaImage: Ruler,
  BadgeRow: BadgeCheck,
  KeyValueGrid: LayoutList,
  QrCode: QrCode,
  SwatchGroups: Palette,
  HighlightRow: Sparkles,
  CardGrid: LayoutGrid,
  PageHeader: PanelTop,
  PageFooter: PanelBottom,
  PageNumber: Hash,
  Composant: Component,
};

/** Meme dessin que le `Kbd` du design system, qui ne connait pas les fleches. */
function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="border-border bg-muted text-muted-foreground shadow-border/50 inline-flex min-w-4 items-center justify-center rounded border px-1 py-px font-sans text-[10px] leading-none shadow-[0_1px_0_1px]">
      {children}
    </kbd>
  );
}

/**
 * Le trait qui dit ou le bloc va tomber : une ligne de la couleur d'accent, une
 * pastille a son depart. `inset` decale le trait sous le contenu d'un conteneur
 * deplie — c'est la que le bloc arrivera.
 */
function DropLine({ edge, inset = false }: { edge: "top" | "bottom"; inset?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-primary pointer-events-none absolute right-1 z-10 h-0.5 rounded-full",
        inset ? "left-9" : "left-5",
        edge === "top" ? "-top-px" : "-bottom-px"
      )}
    >
      <span className="border-primary bg-card absolute -top-[3px] -left-1 size-2 rounded-full border-2" />
    </span>
  );
}

/**
 * Lecture par selecteurs : le panneau ne se redessine que si le contenu, la
 * configuration ou la selection changent — pas a chaque survol du canvas.
 */
const usePuckStore = createUsePuck();

export default function LayersPanel({ zone }: { zone: string }) {
  const content = usePuckStore((s) => s.appState.data.content) as unknown[];
  const config = usePuckStore((s) => s.config);
  const dispatch = usePuckStore((s) => s.dispatch);
  const selectedId = usePuckStore(
    (s) => (s.selectedItem?.props as { id?: string } | undefined)?.id ?? null
  );
  const components = config.components as unknown as LayerComponents;

  const layers = useMemo(() => buildLayers(content, components), [content, components]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  /**
   * Un bloc selectionne DANS LE CANVAS doit apparaitre ici, meme s'il est range
   * dans un conteneur replie : ses ancetres se deplient. Ajustement d'etat pendant
   * le rendu, garde par la selection precedente — le motif que React recommande
   * plutot qu'un effet, qui dessinerait d'abord l'arbre replie.
   */
  const [shownSelection, setShownSelection] = useState<string | null>(null);
  if (selectedId !== shownSelection) {
    setShownSelection(selectedId);
    const hidden = selectedId ? ancestorsOf(layers, selectedId).filter((id) => collapsed.has(id)) : [];
    if (hidden.length > 0) {
      setCollapsed((current) => new Set([...current].filter((id) => !hidden.includes(id))));
    }
  }

  // Puis la ligne vient dans le champ du panneau.
  useEffect(() => {
    if (!selectedId) return;
    document
      .querySelector(`[data-layer-row="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Le corps ne porte que des pages a sa racine ; en-tete et pied n'en ont pas.
  const options = { pagesOnlyAtRoot: zone === "body" };

  const apply = (move: LayerMove) => {
    dispatch({ type: "move", ...move });
    // Puck selectionne par position : sans cela, la selection resterait sur la
    // place que le bloc vient de quitter — donc sur son voisin.
    dispatch({
      type: "setUi",
      ui: { itemSelector: { index: move.destinationIndex, zone: move.destinationZone } },
    });
  };

  const ctx: Ctx = {
    dragId,
    target,
    selectedId,
    collapsed,
    aim: (event, zoneId, index, marker) => {
      const move = dragId ? planLayerMove(layers, components, dragId, zoneId, index, options) : null;
      // Pas de preventDefault sur un depot interdit : le navigateur affiche alors
      // de lui-meme le curseur « interdit », et `drop` ne sera pas appele.
      if (!move) {
        if (target !== null) setTarget(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      if (target?.marker !== marker) setTarget({ zone: zoneId, index, marker, move });
    },
    drop: (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (target) apply(target.move);
      setDragId(null);
      setTarget(null);
    },
    startDrag: (event, id) => {
      event.dataTransfer.effectAllowed = "move";
      // Firefox n'entame pas de glisser sans donnee posee.
      event.dataTransfer.setData("text/plain", id);
      setDragId(id);
    },
    endDrag: () => {
      setDragId(null);
      setTarget(null);
    },
    select: (node) => {
      dispatch({ type: "setUi", ui: { itemSelector: { index: node.index, zone: node.zone } } });
      canvasBlock(node.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    toggle: (id) =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    nudge: (node, delta) => {
      // « Avant le precedent » pour monter, « avant le suivant du suivant » pour
      // descendre : la correction du retrait de Puck est faite par planLayerMove.
      const move = planLayerMove(
        layers,
        components,
        node.id,
        node.zone,
        delta < 0 ? node.index - 1 : node.index + 2,
        options
      );
      if (move && move.destinationIndex >= 0) apply(move);
    },
  };

  const total = blockCount(layers);

  return (
    <div className="text-foreground flex flex-col gap-3 p-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="m-0 text-sm font-semibold">Calques</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {total} bloc{total > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <ToolButton label="Tout déplier" onClick={() => setCollapsed(new Set())}>
            <ChevronsUpDown className="size-3.5" />
          </ToolButton>
          <ToolButton label="Tout replier" onClick={() => setCollapsed(new Set(containerIds(layers)))}>
            <ChevronsDownUp className="size-3.5" />
          </ToolButton>
        </div>
      </div>

      <ul role="tree" aria-label="Calques" className="m-0 flex list-none flex-col gap-2 p-0">
        <LayerItems nodes={layers} zone={ROOT_ZONE} ctx={ctx} />
      </ul>

      <div className="text-muted-foreground grid gap-1.5 border-t pt-3 text-[11px] leading-snug">
        <p className="m-0">Glisser une ligne pour déplacer le bloc.</p>
        <p className="m-0 flex items-center gap-1 whitespace-nowrap">
          <Key>Alt</Key>+<Key>↑</Key>
          <Key>↓</Key>
          <span className="ml-0.5">pour le monter ou le descendre.</span>
        </p>
      </div>
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-ring flex size-6 items-center justify-center rounded-md outline-none focus-visible:ring-2"
    >
      {children}
    </button>
  );
}

/**
 * Les lignes d'une zone. Le `<ul>` qui les porte est fourni par l'appelant :
 * c'est lui qui dessine le filet d'imbrication.
 */
function LayerItems({ nodes, zone, ctx }: { nodes: LayerNode[]; zone: string; ctx: Ctx }) {
  const endMarker = `end:${zone}`;
  let pageNo = 0;

  if (nodes.length === 0) {
    const aimed = ctx.target?.marker === endMarker;
    return (
      <li role="none" className="py-0.5">
        <div
          className={cn(
            "text-muted-foreground rounded-md border border-dashed px-2 py-1 text-[11px]",
            aimed && "border-primary bg-primary/5 text-primary"
          )}
          onDragOver={(event) => ctx.aim(event, zone, 0, endMarker)}
          onDrop={ctx.drop}
        >
          Vide — déposer un bloc ici
        </div>
      </li>
    );
  }

  return (
    <>
      {nodes.map((node) => (
        <LayerRow
          key={node.id}
          node={node}
          ctx={ctx}
          pageNo={node.type === PAGE_BLOCK && zone === ROOT_ZONE ? ++pageNo : null}
        />
      ))}
      {/*
        Fin de zone : sans elle, rien ne permettrait de poser un bloc APRES le
        dernier d'une zone quand celui-ci est un conteneur deplie — sa moitie
        basse vise son propre contenu. Elle ne prend de la place que pendant un
        glisser.
      */}
      {ctx.dragId ? (
        <li
          role="none"
          aria-hidden="true"
          className="relative h-2"
          onDragOver={(event) => ctx.aim(event, zone, nodes.length, endMarker)}
          onDrop={ctx.drop}
        >
          {ctx.target?.marker === endMarker ? <DropLine edge="top" /> : null}
        </li>
      ) : null}
    </>
  );
}

/** Les enfants d'un conteneur, sous un filet vertical aligne sur son chevron. */
function Branch({ children }: { children: ReactNode }) {
  return (
    <ul role="group" className="border-border m-0 ml-[9px] flex list-none flex-col border-l p-0 pl-1.5">
      {children}
    </ul>
  );
}

function LayerRow({ node, ctx, pageNo }: { node: LayerNode; ctx: Ctx; pageNo: number | null }) {
  const hasSlots = node.slots.length > 0;
  const open = hasSlots && !ctx.collapsed.has(node.id);
  const selected = ctx.selectedId === node.id;
  const dragged = ctx.dragId === node.id;
  const isPage = pageNo !== null;
  const label = isPage ? `Page ${pageNo}` : node.label;
  const Icon = ICONS[node.type] ?? Box;
  const inner = node.slots.reduce((count, slot) => count + slot.items.length, 0);

  const before = `before:${node.id}`;
  const after = `after:${node.id}`;
  const inside = `inside:${node.id}`;
  const marker = ctx.target?.marker;

  /**
   * Moitie haute : avant ce bloc. Moitie basse : apres lui — sauf s'il est un
   * conteneur deplie, auquel cas elle vise la premiere place de son contenu,
   * c'est-a-dire ce qui s'affiche juste en dessous. La ligne et le geste disent
   * alors la meme chose.
   */
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const upper = event.clientY < box.top + box.height / 2;
    if (upper) return ctx.aim(event, node.zone, node.index, before);
    if (open) return ctx.aim(event, node.slots[0].zone, 0, inside);
    return ctx.aim(event, node.zone, node.index + 1, after);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    ctx.nudge(node, event.key === "ArrowUp" ? -1 : 1);
  };

  return (
    <li role="treeitem" aria-selected={selected} aria-expanded={hasSlots ? open : undefined} className="m-0 p-0">
      <div
        data-layer-row={node.id}
        draggable
        onDragStart={(event) => ctx.startDrag(event, node.id)}
        onDragEnd={ctx.endDrag}
        onDragOver={onDragOver}
        onDrop={ctx.drop}
        onMouseEnter={() => canvasBlock(node.id)?.classList.add("ds-layer-hover")}
        onMouseLeave={() => canvasBlock(node.id)?.classList.remove("ds-layer-hover")}
        className={cn(
          "group relative flex cursor-grab items-center gap-1 rounded-md pr-1 active:cursor-grabbing",
          isPage ? "h-8" : "h-7",
          // Le focus clavier se voit sur la ligne entiere, pas sur le seul libelle.
          "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2",
          selected
            ? "bg-primary/10 before:bg-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full"
            : // Un voile de la couleur du texte et non --accent : dans le theme
              // du Studio, --accent est trop proche du fond du panneau pour
              // qu'on voie la ligne survolee.
              "hover:bg-foreground/[0.08]",
          dragged && "opacity-40"
        )}
      >
        {marker === before ? <DropLine edge="top" /> : null}
        {marker === after ? <DropLine edge="bottom" /> : null}
        {marker === inside ? <DropLine edge="bottom" inset /> : null}

        {hasSlots ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex size-5 shrink-0 items-center justify-center rounded"
            aria-label={open ? `Replier ${label}` : `Déplier ${label}`}
            onClick={() => ctx.toggle(node.id)}
          >
            <ChevronRight className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")} />
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-left outline-none"
          aria-current={selected ? "true" : undefined}
          title={node.hint ? `${label} — ${node.hint}` : label}
          onClick={() => ctx.select(node)}
          onKeyDown={onKeyDown}
        >
          <Icon
            aria-hidden="true"
            className={cn("size-3.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")}
          />
          <span className={cn("shrink-0", (isPage || selected) && "font-semibold", hasSlots && !isPage && "font-medium")}>
            {label}
          </span>
          {node.hint ? <span className="text-muted-foreground min-w-0 truncate text-xs">{node.hint}</span> : null}
          {/* Replie, un conteneur dit ce qu'il cache. */}
          {hasSlots && (isPage || !open) ? (
            <span className="text-muted-foreground ml-auto shrink-0 pl-1 text-[11px] tabular-nums">{inner}</span>
          ) : null}
        </button>

        <GripVertical
          aria-hidden="true"
          className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
        />
      </div>

      {open ? (
        <Branch>
          {node.slots.length === 1 ? (
            // Un seul slot (Page, Panneau, Groupe) : son contenu, directement.
            <LayerItems nodes={node.slots[0].items} zone={node.slots[0].zone} ctx={ctx} />
          ) : (
            // Les Colonnes nomment chacune des leurs.
            node.slots.map((slot) => {
              const slotMarker = `slot:${slot.zone}`;
              return (
                <li key={slot.zone} role="none" className="m-0 p-0">
                  <div
                    className={cn(
                      "text-muted-foreground relative flex h-6 items-center gap-1.5 rounded-md pl-1 text-[10px] font-semibold tracking-wider uppercase",
                      ctx.target?.marker === slotMarker && "bg-primary/5 text-primary"
                    )}
                    // Viser l'intitule d'une colonne : en fin de colonne.
                    onDragOver={(event) => ctx.aim(event, slot.zone, slot.items.length, slotMarker)}
                    onDrop={ctx.drop}
                  >
                    {slot.label}
                    <span className="font-normal tabular-nums">· {slot.items.length}</span>
                  </div>
                  {/* Sans second filet : l'intitule de la colonne suffit a la reperer,
                      et deux traits accoles alourdissaient l'arbre. */}
                  <ul role="group" className="m-0 flex list-none flex-col p-0">
                    <LayerItems nodes={slot.items} zone={slot.zone} ctx={ctx} />
                  </ul>
                </li>
              );
            })
          )}
        </Branch>
      ) : null}
    </li>
  );
}
