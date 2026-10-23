/**
 * Lecture et ecriture par chemin, et les quelques transformations qu'un import
 * reel demande toujours.
 *
 * Partage par le collecteur CSV (l'en-tete de colonne EST un chemin) et par le
 * collecteur d'API generique (la table de correspondance relie deux chemins).
 * Ecrire deux fois la meme resolution de chemin, c'est se preparer a deux
 * comportements differents sur "images.0.legend".
 *
 * POURQUOI CE MODULE VIT ICI ET NON DANS collectors/, OU IL EST NE. Depuis que
 * l'import de catalogue se fait aussi depuis le navigateur (src/app/(studio)/import),
 * trois consommateurs appliquent les memes chemins et les memes
 * transformations : les collecteurs, la page d'import, et rien ne doit les
 * separer. La regle du depot est qu'un collecteur est un CLIENT du Studio — le
 * Studio ne sait rien d'eux — donc le code commun remonte dans src/lib et les
 * collecteurs l'importent par "@/lib/mapping", jamais l'inverse.
 *
 * Corollaire a tenir : ce module est PUR. Aucun import de node:*, aucun
 * Buffer — il part dans le bundle du navigateur.
 */

/** "a.b.0.c" ou "a.b[0].c" — les deux ecritures designent la meme chose. */
export function splitPath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");
}

/**
 * Ecrit une valeur au bout d'un chemin, en creant ce qu'il faut au passage.
 *
 * Un segment numerique cree un TABLEAU et non un objet : c'est ce qui permet a
 * une colonne "images.0.src" de produire `images: [{ src }]`, que le schema
 * attend, plutot que `images: { "0": { src } }`, qu'il refuserait.
 */
export function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = splitPath(path);
  if (segments.length === 0) return;

  let cursor: Record<string, unknown> | unknown[] = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const nextIsIndex = /^\d+$/.test(segments[i + 1]);
    const existing = readSegment(cursor, segment);
    if (existing === undefined || existing === null || typeof existing !== "object") {
      const created = nextIsIndex ? [] : {};
      writeSegment(cursor, segment, created);
      cursor = created;
    } else {
      cursor = existing as Record<string, unknown> | unknown[];
    }
  }
  writeSegment(cursor, segments[segments.length - 1], value);
}

export function getPath(source: unknown, path: string): unknown {
  let cursor: unknown = source;
  for (const segment of splitPath(path)) {
    if (cursor === null || cursor === undefined) return undefined;
    cursor = readSegment(cursor as Record<string, unknown> | unknown[], segment);
  }
  return cursor;
}

/**
 * Comme getPath, mais "[]" traverse un tableau et renvoie la valeur pour chaque
 * element : "medias[].url" donne la liste des URLs. C'est ce qui permet de
 * decrire en une ligne le mapping d'une liste d'images ou de caracteristiques.
 *
 * LES TROUS SONT CONSERVES, et c'est essentiel : deux expressions paralleles
 * ("medias[].url" et "medias[].legende") doivent rester alignees sur le meme
 * indice. Ecarter ici la valeur absente decalerait la seconde liste, et la
 * legende du deuxieme media se retrouverait sur le premier — sans rien casser
 * de visible. C'est a l'appelant de filtrer, quand il sait qu'il le peut.
 */
export function getPathMulti(source: unknown, expression: string): unknown[] {
  const [head, ...rest] = expression.split("[]");
  if (rest.length === 0) {
    return [getPath(source, expression)];
  }

  const list = head === "" ? source : getPath(source, head);
  if (!Array.isArray(list)) return [];

  const tail = rest.join("[]").replace(/^\./, "");
  if (tail === "") return list;
  return list.flatMap((item) => getPathMulti(item, tail));
}

function readSegment(cursor: unknown, segment: string): unknown {
  if (Array.isArray(cursor)) {
    const index = Number(segment);
    return Number.isInteger(index) ? cursor[index] : undefined;
  }
  if (cursor !== null && typeof cursor === "object") {
    return (cursor as Record<string, unknown>)[segment];
  }
  return undefined;
}

function writeSegment(cursor: Record<string, unknown> | unknown[], segment: string, value: unknown): void {
  if (Array.isArray(cursor)) {
    const index = Number(segment);
    if (Number.isInteger(index) && index >= 0) cursor[index] = value;
    return;
  }
  cursor[segment] = value;
}

// --- Transformations --------------------------------------------------------

export type Transform = (value: unknown) => unknown;

/** "prix.ttc | amount | default:0.00" -> chemin + transformations. */
export function parseExpression(expression: string): { path: string; transforms: Transform[] } {
  const [path, ...pipes] = expression.split("|").map((part) => part.trim());
  return { path, transforms: pipes.map(compileTransform) };
}

export function applyTransforms(value: unknown, transforms: readonly Transform[]): unknown {
  return transforms.reduce<unknown>((current, transform) => transform(current), value);
}

