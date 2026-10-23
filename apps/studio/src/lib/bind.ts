import { isValidElement } from "react";

/**
 * Liaison des donnees produit aux props des blocs.
 *
 * Un seul mecanisme de tokens, deux comportements selon que la chaine est
 * EXACTEMENT un token ou non :
 *
 *   "{{features}}"              -> la valeur typee (le tableau lui-meme),
 *                                  ce qui alimente FeatureTable / ImageGallery
 *   "Ref. {{product.sku}}"      -> interpolation dans la chaine
 *
 * Cette distinction evite d'avoir deux systemes (un pour le texte, un pour les
 * collections) et donc deux syntaxes a apprendre dans l'editeur.
 */

const EXACT_TOKEN = /^\{\{\s*([^}]+?)\s*\}\}$/;
const ANY_TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Acces par chemin pointe, avec indices de tableau : "images.0.src".
 *
 * Le segment "last" designe le DERNIER element d'un tableau : "images.last.src".
 *
 * Il manquait, et son absence ne se voyait pas : un indice fixe suppose que
 * toutes les fiches ont le meme nombre d'images. Sur un catalogue reel elles
 * n'en ont pas le meme nombre, et la photo utile a une fiche technique — produit
 * detoure, fond blanc — est celle qu'on ajoute en dernier. "{{images.0.src}}"
 * sait dire « la premiere » ; rien ne savait dire « la derniere », et il n'y a
 * aucun indice fixe qui vaille pour un produit a 4 images et un produit a 6.
 *
 * "last-N" compte a rebours depuis la fin : "images.last-1.src" est
 * l'AVANT-DERNIERE image. Les photos de mise en situation sont ajoutees en fin
 * de liste, par paire : il faut savoir designer les deux sans connaitre le
 * nombre total d'images.
 *
 * RESERVE AUX TABLEAUX : sur un objet, "last" reste une cle ordinaire. Sans
 * cette reserve, un champ custom nomme "last" deviendrait silencieusement
 * illisible le jour ou ce segment a pris un sens.
 */
const FROM_END = /^last(?:-(\d+))?$/;

function getPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc === null || acc === undefined) return undefined;
    if (typeof acc !== "object") return undefined;
    const fromEnd = Array.isArray(acc) ? FROM_END.exec(segment) : null;
    if (fromEnd && Array.isArray(acc)) {
      // Hors bornes, on ne rend rien, comme un indice numerique trop grand : le
      // bloc image traite deja l'absence de source, et une fiche sans image —
      // ou avec une seule, pour "last-1" — ne doit pas casser le rendu.
      const index = acc.length - 1 - Number(fromEnd[1] ?? 0);
      return index < 0 ? undefined : acc[index];
    }
    return (acc as Record<string, unknown>)[segment];
  }, source);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // Un objet ou un tableau interpole dans une chaine est une erreur de
  // template : on rend une chaine vide plutot que "[object Object]" dans un PDF
  // envoye a un client.
  return "";
}

/**
 * Un tableau de noeuds Puck (contenu d'un champ "slot") ne doit jamais etre
 * traverse par le resolveur : c'est de la structure d'arbre, pas de la donnee.
 * transformProps se charge d'y descendre via la config.
 */
function isPuckContent(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as { type?: unknown }).type === "string" &&
        typeof (item as { props?: unknown }).props === "object"
    )
  );
}

export function resolveValue<T>(value: T, data: unknown): unknown {
  // Un element React ou une fonction ne doit jamais etre traverse : il en
  // ressortirait en objet nu, donc irrendable. Le cas se presente dans
  // l'editeur, ou Puck remplace la valeur d'un champ `contentEditable` par un
  // element et expose les slots comme des composants. Le chemin PDF n'en
  // rencontre pas, mais un resolveur qui detruit ce qu'il ne comprend pas est un
  // piege qu'on ne veut pas laisser en place.
  if (typeof value === "function" || isValidElement(value)) {
    return value;
  }

  if (typeof value === "string") {
    const exact = value.match(EXACT_TOKEN);
    if (exact) {
      return getPath(data, exact[1]);
    }
    if (value.includes("{{")) {
      return value.replace(ANY_TOKEN, (_match, path: string) => toText(getPath(data, path.trim())));
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (isPuckContent(value)) return value;
    return value.map((item) => resolveValue(item, data));
  }

  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = resolveValue(inner, data);
    }
    return out;
  }

  return value;
}

