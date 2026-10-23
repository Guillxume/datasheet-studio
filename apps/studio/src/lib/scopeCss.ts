/**
 * Confine une feuille de style a une racine donnee.
 *
 * Module a part et sans aucune dependance — meme raison que printCss.ts et
 * cssAssets.ts : consomme cote NAVIGATEUR par l'editeur, il ne doit rien
 * entrainer avec lui.
 *
 * POURQUOI CE CODE EXISTE. La feuille du template etait transmise a
 * l'enregistrement et au rendu, mais JAMAIS injectee dans le canvas de
 * l'editeur : un token defini par le template (une police, une rampe de
 * couleurs) sortait juste dans le PDF et restait absent de l'apercu. C'est
 * exactement la divergence apercu/PDF que le partage du registry existe pour
 * empecher.
 *
 * L'injecter telle quelle etait pourtant exclu : elle est ecrite pour un
 * DOCUMENT IMPRIME, ou `body` designe la page. Dans l'editeur, `body` designe
 * l'application — une seule regle `body { font-family: ... }` repeindrait la
 * barre d'outils et les panneaux. D'ou ce confinement.
 *
 * CE QUI N'EST VOLONTAIREMENT PAS CONFINE : les at-regles globales par nature.
 * Un `@font-face` ne cible rien, il declare une ressource ; le confiner n'a pas
 * de sens et le CSS ne le permet pas. Idem pour `@keyframes` et `@property`,
 * qui nomment sans selectionner. Les laisser globales est sans effet de bord :
 * elles ne s'appliquent que la ou on les reference.
 */

/** At-regles dont le CONTENU est du CSS a confiner a son tour. */
const NESTED_AT_RULES = new Set(["media", "supports", "layer", "container", "document"]);

/**
 * At-regles a bloc laissees GLOBALES parce qu'elles ne selectionnent rien : elles
 * declarent une ressource ou un nom, utilise la ou on le reference.
 *
 * UNE LISTE D'AUTORISATION, ET NON « TOUT LE RESTE PASSE ». La premiere version
 * recopiait telle quelle toute at-regle inconnue : `@scope (body) { … }`
 * echappait ainsi au confinement et repeignait l'editeur entier, et
 * `@starting-style` de meme (audit du 16/10/2026). Ce qui n'est pas dans l'une
 * de ces deux listes est ecarte — de l'apercu de l'editeur seulement : le PDF
 * recoit la feuille entiere.
 */
const GLOBAL_AT_RULES = new Set([
  "font-face",
  "keyframes",
  "property",
  "page",
  "counter-style",
  "font-feature-values",
  "font-palette-values",
]);

/**
 * At-regles SANS bloc conservees. `@import` n'en est pas : il chargerait dans
 * l'editeur une feuille externe que rien ne confine.
 */
const STATEMENT_AT_RULES = new Set(["charset", "layer", "namespace"]);

/**
 * Selecteurs qui, dans un document imprime, designent la page entiere.
 *
 * Ils sont REMPLACES par la racine, et non prefixes : `.ds-page-sheet body` ne
 * correspondrait a rien, la surface de page n'ayant evidemment pas de `body`
 * parmi ses descendants — la regle serait silencieusement perdue.
 */
const DOCUMENT_ROOTS = new Set([":root", "html", "body", ":scope"]);

type Chunk = { prelude: string; body: string | null; raw: string };

/**
 * Decoupe un bloc CSS en regles de premier niveau.
 *
 * Ecrit a la main plutot qu'en expression reguliere : une accolade dans une
 * chaine (`content: "}"`) ou dans un commentaire suffit a faire deraper un
 * decoupage naif, et le resultat serait une feuille tronquee — donc un canvas
 * partiellement style, sans erreur visible.
 */
function splitRules(source: string): Chunk[] {
  const chunks: Chunk[] = [];
  let prelude = "";
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    // Commentaire : recopie tel quel, jamais interprete.
    if (char === "/" && source[index + 1] === "*") {
      const close = source.indexOf("*/", index + 2);
      const end = close === -1 ? source.length : close + 2;
      prelude += source.slice(index, end);
      index = end;
      continue;
    }

    // Chaine : recopiee telle quelle, echappements compris.
    if (char === '"' || char === "'") {
      let cursor = index + 1;
      while (cursor < source.length && source[cursor] !== char) {
        cursor += source[cursor] === "\\" ? 2 : 1;
      }
      prelude += source.slice(index, cursor + 1);
      index = cursor + 1;
      continue;
    }

    // At-regle sans bloc : @import, @charset. Le point-virgule la termine.
    if (char === ";") {
      const raw = `${prelude};`;
      if (raw.trim()) chunks.push({ prelude: prelude.trim(), body: null, raw });
      prelude = "";
      index += 1;
      continue;
    }

    if (char === "{") {
      const bodyStart = index + 1;
      const bodyEnd = findClosingBrace(source, bodyStart);
      const body = source.slice(bodyStart, bodyEnd);
      chunks.push({
        prelude: prelude.trim(),
        body,
        raw: `${prelude}{${body}}`,
      });
      prelude = "";
      index = bodyEnd + 1;
      continue;
    }

    prelude += char;
    index += 1;
  }

  // Reliquat sans accolade : CSS invalide ou tronque. On le laisse tomber
  // plutot que de produire une regle inventee.
  return chunks;
}