function compileTransform(pipe: string): Transform {
  const [name, ...args] = pipe.split(":");
  const argument = args.join(":");

  switch (name) {
    case "trim":
      return (value) => (typeof value === "string" ? value.trim() : value);
    case "string":
      return (value) => (value === null || value === undefined ? undefined : String(value));
    case "amount":
      return (value) => toAmount(value);
    case "minor":
      // Centimes -> unites. Une API qui stocke 34900 pour 349,00 EUR est la
      // regle plutot que l'exception ; le Studio, lui, attend des unites.
      return (value) => {
        const raw = typeof value === "number" ? value : Number(toAmount(value));
        return Number.isFinite(raw) ? (raw / 100).toFixed(2) : undefined;
      };
    case "int":
      return (value) => {
        const raw = Number(value);
        return Number.isFinite(raw) ? Math.trunc(raw) : undefined;
      };
    case "bool":
      return (value) => value === true || value === "1" || value === "true" || value === "oui";
    case "join":
      return (value) => (Array.isArray(value) ? value.filter(isFilled).join(argument || ", ") : value);
    case "split":
      return (value) =>
        typeof value === "string"
          ? value.split(argument || ";").map((part) => part.trim()).filter((part) => part !== "")
          : value;
    case "first":
      return (value) => (Array.isArray(value) ? value[0] : value);
    case "upper":
      return (value) => (typeof value === "string" ? value.toUpperCase() : value);
    case "lower":
      return (value) => (typeof value === "string" ? value.toLowerCase() : value);
    case "nl2html":
      return (value) => (typeof value === "string" ? textToHtml(value) : value);
    case "html2text":
      return (value) => (typeof value === "string" ? htmlToText(value) : value);
    case "default":
      return (value) => (isFilled(value) ? value : argument);
    default:
      throw new Error(`transformation inconnue : "${name}"`);
  }
}

/**
 * Retire les trous des tableaux, en profondeur.
 *
 * Necessaire des qu'un mapping ecrit par index : "images.0.src" et
 * "images.2.src" sans le 1 produisent un tableau creux, dont JSON.stringify
 * fait un `null` — refuse par le schema, avec un message qui ne dit pas d'ou
 * vient le trou. Il vaut mieux perdre une image que la fiche.
 */
export function compactArrays(value: unknown): void {
  if (Array.isArray(value)) {
    const kept = value.filter((item) => item !== undefined && item !== null);
    value.length = 0;
    value.push(...kept);
    for (const item of value) compactArrays(item);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) compactArrays(item);
  }
}

export function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Normalise un montant vers ce que le contrat exige : une chaine, separateur
 * POINT, non formatee.
 *
 * Ce n'est pas de la coquetterie. Le Studio formate lui-meme avec `Intl`
 * d'apres la locale, et son `formatPrice` sort sur `Number(amount)` : un
 * "489,00" venu d'un export Excel francais donne NaN, donc PAS de
 * `{{product.price.formatted}}`, donc un prix vide sur la fiche — sans aucune
 * erreur nulle part. C'est exactement le genre de defaut qu'on decouvre en
 * relisant 300 PDF.
 *
 * Regle sur les separateurs, quand les deux sont presents : le DERNIER rencontre
 * est le decimal ("1.234,56" et "1,234.56" tombent tous les deux juste). Quand
 * un seul est present, il est traite comme decimal — "1.234" est ambigu et rend
 * 1.234 ; un export qui compte en milliers doit passer par `minor` ou etre
 * corrige a la source.
 */
export function toAmount(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(2) : undefined;
  }

  const raw = String(value)
    .replace(/[^\d.,+-]/g, "")
    .trim();
  if (raw === "") return undefined;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = raw.split(thousands).join("").replace(decimal, ".");
  } else {
    normalized = raw.replace(",", ".");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount.toFixed(2) : undefined;
}

/**
 * Texte brut -> HTML minimal. Une source qui stocke sa description en texte
 * (Medusa, la plupart des PIM) perdrait sinon tous ses sauts de ligne : le champ
 * part dans `description_html`, ou HTML veut dire HTML.
 */
export function textToHtml(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/**
 * HTML -> texte. L'inverse de textToHtml, et tout aussi necessaire.
 *
 * Le contrat distingue deux champs par leur suffixe : `description_html` est
 * assaini et rendu, `description_short` est du TEXTE. Un resume PrestaShop, qui
 * est du HTML, verse tel quel dans `description_short` affiche ses balises en
 * clair sur la fiche — sans erreur, sans avertissement, juste un "<p>" imprime.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      // Les balises de bloc marquent une rupture de ligne : sans cela, une
      // liste a puces se recolle en une seule phrase illisible.
      .replace(/<\s*(br|\/p|\/li|\/div|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Decodage d'entites volontairement COURT.
 *
 * Inventaire fait sur l'export PrestaShop de reference, 2,7 Mo : quatre entites
 * nommees en tout — &nbsp; (116), &gt; (40), &amp; (5), &lt; (1) — et aucune
 * numerique. Le contenu accentue arrive en UTF-8 direct. Une table de 250
 * entrees serait donc du poids mort, et une table devinee serait pire : un
 * &eacute; traduit de memoire en "e" abimerait le texte sans que rien ne le
 * signale.
 *
 * Ce qui n'est pas reconnu traverse INTACT. Voir "&agrave;" sur une fiche
 * conduit a completer cette table ; lire "dej&agrave;" devenu "deja" ne conduit
 * a rien.
 */
const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "\u2019",
  lsquo: "\u2018",
  ldquo: "\u201c",
  rdquo: "\u201d",
  laquo: "\u00ab",
  raquo: "\u00bb",
  hellip: "\u2026",
  ndash: "\u2013",
  mdash: "\u2014",
  deg: "\u00b0",
  euro: "\u20ac",
  times: "\u00d7",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#")) {
      const point =
        code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
