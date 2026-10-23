import { parseFeatureColumn } from "./featureColumn";
import {
  applyTransforms,
  compactArrays,
  getPath,
  getPathMulti,
  isFilled,
  parseExpression,
  setPath,
  toAmount,
} from "./mapping";

/**
 * Un enregistrement de catalogue + une table de correspondance -> les donnees
 * du contrat.
 *
 * SOURCE UNIQUE DE LA SEMANTIQUE, et c'est sa raison d'etre. Trois chemins
 * arrivent ici :
 *
 *   - le collecteur CSV en ligne de commande (collectors/csv/source.ts) ;
 *   - la page d'import du Studio (src/app/(studio)/import), dans le navigateur ;
 *   - un import JSON, dont les expressions source portent des "[]".
 *
 * Les trois doivent produire le MEME payload a partir du meme fichier et du
 * meme mapping — sinon l'apercu montre autre chose que ce qui sera envoye, et
 * un reglage fait a l'ecran ne se rejoue pas en ligne de commande. Les regles
 * qui suivent (cellule vide = champ absent, normalisation du montant, listes
 * separees, images introuvables) n'ont donc qu'une implementation.
 *
 * LA TABLE SE LIT SOURCE -> CIBLE, comme le fichier --mapping du collecteur
 * CSV, et c'est le meme fichier :
 *
 *   { "Prix HT": "product.price.amount", "Resume": "product.description_short | html2text" }
 *
 * (Le collecteur d'API, lui, ecrit CIBLE <- SOURCE : sa configuration decrit
 * une API, pas un fichier a colonnes. Les deux sens existent parce que les deux
 * cotes different — ici la source est une liste fermee de colonnes qu'on parcourt
 * une fois, la-bas c'est la cible.)
 *
 * Module PUR : aucun import de node:*. Il part dans le bundle du navigateur.
 */

/** Ce que le contrat attend en liste de chaines, separee par --list-sep. */
const LIST_PATHS = new Set(["badges", "product.category_path", "product.variant_skus", "product.supplier_skus"]);

/**
 * Racines du contrat, plus les trois cibles de pilotage.
 *
 * Une cible dont la racine n'y figure pas ne peut RIEN alimenter : zod ecarte
 * les cles inconnues en silence. Sans ce tri, un export de 54 colonnes dont 15
 * sont utiles envoie les 39 autres dans le payload, ou elles ne servent qu'a une
 * chose — faire changer la cle de fraicheur, donc regenerer le catalogue, quand
 * une colonne sans rapport bouge.
 */
export const KNOWN_ROOTS = new Set([
  "product",
  "shop",
  "features",
  "images",
  "schema_image",
  "badges",
  "qr_code",
  "custom",
  "ref",
  "template",
  "locale",
]);

export type FeatureLike = {
  name: string;
  value: string;
  abbreviation?: string | null;
  group?: string | null;
};

/** Table de correspondance : en-tete ou expression source -> cible du contrat. */
export type MappingTable = Record<string, string>;

/**
 * Acces aux valeurs d'un enregistrement, quel que soit son format.
 *
 * Deux implementations sont fournies plus bas — une ligne de CSV, un objet
 * JSON. C'est la seule chose qui differe entre les deux formats : tout le reste
 * de la semantique est commun, et doit le rester.
 */
export type SourceRecord = {
  /** Valeur unique. `undefined` vaut « champ absent », jamais « champ vide ». */
  read(source: string): unknown;
  /**
   * Valeurs d'une expression a "[]", ou `null` quand l'expression n'en porte
   * pas. LES TROUS SONT CONSERVES : deux expressions paralleles
   * ("medias[].url" et "medias[].legende") s'apparient par indice.
   */
  readMany(source: string): unknown[] | null;
};