/** Position de l'accolade fermante correspondante, chaines et commentaires ignores. */
function findClosingBrace(source: string, start: number): number {
  let depth = 1;
  let index = start;

  while (index < source.length) {
    const char = source[index];

    if (char === "/" && source[index + 1] === "*") {
      const close = source.indexOf("*/", index + 2);
      index = close === -1 ? source.length : close + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      index += 1;
      while (index < source.length && source[index] !== char) {
        index += source[index] === "\\" ? 2 : 1;
      }
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }

  // Accolade jamais fermee : on considere que le bloc court jusqu'a la fin,
  // ce qui preserve le contenu au lieu de le perdre.
  return source.length;
}

/**
 * Retire les commentaires d'un PRELUDE de regle (la partie avant l'accolade).
 *
 * Indispensable, et pas cosmetique : sans cela `/* note *​/ body { ... }` garde
 * son commentaire en tete, le premier mot du selecteur devient `/*` au lieu de
 * `body`, la regle n'est plus reconnue comme visant la page et sort en
 * `.ds-page-sheet /* note *​/ body` — un selecteur valide qui ne correspond a
 * RIEN, la surface de page n'ayant pas de `body` parmi ses descendants. La regle
 * disparaitrait sans le moindre message. Meme piege pour `/* note *​/ @media`,
 * qui ne serait plus reconnu comme une at-regle.
 *
 * Applique au seul prelude : dans un bloc de declarations, un commentaire
 * appartient a l'auteur et n'a aucune raison d'etre supprime.
 */
function stripComments(prelude: string): string {
  let out = "";
  let index = 0;

  // Les suites d'espaces sont reduites a une seule, HORS CHAINES : dans un
  // selecteur elles valent toutes une combinaison de descendance, et le retrait
  // d'un commentaire en laisse mecaniquement plusieurs a la suite.
  const endsWithSpace = () => out.length === 0 || /\s$/.test(out);

  while (index < prelude.length) {
    const char = prelude[index];

    if (char === "/" && prelude[index + 1] === "*") {
      const close = prelude.indexOf("*/", index + 2);
      index = close === -1 ? prelude.length : close + 2;
      // Un commentaire separe deux composes : le remplacer par une espace
      // preserve la combinaison de descendance qu'il pouvait porter.
      if (!endsWithSpace()) out += " ";
      continue;
    }

    // Une chaine peut contenir "/*" sans que ce soit un commentaire.
    if (char === '"' || char === "'") {
      let cursor = index + 1;
      while (cursor < prelude.length && prelude[cursor] !== char) {
        cursor += prelude[cursor] === "\\" ? 2 : 1;
      }
      out += prelude.slice(index, cursor + 1);
      index = cursor + 1;
      continue;
    }

    if (/\s/.test(char)) {
      if (!endsWithSpace()) out += " ";
      index += 1;
      continue;
    }

    out += char;
    index += 1;
  }

  return out.trim();
}

/** Decoupe une liste de selecteurs sur les virgules de premier niveau. */
function splitSelectors(prelude: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let index = 0;

  while (index < prelude.length) {
    const char = prelude[index];

    if (char === '"' || char === "'") {
      let cursor = index + 1;
      while (cursor < prelude.length && prelude[cursor] !== char) {
        cursor += prelude[cursor] === "\\" ? 2 : 1;
      }
      current += prelude.slice(index, cursor + 1);
      index = cursor + 1;
      continue;
    }
    // :is(a, b) et [attr="x,y"] contiennent des virgules qui ne separent rien.
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function scopeSelector(selector: string, root: string): string {
  // Le premier compose du selecteur decide : `body .x` vise la page ET un
  // descendant, il devient donc `<racine> .x`.
  const [first, ...rest] = selector.split(/\s+/);

  if (DOCUMENT_ROOTS.has(first)) {
    return rest.length > 0 ? `${root} ${rest.join(" ")}` : root;
  }

  return `${root} ${selector}`;
}

/**
 * Confine `css` a la racine `root`.
 *
 * @param root selecteur de la racine, par exemple ".ds-page-sheet"
 * @returns la feuille confinee, ou "" si l'entree est vide
 */
export function scopeCss(css: string | null | undefined, root: string): string {
  if (!css) return "";
  return scopeBlock(css, root);
}

function scopeBlock(source: string, root: string): string {
  const out: string[] = [];

  for (const chunk of splitRules(source)) {
    // At-regle sans bloc (@charset, @layer a;) : rien a confiner. @import est
    // ecarte : voir STATEMENT_AT_RULES.
    if (chunk.body === null) {
      const instruction = /^\s*@([a-z-]+)/i.exec(stripComments(chunk.raw))?.[1]?.toLowerCase();
      if (instruction === undefined || STATEMENT_AT_RULES.has(instruction)) out.push(chunk.raw);
      continue;
    }

    // Le prelude est analyse SANS ses commentaires : voir stripComments.
    const prelude = stripComments(chunk.prelude);

    if (prelude.startsWith("@")) {
      const bare = /^@-?(?:webkit|moz|ms|o)?-?([a-z-]+)/i.exec(prelude)?.[1]?.toLowerCase() ?? "";

      if (NESTED_AT_RULES.has(bare)) {
        out.push(`${prelude}{${scopeBlock(chunk.body, root)}}`);
        continue;
      }

      // @font-face, @keyframes, @property, @page : globales par nature. Toute
      // autre at-regle a bloc est ecartee de l'apercu : voir GLOBAL_AT_RULES.
      if (GLOBAL_AT_RULES.has(bare)) out.push(chunk.raw);
      continue;
    }

    const selectors = splitSelectors(prelude)
      .map((selector) => scopeSelector(selector, root))
      .join(", ");

    // Un bloc sans selecteur exploitable n'a pas de cible : le confiner
    // produirait une regle qui s'applique a la racine par accident.
    if (!selectors) continue;

    out.push(`${selectors}{${chunk.body}}`);
  }

  return out.join("\n");
}
