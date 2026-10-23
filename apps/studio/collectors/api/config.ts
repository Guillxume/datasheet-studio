import { readFile } from "node:fs/promises";
import { z } from "zod";

/**
 * Le collecteur d'API generique est DECLARATIF : un fichier de configuration
 * decrit ou taper, comment paginer, et quel champ de la source alimente quel
 * champ du contrat. Brancher un PIM ou un ERP maison ne demande alors pas
 * d'ecrire du TypeScript.
 *
 * DEUX REGLES QUI NE SE NEGOCIENT PAS :
 *
 * 1. Aucun secret dans ce fichier. L'authentification ne nomme que des
 *    VARIABLES D'ENVIRONNEMENT (`token_env`, jamais `token`). Un fichier de
 *    configuration se versionne, se copie, se colle dans un ticket — un jeton
 *    qui y figure finit par fuir.
 * 2. La configuration est validee par zod au chargement. Une faute de frappe
 *    dans un nom de champ se voit avant la premiere requete, pas au 300e
 *    produit.
 */

const authSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("bearer"), token_env: z.string().min(1) }),
  z.object({
    type: z.literal("basic"),
    user_env: z.string().min(1),
    password_env: z.string().min(1),
  }),
  z.object({ type: z.literal("header"), name: z.string().min(1), value_env: z.string().min(1) }),
  z.object({ type: z.literal("query"), param: z.string().min(1), value_env: z.string().min(1) }),
]);

/**
 * Les trois paginations qu'on rencontre reellement, plus l'absence de
 * pagination. `total` est le chemin vers le nombre total d'elements quand
 * l'API le donne : sans lui, on s'arrete sur une page vide ou incomplete, ce
 * qui marche aussi mais interroge une fois de trop.
 */
const paginationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("page"),
    param: z.string().default("page"),
    size_param: z.string().default("per_page"),
    size: z.number().int().positive().default(100),
    start: z.number().int().default(1),
    total: z.string().optional(),
  }),
  z.object({
    type: z.literal("offset"),
    param: z.string().default("offset"),
    size_param: z.string().default("limit"),
    size: z.number().int().positive().default(100),
    total: z.string().optional(),
  }),
  z.object({
    type: z.literal("cursor"),
    param: z.string().default("cursor"),
    /** Chemin, dans la reponse, du curseur de la page suivante. */
    next: z.string().min(1),
    size_param: z.string().default("limit"),
    size: z.number().int().positive().default(100),
  }),
]);

export const apiConfigSchema = z.object({
  name: z.string().default("api"),
  base_url: z.string().min(1),
  auth: authSchema.default({ type: "none" }),
  headers: z.record(z.string(), z.string()).default({}),
  /** Repos entre deux requetes, pour une API qui limite le debit. */
  rate_limit_ms: z.number().int().nonnegative().default(0),

  list: z.object({
    path: z.string().min(1),
    query: z.record(z.string(), z.string()).default({}),
    /** Chemin du tableau dans la reponse. "" si la reponse EST le tableau. */
    items: z.string().default("data"),
    pagination: paginationSchema.default({ type: "none" }),
  }),

  /**
   * Second appel par produit, quand la liste ne sert que des resumes. Les
   * champs de la liste restent lisibles sous `_list` : une API qui ne renvoie
   * la categorie que dans la liste reste exploitable.
   */
  detail: z
    .object({
      path: z.string().min(1),
      id: z.string().default("id"),
      item: z.string().default(""),
    })
    .optional(),

  /** Expression donnant la reference stable. C'est la cle du journal. */
  ref: z.string().default("id"),
  /** Expression donnant une empreinte de fraicheur (un updated_at, un etag). */
  fingerprint: z.string().optional(),
  template: z.string().optional(),
  template_from: z.string().optional(),
  locale: z.string().optional(),
  locale_from: z.string().optional(),

  /** Bloc boutique, si on prefere le tenir ici plutot que dans --shop. */
  shop: z.record(z.string(), z.unknown()).optional(),

  /**
   * Le coeur : chemin CIBLE dans le payload -> expression SOURCE.
   * Une cible qui contient "[]" alimente une liste, element par element.
   */
  map: z.record(z.string(), z.string()),

  /** Rapatrie les images pour les joindre, au lieu de laisser Chromium les charger. */
  download_images: z.boolean().default(false),
});

export type ApiConfig = z.infer<typeof apiConfigSchema>;

export async function loadApiConfig(path: string): Promise<ApiConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (cause) {
    throw new Error(`configuration illisible (${path}) — ${cause instanceof Error ? cause.message : cause}`);
  }

  const parsed = apiConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(racine)"} : ${issue.message}`)
      .join("\n  ");
    throw new Error(`configuration invalide (${path}) :\n  ${issues}`);
  }

  const config = parsed.data;
  const targets = Object.keys(config.map);
  const multiple = targets.filter((target) => target.split("[]").length > 2);
  if (multiple.length > 0) {
    // Deux niveaux de liste demanderaient de decider comment les apparier, et
    // aucune reponse ne serait evidente. Autant le refuser clairement.
    throw new Error(`une cible ne peut contenir qu'un seul "[]" : ${multiple.join(", ")}`);
  }
  return config;
}

/** Le secret vient de l'environnement, jamais du fichier. */
export function readSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`variable d'environnement ${name} absente (nommee par la configuration)`);
  }
  return value;
}
