import { z } from "zod";
import { MAX_SELECTION } from "./datasheets";

/**
 * Le book : des fiches techniques assemblees en un seul PDF, avec couvertures et
 * intercalaires.
 *
 * Ce module est la partie sans reseau ni base : la forme de la demande, et le
 * HTML des pages que le Studio dessine lui-meme (couvertures, intercalaires,
 * fiche indisponible). L'assemblage est dans src/app/api/book/route.ts.
 *
 * TOUT TEXTE SAISI EST ECHAPPE, et les couleurs sont validees avant d'entrer
 * dans le CSS : ce HTML est execute par Chromium, sur le reseau du Studio.
 */

/** Au-dela, Gotenberg et le navigateur traitent des centaines de megaoctets. */
export const MAX_BOOK_DATASHEETS = MAX_SELECTION;

/**
 * Une section du book : un intercalaire fixe (son identifiant, voir
 * src/lib/bookPagesStore.ts) et les fiches qu'il ouvre, dans l'ordre choisi.
 * `divider` null : les fiches « a la suite », sans intercalaire.
 *
 * Les couvertures sont designees par leur identifiant (voir bookSpecSchema).
 */
export const bookSectionSchema = z.object({
  divider: z.string().uuid().nullable(),
  /** Les fiches, designees comme sur /consultation : « <langue>:<cle> ». */
  fiches: z.array(z.string().min(3).max(300)).min(1).max(MAX_BOOK_DATASHEETS),
  /**
   * Imprimer la page d'intercalaire de CETTE section (defaut : oui). Trois fiches
   * d'une categorie n'ont pas besoin d'une page de garde ; la section garde sa
   * place et l'ordre de ses fiches.
   */
  printDivider: z.boolean().default(true),
});

export const bookSpecSchema = z
  .object({
    boutique: z.string().trim().min(1).max(100),
    sections: z.array(bookSectionSchema).min(1).max(100),
    /**
     * La premiere et la quatrieme de couverture, choisies parmi celles de la
     * boutique (migration 016). ABSENTE : la premiere de la liste, comme avant
     * qu'on puisse choisir. `null` : aucune.
     */
    cover: z.string().uuid().nullable().optional(),
    back: z.string().uuid().nullable().optional(),
    /**
     * Interrupteur general des intercalaires (defaut : oui). `false` les saute
     * tous, quelle que soit la section ; le choix fin est `printDivider`, par
     * section. Garde pour les appelants qui l'envoient deja.
     */
    dividers: z.boolean().default(true),
    /**
     * Le sommaire, apres la premiere de couverture (src/lib/bookToc.ts). Absent :
     * pas de sommaire, comme avant qu'il existe — le generateur l'envoie, coche
     * par defaut.
     */
    toc: z.boolean().default(false),
  })
  .refine((spec) => spec.sections.reduce((total, section) => total + section.fiches.length, 0) <= MAX_BOOK_DATASHEETS, {
    message: `au plus ${MAX_BOOK_DATASHEETS} fiches par book`,
  })
  .refine(
    (spec) => {
      // Un intercalaire n'ouvre qu'une section : deux fois le meme, et le book
      // l'imprimerait deux fois.
      const ids = spec.sections.map((section) => section.divider).filter((id) => id !== null);
      return new Set(ids).size === ids.length;
    },
    { message: "un intercalaire apparait deux fois" }
  );

export type BookSpec = z.infer<typeof bookSpecSchema>;

/* ----------------------------------------------------------------- HTML ---- */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Un texte saisi sur plusieurs lignes, echappe, avec ses retours a la ligne. */
function lines(value: string | null | undefined): string {
  return escapeHtml(value ?? "").replace(/\r?\n/g, "<br>");
}

const COLOR = /^#[0-9a-f]{6}$/i;

/** Une couleur validee ; le gris par defaut sinon — elle entre telle quelle dans le CSS. */
function safeColor(value: string): string {
  return COLOR.test(value) ? value : "#2e2b25";
}

/** Une image deja resolue : data URI uniquement, rien qui sorte vers le reseau. */
function imageTag(src: string | null | undefined, className: string): string {
  return src && src.startsWith("data:") ? `<img class="${className}" src="${escapeHtml(src)}" alt="">` : "";
}

/**
 * Le document d'une page A4, sans marge : la mise en page est a fond perdu,
 * et la geometrie passee a Gotenberg ne reserve aucun bandeau.
 */
function page(body: string, color: string, extraCss = ""): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>
@page { size: 210mm 297mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; width: 210mm; height: 297mm; }
body { font-family: Helvetica, Arial, sans-serif; color: #1f2933; background: #fff; --accent: ${safeColor(color)};
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; }
${extraCss}
</style></head><body><div class="page">${body}</div></body></html>`;
}

/**
 * Une page dessinee a part (couverture, intercalaire) : l'image, pleine page,
 * a fond perdu. L'image arrive deja integree (data URI) — rien que Chromium
 * irait chercher sur le reseau.
 */
export function imagePageHtml(dataUri: string): string {
  const css = `.full { position: absolute; inset: 0; width: 210mm; height: 297mm; object-fit: cover; display: block; }`;
  return page(imageTag(dataUri, "full"), "#2e2b25", css);
}

/**
 * La page qui remplace une fiche irrecuperable.
 *
 * UNE FICHE NE DISPARAIT PAS EN SILENCE d'un book : un catalogue imprime auquel
 * il manque un produit sans que rien ne le signale est pire qu'une page qui le
 * dit. Le nom et la raison sont imprimes ; l'ecran l'annonce aussi.
 */
export function missingPageHtml(input: { name: string; reason: string; color: string }): string {
  const css = `
.box { position: absolute; left: 30mm; right: 30mm; top: 110mm; border: 0.6mm solid var(--accent); padding: 12mm; }
h2 { font-size: 20pt; margin: 0 0 6mm; }
p { font-size: 11pt; color: #5b6670; margin: 0; }`;
  const body = `<div class="box"><h2>${lines(input.name)}</h2><p>Fiche technique indisponible au moment de la composition de ce document (${escapeHtml(input.reason)}).</p></div>`;
  return page(body, input.color, css);
}
