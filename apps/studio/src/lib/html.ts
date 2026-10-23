import sanitizeHtml from "sanitize-html";
import { PRINT_ELEMENT_CSS, PRINT_TYPOGRAPHY } from "./printCss";

/**
 * Assainissement du HTML issu des editeurs WYSIWYG de la boutique.
 *
 * NON NEGOCIABLE. Un <script> colle dans une description produit
 * s'executerait dans le conteneur de rendu, avec acces reseau. Le JavaScript y
 * est coupe depuis le 16/10/2026 (infra/docker-compose.yml), mais c'est une
 * seconde barriere : celle-ci reste la premiere, et la seule qui ne depende
 * pas d'un reglage d'infrastructure.
 *
 * L'allow-list reprend celle de l'ancien module (PDFService::$allowedTags) et
 * l'etend a ce qu'un tableau de WYSIWYG produit reellement.
 */
export function sanitizeRichHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";

  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "hr", "span", "div",
      "strong", "b", "em", "i", "u", "s", "sub", "sup", "small",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "dl", "dt", "dd",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
      "img", "a", "figure", "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan", "style"],
      th: ["colspan", "rowspan", "scope", "style"],
      col: ["span", "style"],
      table: ["style"],
      "*": ["style"],
    },
    // Pas de file:, pas de javascript:.
    allowedSchemes: ["http", "https", "data"],
    allowedSchemesByTag: { img: ["http", "https", "data"], a: ["http", "https"] },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        "vertical-align": [/^(top|middle|bottom|baseline)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^(none|underline|line-through)$/],
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s.,%]+\)$/],
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s.,%]+\)$/],
        width: [/^\d+(\.\d+)?(px|%|mm|em|rem)$/],
        height: [/^\d+(\.\d+)?(px|%|mm|em|rem)$/],
      },
    },
    // Les commentaires conditionnels et le CSS inline <style> disparaissent.
    disallowedTagsMode: "discard",
  });
}

/**
 * Feuille de style de base pour l'impression.
 *
 * C'est ici que se materialise le gain sur mPDF : la pagination est reelle,
 * donc on peut la piloter par declaration (eviter de couper une ligne de
 * tableau, repeter les en-tetes de tableau sur chaque page) au lieu de
 * l'estimer a 40 caracteres par ligne.
 */
const BASE_PRINT_CSS = `
html, body { margin: 0; padding: 0; }
body {
  ${PRINT_TYPOGRAPHY}
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
${PRINT_ELEMENT_CSS}
`;

export type DocumentOptions = {
  bodyHtml: string;
  /** CSS propre au template, edite dans le Studio. */
  templateCss?: string | null;
  colors?: { primary?: string; secondary?: string };
  locale: string;
  title: string;
};

export function buildDocument({ bodyHtml, templateCss, colors, locale, title }: DocumentOptions): string {
  // Les couleurs arrivent en donnee (data.shop.colors) et non du template :
  // c'est ce qui permet a un meme template de bibliotheque de servir plusieurs
  // sites sans etre duplique.
  const tokens = [
    colors?.primary ? `--color-primary: ${cssColor(colors.primary)};` : "--color-primary: #1a1a1a;",
    colors?.secondary ? `--color-secondary: ${cssColor(colors.secondary)};` : "--color-secondary: #666666;",
  ].join(" ");

  return `<!doctype html>
<html lang="${escapeAttr(locale)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>:root { ${tokens} }</style>
<style>${BASE_PRINT_CSS}</style>
${styleElement(templateCss)}
</head>
<body>${bodyHtml}</body>
</html>`;
}

/**
 * Une feuille de style de template, dans sa balise.
 *
 * LA FEUILLE NE DOIT PAS POUVOIR FERMER SA BALISE. Le contenu d'un <style> est
 * du texte brut pour le parseur HTML, qui n'en sort qu'a la sequence `</style`.
 * Inseree telle quelle, une feuille contenant `</style><script>…` refermait la
 * balise et posait un script dans le document que Chromium rend — avec la
 * session de rendu, les donnees produit et le reseau du conteneur (audit du
 * 16/10/2026, constat E1). Il suffisait d'un compte editeur.
 *
 * `<\/style` et non une suppression : aucune feuille legitime ne contient cette
 * sequence hors d'une chaine (ce ne serait pas du CSS valide), et dans une
 * chaine — `content: "</style>"` — l'echappement CSS `\/` se lit `/` : le
 * texte affiche ne change pas. Insensible a la casse, comme le parseur HTML.
 */
export function styleElement(css: string | null | undefined): string {
  return css ? `<style>${neutralizeStyleEnd(css)}</style>` : "";
}

export function neutralizeStyleEnd(css: string): string {
  return css.replace(/<\/(style)/gi, "<\\/$1");
}

/** Les couleurs viennent d'un champ de config boutique : on ne les injecte pas brutes dans du CSS. */
export function cssColor(value: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) || /^[a-zA-Z]{3,20}$/.test(value) ? value : "#1a1a1a";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value);
}