export type MapRecordOptions = {
  /** Separateur des listes en colonne unique. Defaut "|". */
  listSeparator?: string;
  /** Une caracteristique repetee devient une ligne a valeurs multiples. */
  mergeFeatures?: boolean;
  /**
   * Cible dont la valeur sert de reference, quand elle n'est pas "ref".
   * Comparee au CHEMIN CIBLE et non a l'en-tete : c'est ce que fait
   * --ref-column du collecteur CSV.
   */
  refTarget?: string;
  /**
   * Valeurs communes a toutes les fiches, deposees AVANT le mapping — la
   * boutique, en pratique. Une colonne mappee sur shop.url ecrase donc la
   * valeur commune, ce qui est le sens attendu : la source gagne.
   */
  seed?: Record<string, unknown>;
  /**
   * Chemin ou URL d'image -> reference utilisable dans le payload, ou
   * `undefined` quand l'image est introuvable. Sans resolveur, seules les URLs
   * distantes et les references asset:// traversent.
   */
  resolveImage?: (raw: string) => Promise<string | undefined> | string | undefined;
  /** Une image introuvable fait echouer la fiche au lieu de couter l'image. */
  strict?: boolean;
  /** Caracteristiques venues d'ailleurs (fichier long du collecteur CSV). */
  extraFeatures?: readonly FeatureLike[];
  /** Reference de repli, quand ni ref, ni sku, ni id ne sont fournis. */
  fallbackRef?: string;
};

export type MappedRecord = {
  data: Record<string, unknown>;
  ref: string;
  /** La reference vient du repli : elle n'est pas stable d'un passage a l'autre. */
  refIsFallback: boolean;
  template?: string;
  locale?: string;
  warnings: string[];
};

export async function mapRecord(
  record: SourceRecord,
  table: MappingTable,
  options: MapRecordOptions = {}
): Promise<MappedRecord> {
  const listSeparator = options.listSeparator ?? "|";
  const refTarget = options.refTarget ?? "ref";
  const data: Record<string, unknown> = structuredClone(options.seed ?? {});
  const warnings: string[] = [];
  const features: FeatureLike[] = [];
  let ref: string | undefined;
  let template: string | undefined;
  let locale: string | undefined;

  for (const [source, rawTarget] of Object.entries(table)) {
    const { path, transforms } = parseExpression(rawTarget);
    if (path === "") continue;

    // C'est l'EXPRESSION SOURCE qui dit s'il y a plusieurs valeurs, et la CIBLE
    // qui dit ou les poser. Quatre combinaisons, toutes utiles :
    //   familles[].libelle -> product.category_path   la liste entiere
    //   medias[].url       -> images[].src            un element par indice
    //   marque.nom         -> product.brand           une valeur
    //   schema.url         -> images[].src            le premier element
    const many = record.readMany(source);
    if (many !== null) {
      await spreadMany(data, path, many, transforms, {
        listSeparator,
        resolveImage: options.resolveImage,
        strict: options.strict,
        warnings,
      });
      continue;
    }

    const raw = record.read(source);
    if (!isFilled(raw)) continue; // cellule vide = champ absent, pas champ vide

    if (path === refTarget) {
      ref = String(raw);
      continue;
    }
    if (path === "template") {
      template = String(raw);
      continue;
    }
    if (path === "locale") {
      locale = String(raw);
      continue;
    }

    if (path.startsWith("feature:")) {
      const [name, abbreviation] = path.slice("feature:".length).split("@");
      features.push({
        name: name.trim(),
        value: String(raw),
        ...(abbreviation ? { abbreviation: abbreviation.trim() } : {}),
      });
      continue;
    }

    if (path === "features") {
      // Une colonne unique portant toute la liste. Le separateur est la virgule
      // et non listSeparator : c'est PrestaShop qui fixe ce format, pas
      // l'export, et les deux peuvent differer dans le meme fichier.
      features.push(
        ...parseFeatureColumn(String(raw), { merge: options.mergeFeatures !== false })
      );
      continue;
    }

    const coerced = await coerce(path, raw, {
      listSeparator,
      resolveImage: options.resolveImage,
      strict: options.strict,
      warnings,
    });
    const value = applyTransforms(coerced, transforms);
    if (value !== undefined) setPath(data, path, value);
  }

  const merged = [...features, ...(options.extraFeatures ?? [])];
  if (merged.length > 0) {
    // Les caracteristiques du fichier long s'ajoutent a celles des colonnes : un
    // catalogue en porte souvent quelques-unes de communes en colonnes, et les
    // specifiques dans le fichier joint.
    setPath(data, "features", [...((data.features as FeatureLike[]) ?? []), ...merged]);
  }

  // Une image introuvable laisse un trou : "images.0.src" absent alors que
  // "images.0.legend" est la donnerait un element sans `src`, refuse par le
  // schema. Et des indices 0 et 2 sans le 1 produiraient un tableau creux, dont
  // JSON.stringify fait un `null`, refuse lui aussi. On nettoie ici plutot que
  // de perdre la fiche entiere pour une image manquante.
  dropImagesWithoutSource(data);
  compactArrays(data);

  const product = data.product as { sku?: unknown; id?: unknown } | undefined;
  const fallback = options.fallbackRef ?? "";
  const resolved = ref ?? asRef(product?.sku) ?? asRef(product?.id) ?? fallback;
  const refIsFallback = ref === undefined && !isFilled(product?.sku) && !isFilled(product?.id);
  if (refIsFallback && fallback !== "") {
    // Un numero de ligne comme reference n'est PAS stable : inserer une ligne en
    // tete du fichier decalerait tout et regenererait le catalogue entier.
    warnings.push(
      `aucune reference (cible ref, product.sku ou product.id) — repli sur ${fallback}`
    );
  }

  return {
    data,
    ref: String(resolved),
    refIsFallback,
    ...(template ? { template } : {}),
    ...(locale ? { locale } : {}),
    warnings,
  };
}

