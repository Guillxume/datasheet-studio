/**
 * L'import de produits dans un book : retrouver des fiches a partir d'un texte
 * colle — module pur, sans base ni reseau. La lecture de l'index est dans
 * datasheetsStore.ts (supplierRefMatches), la route dans
 * src/app/api/consultation/import/route.ts.
 *
 * LE TEXTE N'A PAS DE FORME. On colle les lignes d'un devis, un bloc de tableur,
 * un courriel : nom du produit, quantite, prix, remise, dans n'importe quel
 * ordre. Plutot que de deviner des colonnes, chaque ligne est decoupee en
 * morceaux, et seuls ceux qui sont EXACTEMENT une reference fournisseur connue
 * de la boutique comptent.
 *
 * LES REFERENCES FOURNISSEUR SEULEMENT (retour du 21/10/2026). La reference
 * produit d'une boutique vaut souvent son identifiant (« 187 » chez Acme) : une
 * quantite ou un prix colle avec le reste tomberait dessus. Une reference
 * fournisseur est assez distinctive pour qu'un morceau qui lui est egal soit
 * bien elle.
 *
 * LES PACKAGES (retour du 21/10/2026). Une reference fournisseur peut etre un
 * ensemble de references : « {109445:1,109417:1,105652:1} » — plateau,
 * pietement, goulotte, avec leurs quantites. Dans une copie de travail de la
 * base Acme (acme-staging, mai 2026), c'etait le cas de 5 378 des 8 115
 * references, et 110 produits n'avaient QUE des packages. Un devis
 * ne cite jamais la chaine du package : il liste ses references une a une. Un
 * package est donc reconnu quand TOUTES ses references figurent dans le collage,
 * a n'importe quelle ligne. Une seule ne suffit pas : le pietement 105652 entre
 * dans des dizaines de bureaux, et les ferait tous venir.
 *
 * LE PLUS GRAND PACKAGE L'EMPORTE. Les composants d'un package sont souvent
 * vendus seuls : un vestiaire « {103655:1,102607:1,103448:9} » fait venir, a la
 * lettre, « Pieds Inox » (102607) et « Serrure a code » (103448), qui ont leur
 * fiche. Mesure sur 200 devis tires de cette copie : 345 fiches en trop pour
 * 1 007 attendues. Ce qui est entierement compris dans un package plus grand du
 * collage est donc ecarte — et nomme dans le rapport, pour rester rattrapable.
 *
 * CE QUI PEUT SE TROMPER EN SILENCE, ET QUE LES TESTS TIENNENT : une ligne
 * reconnue deux fois qui ajoute deux fois la fiche, une reference partagee par
 * deux produits dont l'un disparait sans un mot, une ligne sans reference qui
 * n'apparait nulle part dans le rapport, un package tronque qui ne serait jamais
 * complet.
 */

/** Au-dela, ce n'est plus un devis : la page le dit plutot que de mouliner. */
export const MAX_IMPORT_CHARS = 200_000;
export const MAX_IMPORT_LINES = 2_000;

/**
 * Un morceau plus court n'est pas cherche : « 1 », « 12 », « HT » sont des
 * quantites, des prix, des mots — jamais assez distinctifs pour designer un
 * produit, meme si une reference fournisseur aberrante leur etait egale.
 */
const MIN_CANDIDATE = 3;
/** Une reference fournisseur peut contenir des espaces : jusqu'a trois morceaux voisins sont recolles. */
const MAX_WORDS = 3;

