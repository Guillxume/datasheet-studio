import { getPath } from "./mapping";

/**
 * Ce qu'il faut savoir d'un fichier avant de pouvoir le mapper : ses colonnes,
 * ses lignes, et de quoi montrer un exemple a l'ecran.
 *
 * Separe de src/lib/importMapping.ts, qui transforme UN enregistrement une fois
 * la table de correspondance connue. Ici on est encore avant : le fichier vient
 * d'etre choisi, personne n'a rien regle, et la seule question est « qu'y a-t-il
 * dedans ? ».
 *
 * Module pur, sans node:* — il tourne dans l'onglet.
 */

/** Profondeur d'exploration d'un JSON. Au-dela, on tombe dans les metadonnees. */
const MAX_DEPTH = 4;
/** Enregistrements inspectes pour decouvrir les chemins. */
const SAMPLE_SIZE = 50;
/** Une liste de colonnes plus longue que ca ne se regle plus a l'ecran. */
const MAX_COLUMNS = 300;

/**
 * Le tableau d'elements dans un JSON quelconque, ou "" quand la racine EST le
 * tableau.
 *
 * Une API sert `[...]`, `{ "items": [...] }`, `{ "data": { "products": [...] } }`
 * — trois formes courantes, aucune canonique. Le chemin trouve reste MODIFIABLE
 * a l'ecran : deviner juste la plupart du temps vaut mieux que demander a chaque
 * fois, mais se tromper sans recours serait pire que ne rien deviner.
 */