type CoerceContext = {
  listSeparator: string;
  resolveImage?: MapRecordOptions["resolveImage"];
  strict?: boolean;
  warnings: string[];
};

/**
 * Depose une expression source multiple. Les cibles a "[]" sont appariees PAR
 * INDICE : `images[1].legend` recoit la legende du deuxieme media, meme si le
 * premier n'en avait pas.
 */
async function spreadMany(
  data: Record<string, unknown>,
  target: string,
  values: unknown[],
  transforms: ReturnType<typeof parseExpression>["transforms"],
  context: CoerceContext
): Promise<void> {
  if (!target.includes("[]")) {
    const filled: unknown[] = [];
    for (const value of values) {
      if (!isFilled(value)) continue;
      const coerced = applyTransforms(await coerce(target, value, context), transforms);
      if (coerced !== undefined) filled.push(coerced);
    }
    // Une cible de liste ("badges") recoit la liste entiere ; une cible simple
    // recoit la premiere valeur, faute de quoi elle porterait un tableau que le
    // schema refuserait.
    if (filled.length === 0) return;
    setPath(data, target, LIST_PATHS.has(target) ? filled.flat() : filled[0]);
    return;
  }

  for (const [index, value] of values.entries()) {
    if (!isFilled(value)) continue;
    const path = target.replace("[]", `.${index}`);
    const coerced = applyTransforms(await coerce(path, value, context), transforms);
    if (coerced !== undefined) setPath(data, path, coerced);
  }
}

/**
 * Le chemin CIBLE decide du type.
 *
 * Un CSV ne porte que du texte : sans cette etape, `images.0.width` partirait
 * en chaine et le schema le refuserait, et un prix "1 234,56 EUR" arriverait
 * jusqu'a un `Number()` qui rend NaN — donc un prix vide sur la fiche, sans
 * erreur nulle part.
 */
async function coerce(path: string, raw: unknown, context: CoerceContext): Promise<unknown> {
  if (path === "product.price.amount") return toAmount(raw);
  if (path === "product.price.tax_included") {
    return raw === true || raw === "1" || /^(true|oui|vrai)$/i.test(String(raw));
  }
  if (/\.(width|height)$/.test(path)) {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }
  if (LIST_PATHS.has(path)) {
    if (Array.isArray(raw)) return raw.filter(isFilled);
    return String(raw)
      .split(context.listSeparator)
      .map((item) => item.trim())
      .filter(isFilled);
  }
  if (path === "images") {
    // Colonne unique portant toutes les images : "a.jpg|b.jpg|c.jpg".
    const sources = Array.isArray(raw)
      ? raw.map((item) => String(item))
      : String(raw)
          .split(context.listSeparator)
          .map((item) => item.trim());
    const images: Array<{ src: string }> = [];
    // En serie et non en parallele : un resolveur d'image deduplique les pieces
    // jointes en lisant ce qu'il a deja produit, ce que deux resolutions
    // simultanees rendraient faux.
    for (const src of sources.filter(isFilled)) {
      const resolved = await resolveImage(src, context);
      if (resolved !== undefined) images.push({ src: resolved });
    }
    return images;
  }
  if (path === "schema_image" || path === "qr_code") {
    // Cible nommee comme le champ entier : le contrat y attend un objet, pas une
    // chaine. Ecrire "schema_image" plutot que "schema_image.src" est l'erreur
    // naturelle, autant la faire marcher.
    const src = await resolveImage(String(raw), context);
    return src === undefined ? undefined : { src };
  }
  if (isImagePath(path)) {
    return resolveImage(String(raw), context);
  }
  /*
   * Le contrat declare des CHAINES partout ailleurs, et une source JSON sert
   * volontiers un nombre : un `sku: 41` echouerait a la validation sur un
   * « expected string, received number » que personne ne rapporte a la colonne
   * fautive. Les cibles reellement numeriques ou booleennes sont traitees
   * au-dessus, elles ne passent pas ici.
   */
  return typeof raw === "number" || typeof raw === "boolean" ? String(raw) : raw;
}