/** Ponctuation qui colle a une reference sans en faire partie : « Ref: 109423, », « (109423) ». */
const LEADING = /^[("'«“[{<]+/;
const TRAILING = /[)"'»”\]}>,.;:!?]+$/;

export type ImportLine = { no: number; text: string; candidates: string[] };

/** Forme sous laquelle une reference est comparee : sans casse, espaces reduits. */
export function normalizeRef(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Les morceaux d'une ligne qui pourraient etre une reference fournisseur, deja
 * normalises : chaque morceau tel quel et sans sa ponctuation de bord, puis les
 * groupes de deux et trois morceaux voisins.
 *
 * Les separateurs sont ceux d'un collage : espaces, tabulations (tableur),
 * points-virgules et barres (CSV). PAS la virgule, qui separe les decimales
 * d'un prix et figure dans certaines references (« {109423:1,105651:1} »).
 */
export function candidates(line: string): string[] {
  const words = line.split(/[\s;|]+/).filter((word) => word !== "");
  const found = new Set<string>();
  const add = (value: string) => {
    const ref = normalizeRef(value);
    if (ref.length >= MIN_CANDIDATE) found.add(ref);
  };

  for (const word of words) {
    add(word);
    add(word.replace(LEADING, "").replace(TRAILING, ""));
  }
  for (let size = 2; size <= MAX_WORDS; size++) {
    for (let start = 0; start + size <= words.length; start++) add(words.slice(start, start + size).join(" "));
  }
  return [...found];
}

/** Caracteres invisibles qu'un traitement de texte ou un PDF glisse dans un copier-coller. */
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

/** Les lignes non vides du collage, numerotees comme dans la saisie. */
export function importLines(text: string): ImportLine[] {
  return text
    .replace(INVISIBLE, "")
    .split(/\r?\n/)
    .map((raw, index) => ({ no: index + 1, text: raw.trim() }))
    .filter((line) => line.text !== "")
    .slice(0, MAX_IMPORT_LINES)
    .map((line) => ({ ...line, candidates: candidates(line.text) }));
}

/**
 * Les references d'un package, ou null si la reference n'en est pas un.
 *
 * Un package est entre accolades, chaque reference suivie de sa quantite :
 * « {109445:1,109417:1,105652:2} ». Les quantites ne comptent pas — un devis
 * peut tres bien en commander deux.
 *
 * PRESTASHOP TRONQUE A 64 CARACTERES (product_supplier_reference). Un package de
 * six references arrive sans accolade fermante, parfois coupe au milieu de la
 * derniere : « {103535:1,102608:1,1034 ». Ce dernier morceau, sans sa quantite,
 * n'est pas une reference — le garder rendrait le package impossible a
 * completer. Il est ecarte ; le package est alors reconnu sur ce qu'il en reste.
 *
 * L'ACCOLADE OUVRANTE EST EXIGEE. Une reference simple peut contenir un
 * deux-points (« ABC:12 ») et ne doit pas etre lue comme un package d'une
 * reference. Et une fin de package sans son debut (« ,122815:1} »,
 * « 106354:1} » — relevees dans la copie de travail, absentes de la production,
 * mais rien n'empeche de les saisir) ne dit pas de quoi le package est fait : la
 * lire comme un package d'un seul accessoire ferait venir l'armoire entiere des
 * que cet accessoire est cite. Elle reste une reference simple, qu'aucun devis
 * ne reproduira.
 */
export function packageParts(ref: string): string[] | null {
  const value = ref.trim();
  if (!value.startsWith("{")) return null;
  const pieces = value.replace(/^\{+|\}+$/g, "").split(",").map((piece) => piece.trim());
  if (!value.endsWith("}") && pieces.length > 0 && !pieces[pieces.length - 1].includes(":")) pieces.pop();
  const parts = pieces.map((piece) => piece.split(":")[0].trim()).filter((part) => part !== "");
  return [...new Set(parts)];
}

/** Une reference fournisseur de l'index et la fiche qui la porte (une ligne de supplierRefMatches). */
export type RefMatch = {
  /** La reference telle que l'index la garde, pour l'afficher. */
  ref: string;
  /** Valeur de selection : « <langue>:<cle> ». */
  value: string;
  name: string;
  productId: string;
  category: string;
  locale: string;
  /** null : la boutique n'a pas transmis l'adresse de la fiche, elle ne peut entrer dans un book. */
  url: string | null;
};

export type ImportedFiche = Omit<RefMatch, "ref" | "url"> & {
  url: string;
  /** Les references (simples ou packages) qui l'ont fait venir, et les lignes ou elles figuraient. */
  refs: string[];
  lines: number[];
};

export type ImportReport = {
  /** Dans l'ordre du collage, chaque fiche une seule fois. */
  fiches: ImportedFiche[];
  /** Une reference portee par plusieurs produits : tous sont ajoutes, et on le dit. */
  ambiguous: { line: number; ref: string; names: string[] }[];
  /** Reconnues, mais sans adresse de fiche : elles ne peuvent pas entrer dans le book. */
  withoutLink: { line: number; ref: string; name: string }[];
  /**
   * Reconnues, mais entierement comprises dans un package plus grand du collage
   * (`within` : le produit de ce package) : ecartees, a ajouter a la main si le
   * devis les vendait vraiment a part.
   */
  included: { value: string; refs: string[]; name: string; within: string }[];
  /**
   * Aucune reference fournisseur reconnue sur ces lignes. `partial` : la ligne
   * cite des references de packages dont aucun n'est complet dans le collage —
   * c'est presque toujours une reference manquante ailleurs dans le devis.
   */
  unmatched: { line: number; text: string; partial?: { parts: string[]; packages: number } }[];
  /** Nombre de lignes lues (non vides). */
  lineCount: number;
};

/**
 * Le rapport d'import, a partir des lignes et des references de l'index qui ont
 * pu repondre (supplierRefMatches : egalite, ou package dont une reference est
 * citee — c'est ici qu'on exige qu'il soit complet).
 *
 * UNE REFERENCE PORTEE PAR PLUSIEURS PRODUITS LES AJOUTE TOUS. En retirer un
 * dans le book coute un clic ; deviner lequel etait voulu, et se tromper,
 * produirait un book faux sans que rien ne le signale.
 */
export function resolveImport(lines: ImportLine[], rows: readonly RefMatch[]): ImportReport {
  const pasted = new Set(lines.flatMap((line) => line.candidates));
  const linesWith = (keys: string[]) =>
    lines.filter((line) => keys.some((key) => line.candidates.includes(key))).map((line) => line.no);

  // Ce qui repond, et sur quelles lignes : la reference elle-meme si elle est
  // collee telle quelle, ou toutes les references d'un package complet.
  const hits: { row: RefMatch; key: string; lines: number[] }[] = [];
  const incomplete: string[][] = [];
  for (const row of rows) {
    const key = normalizeRef(row.ref);
    const parts = packageParts(row.ref)?.map(normalizeRef) ?? null;
    if (pasted.has(key)) {
      hits.push({ row, key, lines: linesWith([key]) });
    } else if (parts !== null && parts.length > 0 && parts.every((part) => pasted.has(part))) {
      hits.push({ row, key, lines: linesWith(parts) });
    } else if (parts !== null) {
      incomplete.push(parts);
    }
  }
  // Dans l'ordre du collage : la premiere ligne ou chaque reference repond.
  hits.sort((a, b) => a.lines[0] - b.lines[0]);

  const report: ImportReport = {
    fiches: [],
    ambiguous: [],
    withoutLink: [],
    included: [],
    unmatched: [],
    lineCount: lines.length,
  };

  // Le plus grand package l'emporte : une reponse dont les references sont
  // TOUTES dans celles d'une reponse plus grande est ecartee. Strictement plus
  // grande — deux bureaux qui partagent un pietement restent tous les deux, et
  // deux produits au meme package restent « ambigus ».
  const partsOf = (hit: (typeof hits)[number]) => new Set(packageParts(hit.row.ref)?.map(normalizeRef) ?? [hit.key]);
  const sets = new Map(hits.map((hit) => [hit, partsOf(hit)]));
  const wider = (hit: (typeof hits)[number]) => {
    const mine = sets.get(hit)!;
    let best: (typeof hits)[number] | null = null;
    for (const other of hits) {
      const theirs = sets.get(other)!;
      if (theirs.size > mine.size && [...mine].every((part) => theirs.has(part))) {
        if (best === null || theirs.size > sets.get(best)!.size) best = other;
      }
    }
    return best;
  };
  const kept = hits.filter((hit) => {
    const within = wider(hit);
    if (within === null) return true;
    const known = report.included.find((item) => item.value === hit.row.value);
    if (!known) report.included.push({ value: hit.row.value, refs: [hit.row.ref], name: hit.row.name, within: within.row.name });
    else if (!known.refs.includes(hit.row.ref)) known.refs.push(hit.row.ref);
    return false;
  });
  const productOf = (value: string) => value.slice(value.indexOf(":") + 1);

  const byKey = new Map<string, typeof hits>();
  for (const hit of kept) byKey.set(hit.key, [...(byKey.get(hit.key) ?? []), hit]);
  for (const group of byKey.values()) {
    if (new Set(group.map((hit) => productOf(hit.row.value))).size > 1) {
      report.ambiguous.push({
        line: Math.min(...group.map((hit) => hit.lines[0])),
        ref: group[0].row.ref,
        names: [...new Set(group.map((hit) => hit.row.name))],
      });
    }
  }
  report.ambiguous.sort((a, b) => a.line - b.line);

  const fiches = new Map<string, ImportedFiche>();
  const missingLink = new Set<string>();
  for (const { row, lines: at } of kept) {
    if (row.url === null) {
      if (!missingLink.has(row.value)) {
        missingLink.add(row.value);
        report.withoutLink.push({ line: at[0], ref: row.ref, name: row.name });
      }
      continue;
    }
    const known = fiches.get(row.value);
    if (known) {
      if (!known.refs.includes(row.ref)) known.refs.push(row.ref);
      for (const no of at) if (!known.lines.includes(no)) known.lines.push(no);
      known.lines.sort((a, b) => a - b);
      continue;
    }
    fiches.set(row.value, {
      value: row.value,
      name: row.name,
      productId: row.productId,
      category: row.category,
      locale: row.locale,
      url: row.url,
      refs: [row.ref],
      lines: [...at],
    });
  }
  // Une fiche venue par un package ET ecartee par un autre n'est pas « ecartee ».
  report.fiches = [...fiches.values()];
  report.included = report.included.filter((item) => !fiches.has(item.value));

  const covered = new Set(kept.flatMap((hit) => hit.lines));
  for (const line of lines) {
    if (covered.has(line.no)) continue;
    const packages = incomplete.filter((parts) => parts.some((part) => line.candidates.includes(part)));
    const parts = [...new Set(packages.flatMap((pkg) => pkg.filter((part) => line.candidates.includes(part))))];
    report.unmatched.push(
      packages.length > 0
        ? { line: line.no, text: line.text, partial: { parts, packages: packages.length } }
        : { line: line.no, text: line.text }
    );
  }
  return report;
}
