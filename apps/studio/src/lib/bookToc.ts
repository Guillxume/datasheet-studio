import { escapeHtml } from "./book";

/**
 * Le sommaire du book : une ou plusieurs pages apres la premiere de couverture,
 * qui listent chaque section, chaque fiche et le devis avec leur page — et sur
 * lesquelles on CLIQUE pour y aller. Le PDF s'ouvre en plus avec ses signets.
 *
 * Module pur : les lignes, leurs numeros, la page HTML, et la retouche du PDF
 * fusionne decrite en JSON pour qpdf. L'execution de qpdf est dans
 * src/lib/qpdf.ts, l'assemblage dans src/app/api/book/route.ts.
 *
 * POURQUOI UNE RETOUCHE APRES FUSION. Un lien interne d'un PDF vise un OBJET
 * page du fichier ou il se trouve : il ne peut pas viser une page d'un autre
 * fichier, et le book est l'assemblage de fichiers separes. Le sommaire est donc
 * rendu par Chromium avec des liens vers une adresse temoin, une par page
 * (« https://sommaire.invalid/page/12 » : le domaine .invalid ne mene nulle
 * part, par norme), puis, une fois le book fusionne, chacun est reecrit en lien
 * interne vers le 12e objet page. Verifie le 21/10/2026 : la fusion de
 * Gotenberg JETTE ces liens ; celle de qpdf les garde.
 *
 * POURQUOI QPDF ET NON UNE BIBLIOTHEQUE JAVASCRIPT. Un book de deux cents fiches
 * Acme pese une centaine de megaoctets (455 ko par fiche en moyenne, mesure le
 * 21/10/2026). pdf-lib le chargerait tout entier en memoire, plusieurs fois, dans
 * un conteneur de 1,5 Go qui rend des fiches en meme temps ; qpdf travaille sur
 * le disque.
 */

export const TOC_LINK = "https://sommaire.invalid/page/";

/** Une section du book telle que la composition l'a ecrite, avec ce que chaque partie occupe. */
export type TocSection = {
  /** Le titre de l'intercalaire ; null pour les fiches « a la suite ». */
  title: string | null;
  /** 1 si la page d'intercalaire est imprimee, 0 sinon. */
  dividerPages: number;
  fiches: { title: string; pages: number }[];
};

/** Une ligne du sommaire. `offset` : sa premiere page, comptee depuis la fin du sommaire (0 = la page qui le suit). */
export type TocLine = { level: 0 | 1; title: string; offset: number; kind: "section" | "fiche" | "devis" };

/** Les fiches « a la suite » ont un titre des qu'une autre section en a un : sinon, la liste se lit d'un trait. */
export const UNTITLED_SECTION = "Autres produits";

/**
 * Les lignes du sommaire, dans l'ordre du book : chaque section (son titre, a
 * la page de son intercalaire, ou de sa premiere fiche s'il n'est pas imprime),
 * ses fiches, puis le devis. Sans aucun intercalaire, les fiches sont au premier
 * niveau. Les couvertures n'y figurent pas.
 */
export function tocLines(sections: TocSection[], hasQuote: boolean): TocLine[] {
  const titled = sections.some((section) => section.title !== null && section.fiches.length > 0);
  const lines: TocLine[] = [];
  let offset = 0;

  for (const section of sections) {
    if (section.fiches.length === 0) continue;
    if (titled) lines.push({ level: 0, title: section.title ?? UNTITLED_SECTION, offset, kind: "section" });
    offset += section.dividerPages;
    for (const fiche of section.fiches) {
      lines.push({ level: titled ? 1 : 0, title: fiche.title, offset, kind: "fiche" });
      offset += fiche.pages;
    }
  }
  if (hasQuote) lines.push({ level: 0, title: "Devis", offset, kind: "devis" });
  return lines;
}

/** Le numero de page de chaque ligne, une fois connu ce qui precede le corps du book. */
export function tocPage(line: TocLine, before: number): number {
  return before + line.offset + 1;
}

const COLOR = /^#[0-9a-f]{6}$/i;

/** Les marges des pages du sommaire, passees a Gotenberg : il ignore celles du CSS (preferCssPageSize). */
export const TOC_MARGINS = { top: 22, right: 20, bottom: 20, left: 20 };

/**
 * Les pages du sommaire. Chaque ligne est un lien vers l'adresse temoin de sa
 * page, que la retouche transforme en lien interne (tocPatch). `before` : les
 * pages qui precedent le corps du book — couverture et sommaire lui-meme.
 */