async function resolveImage(raw: string, context: CoerceContext): Promise<string | undefined> {
  if (context.resolveImage === undefined) {
    return isRemoteRef(raw) ? raw : undefined;
  }
  const resolved = await context.resolveImage(raw);
  if (resolved === undefined && context.strict) {
    throw new Error(`image introuvable : ${raw}`);
  }
  return resolved;
}

/**
 * Ce qui traverse le payload sans etre joint : une URL publique que Chromium
 * chargera, une data URI deja en ligne, une piece jointe deja resolue.
 *
 * Duplique volontairement `isRemoteRef` de collectors/core/assets.ts, qui, lui,
 * vit dans un module qui lit le systeme de fichiers.
 */
export function isRemoteRef(value: string): boolean {
  return /^(https?:\/\/|data:|asset:\/\/)/i.test(value);
}

function isImagePath(path: string): boolean {
  return path === "shop.logo" || path.endsWith(".src");
}

function asRef(value: unknown): string | undefined {
  return isFilled(value) ? String(value) : undefined;
}

function dropImagesWithoutSource(data: Record<string, unknown>): void {
  if (Array.isArray(data.images)) {
    data.images = data.images.filter(
      (image) =>
        image !== null && typeof image === "object" && isFilled((image as { src?: unknown }).src)
    );
  }
  for (const field of ["schema_image", "qr_code"] as const) {
    const value = data[field];
    if (
      value !== undefined &&
      (value === null || typeof value !== "object" || !isFilled((value as { src?: unknown }).src))
    ) {
      delete data[field];
    }
  }
}

// --- Les deux formes d'enregistrement ---------------------------------------

/**
 * Une ligne de CSV, lue par nom de colonne.
 *
 * Les cellules sont ebarbees et une cellule vide vaut `undefined` : c'est LA
 * regle du format, et la mettre ici plutot que dans chaque appelant evite
 * qu'un chemin l'oublie.
 */
export function csvRecord(headers: readonly string[], row: readonly string[]): SourceRecord {
  return {
    read(source) {
      const index = headers.indexOf(source);
      if (index === -1) return undefined;
      const cell = (row[index] ?? "").trim();
      return cell === "" ? undefined : cell;
    },
    // Un CSV n'a pas de valeurs multiples par cellule : c'est le separateur de
    // liste qui joue ce role, et il est traite par la cible.
    readMany: () => null,
  };
}

/** Un objet JSON, lu par chemin — "medias[].url" traverse le tableau. */
export function jsonRecord(item: unknown): SourceRecord {
  return {
    read: (source) => getPath(item, source),
    readMany: (source) => (source.includes("[]") ? getPathMulti(item, source) : null),
  };
}

// --- Aide au reglage ---------------------------------------------------------

/**
 * La cible evidente pour une colonne, ou "" quand il n'y en a pas.
 *
 * UNIQUEMENT l'identite : une colonne deja nommee comme un champ du contrat est
 * mappee sur lui. Aucune table d'alias, et c'est le meme refus que celui du
 * collecteur CSV — deviner que « Description » est `description_html` plutot
 * que `description_short` change le rendu, et rien ne signalerait l'erreur.
 */
