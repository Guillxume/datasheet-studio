/**
 * Mesure du canvas, en millimetres.
 *
 * La question posee a chaque composition est « est-ce que ca tient ? ». Y
 * repondre demandait jusqu'ici de rendre un PDF et de le faire defiler. Le canvas
 * portant desormais la geometrie reelle de la page (voir
 * src/blocks/canvasChrome.tsx) et la meme typographie que le document imprime
 * (voir PRINT_TYPOGRAPHY dans src/lib/html.ts), une mesure du DOM donne la
 * reponse en continu, sans aller-retour vers Chromium.
 *
 * CE QUE CETTE MESURE N'EST PAS. Une reimplementation de la pagination de
 * Chromium. Elle situe les sauts de page a partir de la hauteur utile d'une page,
 * ce qui est exact pour un flux de blocs, mais ne sait pas ou Chromium coupera un
 * bloc de l'interieur (une ligne de tableau, un paragraphe). L'apercu PDF reste
 * l'autorite ; la mesure sert a ne pas avoir a le demander a chaque frappe.
 */

export type SplitBlock = { label: string; page: number };

export type BodyMetrics = {
  kind: "body";
  /** Hauteur utile d'une page. */
  contentMm: number;
  /** Hauteur occupee par le flux du corps. */
  usedMm: number;
  pages: number;
  /** Remplissage de la derniere page, en pourcentage de la hauteur utile. */
  lastPageFill: number;
  /** Blocs traverses par un saut de page. */
  splits: SplitBlock[];
  /** Blocs marques « absent du PDF » : ils gonflent la mesure. */
  voids: number;
};

export type BandMetrics = {
  kind: "band";
  reservedMm: number;
  usedMm: number;
};

export type CanvasMetrics = BodyMetrics | BandMetrics | null;

/** Marge de tolerance, en mm, pour absorber les arrondis de sous-pixel. */
const EPSILON_MM = 0.4;

/**
 * Pixels par millimetre, MESURES et non deduits de 96/25,4.
 *
 * La sonde est un element de 100 mm de haut pose dans la surface de page : sa
 * hauteur reelle en pixels integre d'office un eventuel facteur de zoom applique
 * a la surface, ce qu'un ratio constant ne saurait pas faire.
 */
function pixelsPerMm(root: HTMLElement): number | null {
  const probe = root.querySelector<HTMLElement>("[data-mm-probe]");
  if (!probe) return null;

  const reference = Number(probe.dataset.mmProbe);
  const height = probe.getBoundingClientRect().height;
  if (!Number.isFinite(reference) || reference <= 0 || height <= 0) return null;

  return height / reference;
}

/**
 * Blocs de premier niveau du conteneur.
 *
 * Puck pose `data-puck-component` sur l'element racine de chaque bloc, sans
 * enveloppe supplementaire : un bloc imbrique dans une colonne porte donc le meme
 * attribut. On ne garde que ceux dont aucun ancetre n'est lui-meme un bloc — ce
 * sont eux qui composent le flux de la page.
 *
 * Les elements hors flux sont ecartes : un « Element positionne » est ancre dans
 * son conteneur, il ne participe ni a la hauteur du flux ni aux sauts de page.
 */
function flowBlocks(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-puck-component]")).filter(
    (element) => {
      const ancestor = element.parentElement?.closest("[data-puck-component]");
      if (ancestor && container.contains(ancestor)) return false;

      const position = getComputedStyle(element).position;
      return position !== "absolute" && position !== "fixed";
    }
  );
}

/**
 * Hauteur du flux : le bas du dernier bloc, et non la hauteur du conteneur.
 *
 * Le conteneur porte une hauteur minimale d'une page, ce qui ferait annoncer une
 * page pleine sur une fiche vide.
 *
 * Arrondi au dixieme de millimetre, ce qui est bien plus fin que ce qui est
 * affiche : le sous-pixel fait sinon varier la valeur a chaque mesure, et l'appelant,
 * qui compare le resultat au precedent pour ne pas rendre inutilement, rendrait
 * deux fois par seconde sans que rien n'ait bouge.
 */
function flowHeightMm(container: HTMLElement, blocks: HTMLElement[], perMm: number): number {
  const top = container.getBoundingClientRect().top;
  let bottom = 0;

  for (const block of blocks) {
    const box = block.getBoundingClientRect();
    // Un bloc replie sur rien (hauteur nulle) ne repousse pas le flux.
    if (box.height <= 0) continue;
    bottom = Math.max(bottom, box.bottom - top);
  }

  return Math.round((bottom / perMm) * 10) / 10;
}

export function measureCanvas(
  root: HTMLElement,
  labelOf: (id: string) => string
): CanvasMetrics {
  const perMm = pixelsPerMm(root);
  if (perMm === null) return null;

  const band = root.querySelector<HTMLElement>(".ds-marginbox-canvas");
  if (band) {
    return {
      kind: "band",
      reservedMm: Number(band.dataset.reservedMm) || 0,
      usedMm: flowHeightMm(band, flowBlocks(band), perMm),
    };
  }

  const content = root.querySelector<HTMLElement>(".ds-canvas-content");
  if (!content) return null;

  const contentMm = Number(content.dataset.contentMm) || 0;
  if (contentMm <= 0) return null;

  const blocks = flowBlocks(content);
  const usedMm = flowHeightMm(content, blocks, perMm);
  const pages = Math.max(1, Math.ceil((usedMm - EPSILON_MM) / contentMm));

  const top = content.getBoundingClientRect().top;
  const splits: SplitBlock[] = [];

  for (const block of blocks) {
    const box = block.getBoundingClientRect();
    if (box.height <= 0) continue;

    const startPage = Math.floor((box.top - top) / perMm / contentMm);
    const endPage = Math.floor(((box.bottom - top) / perMm - EPSILON_MM) / contentMm);

    if (endPage > startPage) {
      const id = block.getAttribute("data-puck-component") ?? "";
      splits.push({ label: labelOf(id), page: startPage + 1 });
    }
  }

  return {
    kind: "body",
    contentMm,
    usedMm,
    pages,
    lastPageFill: Math.min(
      100,
      Math.round(((usedMm - (pages - 1) * contentMm) / contentMm) * 100)
    ),
    splits,
    voids: content.querySelectorAll("[data-ds-void]").length,
  };
}