export function tocHtml(lines: TocLine[], before: number, color: string): string {
  const accent = COLOR.test(color) ? color : "#2e2b25";
  const rows = lines
    .map((line) => {
      const page = tocPage(line, before);
      return `<a class="ligne ${line.kind} n${line.level}" href="${TOC_LINK}${page}"><span class="titre">${escapeHtml(line.title)}</span><span class="points"></span><span class="page">${page}</span></a>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; }
body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #1f2933; font-size: 10.5pt;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 24pt; font-weight: 700; margin: 0 0 10mm; padding-bottom: 3mm; border-bottom: 0.8mm solid ${accent}; }
.ligne { display: flex; align-items: baseline; gap: 2mm; color: inherit; text-decoration: none; padding: 1.4mm 0;
  break-inside: avoid; }
.titre { flex: 0 1 auto; }
.points { flex: 1 1 auto; border-bottom: 0.3mm dotted #9aa5b1; min-width: 6mm; transform: translateY(-1mm); }
.page { flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.section, .devis { font-weight: 700; color: ${accent}; margin-top: 4mm; padding-top: 2mm; break-after: avoid; }
.section .points, .devis .points { border-bottom-color: ${accent}; opacity: 0.5; }
.n1 { padding-left: 5mm; }
</style></head><body><h1>Sommaire</h1>
${rows}
</body></html>`;
}

/* ---------------------------------------------------------- Retouche ---- */

/**
 * Ce qu'il faut du book fusionne pour le retoucher, lu par qpdf (src/lib/qpdf.ts)
 * dans son JSON v2 : les references y sont des chaines « 12 0 R », les noms
 * « /Dest », les textes « u:… ».
 */
export type TocPatchInput = {
  maxObjectId: number;
  /** Les objets page du book, dans l'ordre. */
  pages: string[];
  root: { ref: string; value: Record<string, unknown> };
  /** Les annotations des pages du sommaire, et leurs actions quand elles sont des objets a part. */
  annotations: { ref: string; value: Record<string, unknown> }[];
  actions?: Record<string, Record<string, unknown>>;
  /** Les signets : chaque ligne du sommaire, avec sa page. */
  outline: { title: string; page: number; level: 0 | 1 }[];
};

/** La page visee par un lien temoin, ou null si l'annotation n'en est pas un. */
export function tocLinkTarget(uri: unknown): number | null {
  if (typeof uri !== "string") return null;
  const value = uri.startsWith("u:") ? uri.slice(2) : uri;
  if (!value.startsWith(TOC_LINK)) return null;
  const page = Number(value.slice(TOC_LINK.length));
  return Number.isInteger(page) && page > 0 ? page : null;
}

/**
 * La retouche, au format de `qpdf --update-from-json` : chaque lien temoin
 * devient un lien interne vers son objet page, et le document recoit ses
 * signets — une entree par ligne du sommaire, les fiches sous leur section,
 * sections REPLIEES (quinze sections de treize fiches, depliees, font un
 * panneau qu'on ne lit plus). Le PDF s'ouvre panneau des signets visible.
 *
 * Un lien vers une page qui n'existe pas est laisse tel quel et compte dans
 * `broken` : la route le dit, plutot que de livrer un lien qui mene ailleurs.
 */
export function tocPatch(input: TocPatchInput): { patch: unknown; links: number; broken: number } {
  const objects: Record<string, { value: unknown }> = {};
  let links = 0;
  let broken = 0;

  for (const annotation of input.annotations) {
    const value = annotation.value;
    if (value["/Subtype"] !== "/Link") continue;
    const action =
      typeof value["/A"] === "string" ? input.actions?.[value["/A"] as string] : (value["/A"] as Record<string, unknown> | undefined);
    const target = tocLinkTarget(action?.["/URI"]);
    if (target === null) continue;
    const page = input.pages[target - 1];
    if (!page) {
      broken++;
      continue;
    }
    const rewritten: Record<string, unknown> = { ...value, "/Dest": [page, "/Fit"] };
    delete rewritten["/A"];
    objects[`obj:${annotation.ref}`] = { value: rewritten };
    links++;
  }

  // Les signets : de nouveaux objets, numerotes apres le dernier du fichier.
  let next = input.maxObjectId;
  const ref = () => `${++next} 0 R`;
  const outlineRef = ref();
  type Node = { ref: string; title: string; page: string; children: Node[] };
  const top: Node[] = [];
  for (const item of input.outline) {
    const page = input.pages[item.page - 1];
    if (!page) continue;
    const node: Node = { ref: ref(), title: item.title, page, children: [] };
    if (item.level === 1 && top.length > 0) top[top.length - 1].children.push(node);
    else top.push(node);
  }
  const link = (nodes: Node[], parent: string) =>
    nodes.forEach((node, index) => {
      const entry: Record<string, unknown> = { "/Title": `u:${node.title}`, "/Parent": parent, "/Dest": [node.page, "/Fit"] };
      if (index > 0) entry["/Prev"] = nodes[index - 1].ref;
      if (index < nodes.length - 1) entry["/Next"] = nodes[index + 1].ref;
      if (node.children.length > 0) {
        entry["/First"] = node.children[0].ref;
        entry["/Last"] = node.children[node.children.length - 1].ref;
        entry["/Count"] = -node.children.length;
        link(node.children, node.ref);
      }
      objects[`obj:${node.ref}`] = { value: entry };
    });

  if (top.length > 0) {
    link(top, outlineRef);
    objects[`obj:${outlineRef}`] = {
      value: { "/Type": "/Outlines", "/First": top[0].ref, "/Last": top[top.length - 1].ref, "/Count": top.length },
    };
    objects[`obj:${input.root.ref}`] = {
      value: { ...input.root.value, "/Outlines": outlineRef, "/PageMode": "/UseOutlines" },
    };
  }

  return {
    patch: {
      qpdf: [
        { jsonversion: 2, pushedinheritedpageresources: false, calledgetallpages: false, maxobjectid: input.maxObjectId },
        objects,
      ],
    },
    links,
    broken,
  };
}