export function suggestTarget(source: string): string {
  const path = source.trim();
  if (path === "") return "";
  if (path.startsWith("feature:")) return path;
  // Une expression JSON multiple ("medias[].url") ne peut pas etre sa propre
  // cible : le contrat n'a pas de champ de ce nom.
  if (path.includes("[]")) return "";
  return KNOWN_ROOTS.has(path.split(".")[0]) ? path : "";
}

export type TargetGroup = { group: string; targets: Array<{ path: string; label: string }> };

/**
 * Les cibles proposees a l'ecran.
 *
 * MIROIR MANUEL de src/lib/payload.ts, comme src/lib/variables.ts l'est pour
 * les tokens de template — et distinct de lui : `variables.ts` decrit ce qu'un
 * template peut LIRE, cette liste-ci ce qu'un import peut ECRIRE. Les deux
 * different reellement : `product.price.formatted` se lit mais ne s'ecrit pas
 * (le Studio le calcule), `ref` s'ecrit mais ne se lit pas.
 */
export const TARGET_GROUPS: TargetGroup[] = [
  {
    group: "Pilotage de la fiche",
    targets: [
      { path: "ref", label: "Reference — nom du PDF et cle du lot" },
      { path: "template", label: "Template a utiliser pour cette ligne" },
      { path: "locale", label: "Langue de la fiche" },
    ],
  },
  {
    group: "Produit",
    targets: [
      { path: "product.name", label: "Nom du produit (obligatoire)" },
      { path: "product.sku", label: "Reference commerciale" },
      { path: "product.gtin", label: "Code-barres EAN / GTIN" },
      { path: "product.mpn", label: "Reference fabricant" },
      { path: "product.variant_skus", label: "References des declinaisons (liste, consultation)" },
      { path: "product.supplier_skus", label: "References fournisseur (liste, consultation)" },
      { path: "product.brand", label: "Marque" },
      { path: "product.url", label: "URL de la fiche produit" },
      { path: "product.id", label: "Identifiant technique" },
      { path: "product.category_path", label: "Categories (liste)" },
      { path: "product.description_short", label: "Accroche (texte)" },
      { path: "product.description_html", label: "Description longue (HTML)" },
    ],
  },
  {
    group: "Prix",
    targets: [
      { path: "product.price.amount", label: "Montant — normalise automatiquement" },
      { path: "product.price.currency", label: "Devise (EUR, GBP...)" },
      { path: "product.price.tax_included", label: "Prix TTC (0/1)" },
    ],
  },
  {
    group: "Contenu",
    targets: [
      { path: "features", label: "Caracteristiques PrestaShop (Nom:Valeur:Position)" },
      { path: "badges", label: "Badges (liste)" },
      { path: "images", label: "Images — une colonne, plusieurs valeurs" },
      { path: "images[].src", label: "Images — une valeur par element (JSON)" },
      { path: "images[].legend", label: "Legendes des images (JSON)" },
      { path: "images.0.src", label: "Image principale" },
      { path: "images.0.legend", label: "Legende de l'image principale" },
      { path: "schema_image", label: "Schema cote" },
      { path: "qr_code", label: "QR code" },
    ],
  },
  {
    group: "Boutique",
    targets: [
      { path: "shop.name", label: "Nom de la boutique" },
      { path: "shop.url", label: "URL de la boutique" },
      { path: "shop.logo", label: "Logo" },
      { path: "shop.colors.primary", label: "Couleur principale" },
      { path: "shop.colors.secondary", label: "Couleur secondaire" },
      { path: "shop.company.address", label: "Adresse" },
      { path: "shop.company.phone", label: "Telephone" },
      { path: "shop.company.email", label: "Courriel" },
      { path: "shop.company.legal", label: "Mentions legales" },
    ],
  },
];

/** Les transformations proposees a l'ecran, parmi celles de ./mapping.ts. */
export const TRANSFORMS: Array<{ id: string; label: string }> = [
  { id: "trim", label: "Ebarber les espaces" },
  { id: "html2text", label: "HTML -> texte" },
  { id: "nl2html", label: "Texte -> HTML" },
  { id: "amount", label: "Montant (1 234,56 EUR -> 1234.56)" },
  { id: "minor", label: "Centimes -> unites" },
  { id: "int", label: "Entier" },
  { id: "bool", label: "Booleen" },
  { id: "upper", label: "MAJUSCULES" },
  { id: "lower", label: "minuscules" },
  { id: "first", label: "Premiere valeur" },
];