export function detectItemsPath(root: unknown, prefix = "", depth = 0): string | null {
  if (Array.isArray(root)) return prefix;
  if (root === null || typeof root !== "object" || depth > MAX_DEPTH) return null;

  const entries = Object.entries(root as Record<string, unknown>);
  // Un tableau d'OBJETS, et non le premier tableau venu : `{ "tags": ["a"],
  // "items": [{...}] }` doit tomber sur items.
  for (const [key, value] of entries) {
    if (Array.isArray(value) && value.some((item) => item !== null && typeof item === "object")) {
      return prefix === "" ? key : `${prefix}.${key}`;
    }
  }
  for (const [key, value] of entries) {
    const found = detectItemsPath(value, prefix === "" ? key : `${prefix}.${key}`, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

export function itemsAt(root: unknown, path: string): unknown[] {
  const value = path === "" ? root : getPath(root, path);
  return Array.isArray(value) ? value : [];
}

/**
 * Les chemins lisibles d'une liste d'objets JSON.
 *
 * PLUSIEURS ENREGISTREMENTS SONT INSPECTES, pas seulement le premier : un
 * catalogue reel a des champs qui n'apparaissent qu'a partir du dixieme produit
 * (une deuxieme image, une metadonnee optionnelle). N'en regarder qu'un
 * priverait le mapping de colonnes qui existent.
 *
 * Un tableau devient "[]" et non ".0" : c'est ce qui permet d'ecrire
 * `medias[].url -> images[].src` une fois pour toutes, au lieu de declarer
 * autant de lignes que d'images.
 */
export function discoverJsonColumns(items: readonly unknown[]): string[] {
  const found = new Set<string>();

  const walk = (value: unknown, prefix: string, depth: number): void => {
    if (found.size >= MAX_COLUMNS || depth > MAX_DEPTH) return;

    if (Array.isArray(value)) {
      const objects = value.filter((item) => item !== null && typeof item === "object" && !Array.isArray(item));
      if (objects.length === 0) {
        // Tableau de scalaires : c'est une valeur, pas une structure.
        if (prefix !== "") found.add(`${prefix}[]`);
        return;
      }
      for (const item of objects.slice(0, 3)) walk(item, `${prefix}[]`, depth + 1);
      return;
    }

    if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const path = prefix === "" ? key : `${prefix}.${key}`;
        walk(child, path, depth + 1);
      }
      return;
    }

    if (prefix !== "") found.add(prefix);
  };

  for (const item of items.slice(0, SAMPLE_SIZE)) walk(item, "", 0);
  return [...found];
}

/**
 * Nom de fichier d'une fiche dans l'archive.
 *
 * Les caracteres interdits par Windows sont remplaces, pas retires : « 40/60 »
 * et « 4060 » sont deux references differentes, et deux fiches distinctes ne
 * doivent pas se retrouver sous le meme nom. Les accents restent — l'archive
 * arme le drapeau UTF-8 (voir src/lib/zip.ts).
 *
 * `taken` recoit le nom retenu : un catalogue ou deux lignes portent la meme
 * reference (mesure sur l'export PrestaShop de reference : cela arrive) perdrait
 * sinon une fiche par ecrasement silencieux dans l'archive.
 */
export function pdfFilename(ref: string, taken: Set<string>): string {
  const base =
    ref
      // Interdits par Windows, plus les espaces : un nom de fiche qui se cite
      // a la main dans un terminal ne devrait pas demander de guillemets.
      .replace(/[\\/:*?"<>|\s]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "")
      .slice(0, 80) || "fiche";

  let name = `${base}.pdf`;
  let suffix = 2;
  while (taken.has(name.toLowerCase())) {
    name = `${base}-${suffix}.pdf`;
    suffix += 1;
  }
  taken.add(name.toLowerCase());
  return name;
}

export type ReportRow = {
  ref: string;
  line: number;
  status: "ok" | "avertissements" | "echec";
  file: string;
  warnings: readonly string[];
  error?: string;
};

/**
 * Le compte rendu joint a l'archive.
 *
 * En CSV et non en texte libre : ce qui interesse apres un lot de plusieurs
 * centaines de fiches, c'est de trier par statut et de retrouver les references
 * a reprendre. Un tableur fait ca, un fichier de log non.
 */
export function buildReportCsv(rows: readonly ReportRow[]): string {
  const cell = (value: string) =>
    /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  const lines = [["ref", "ligne", "statut", "fichier", "avertissements", "erreur"].join(";")];
  for (const row of rows) {
    lines.push(
      [
        cell(row.ref),
        String(row.line),
        row.status,
        cell(row.file),
        cell(row.warnings.join(" | ")),
        cell(row.error ?? ""),
      ].join(";")
    );
  }
  // BOM : sans lui, Excel lit le fichier en page de code locale et abime les
  // accents des avertissements. Le meme defaut que celui que CsvParser corrige
  // en lecture.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/**
 * Index d'un dossier d'images choisi a l'ecran, interroge par ce que le
 * catalogue contient.
 *
 * Deux clefs par fichier — le chemin relatif complet ET le nom seul — parce
 * qu'un export ecrit indifferemment « photos/tpm.jpg » ou « tpm.jpg », et que
 * demander laquelle des deux formes est utilisee serait une question dont la
 * reponse est dans le fichier. La casse est ignoree : un export fait sous
 * Windows et un dossier lu sous Linux ne s'accordent jamais dessus.
 */
export function indexImageFolder(files: readonly File[]): Map<string, File> {
  const index = new Map<string, File>();
  for (const file of files) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    // Le premier segment est le dossier choisi lui-meme : un catalogue qui dit
    // « photos/tpm.jpg » ne le connait pas.
    const withoutRoot = relative.split("/").slice(1).join("/") || relative;
    for (const key of [relative, withoutRoot, file.name]) {
      const normalized = key.toLowerCase();
      if (!index.has(normalized)) index.set(normalized, file);
    }
  }
  return index;
}

export function findImageFile(index: Map<string, File>, raw: string): File | undefined {
  const cleaned = raw.trim().replace(/^\.?\//, "").replace(/\\/g, "/");
  return (
    index.get(cleaned.toLowerCase()) ??
    index.get((cleaned.split("/").pop() ?? "").toLowerCase())
  );
}

/** Cle de piece jointe : elle voyage dans `asset://<cle>` et dans le multipart. */
export function assetKeyFor(raw: string): string {
  const name = raw.trim().replace(/\\/g, "/").split("/").pop() ?? "image";
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "image"
  );
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/**
 * Le type d'une image choisie dans un dossier.
 *
 * `File.type` est renseigne par le navigateur d'apres l'extension, mais il
 * arrive vide — extension inconnue du systeme, fichier sans extension. La route
 * de rendu refuse alors la piece jointe avec un 415 ; le repli sur l'extension
 * evite un echec qui n'apprend rien.
 */
export function imageMime(file: File): string | null {
  if (file.type && Object.values(MIME_BY_EXTENSION).includes(file.type)) return file.type;
  const extension = (file.name.split(".").pop() ?? "").toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? null;
}
