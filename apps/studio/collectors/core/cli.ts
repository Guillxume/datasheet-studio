import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";
import { shopSchema } from "@/lib/payload";
import { attachFile } from "./assets";
import { StudioClient } from "./client";
import { Journal } from "./journal";
import { TemplateResolver } from "./templateRules";
import type { CollectedAsset, ShopInput, Source } from "./types";

/**
 * Le socle commun aux trois collecteurs : options, environnement, boutique.
 *
 * Les trois se ressemblent par construction — ils ne different que par la
 * source. Tout ce qui n'est pas la lecture de la source vit donc ici, et un
 * quatrieme collecteur n'aura qu'a fournir un `Source`.
 */

type OptionConfig = NonNullable<ParseArgsConfig["options"]>;

export const COMMON_OPTIONS = {
  "studio-url": { type: "string" },
  "studio-key": { type: "string" },
  template: { type: "string" },
  rules: { type: "string" },
  shop: { type: "string" },
  "shop-logo": { type: "string" },
  locale: { type: "string" },
  out: { type: "string" },
  state: { type: "string" },
  budget: { type: "string" },
  limit: { type: "string" },
  concurrency: { type: "string" },
  "max-attempts": { type: "string" },
  "pin-version": { type: "string" },
  report: { type: "string" },
  force: { type: "boolean" },
  "retry-failed": { type: "boolean" },
  forget: { type: "string", multiple: true },
  "dry-run": { type: "boolean" },
  print: { type: "string" },
  quiet: { type: "boolean" },
  help: { type: "boolean", short: "h" },
} as const satisfies OptionConfig;

export const COMMON_HELP = `Options communes
  --studio-url <url>      defaut $STUDIO_URL ou http://localhost:3000
  --studio-key sk_...     defaut $STUDIO_KEY (pnpm issue-key <boutique>)
  --shop <fichier.json>   bloc boutique commun a toutes les fiches
  --shop-logo <fichier>   joint le logo sous asset://logo
  --template <slug>       template par defaut
  --rules <fichier.json>  regles categorie -> template (voir collectors/README.md)
  --locale <fr>           locale de rendu, sert au formatage du prix
  --out <dossier>         ou ecrire les PDF (defaut : pdf/)
  --state <fichier>       journal de reprise (defaut : <out>/.journal.jsonl)
  --budget <90s|5m>       borne de temps du lot ; au-dela, on s'arrete proprement
  --limit <n>             nombre maximal de fiches rendues
  --concurrency <n>       rendus simultanes (defaut 2, plafond serveur 4)
  --max-attempts <n>      echecs consecutifs avant mise en quarantaine (defaut 3)
  --retry-failed          leve les quarantaines avant de commencer
  --forget <ref>          oublie une reference : elle sera refaite (repetable)
  --force                 ignore le cache de fraicheur
  --pin-version <n>       fige le rendu sur une version de template
  --report <fichier.json> ecrit le compte rendu du lot
  --dry-run               construit et valide les payloads sans rien envoyer
  --print <n>             affiche les n premiers payloads produits, puis s'arrete
  --quiet                 n'affiche que le resume
  -h, --help              cette aide`;

export type CommonOptions = {
  studioUrl: string;
  studioKey: string;
  template?: string;
  rules?: string;
  shopFile?: string;
  shopLogo?: string;
  locale: string;
  outDir: string;
  statePath: string;
  budgetMs: number | null;
  limit: number | null;
  concurrency: number;
  maxAttempts: number;
  pinVersion: "published" | number;
  report?: string;
  force: boolean;
  retryFailed: boolean;
  forget: string[];
  dryRun: boolean;
  /** Nombre de payloads a montrer au lieu de rendre. 0 = rendu normal. */
  preview: number;
  quiet: boolean;
};

export type ParsedValues = Record<string, string | boolean | (string | boolean)[] | undefined>;

/**
 * `.env` a la racine, comme les autres scripts hors runtime Next. On ne lit
 * PAS infra/.env : il pointe sur les noms de service Docker, qui ne resolvent
 * pas depuis l'hote, et `loadEnvFile` n'ecrasant pas une variable deja definie,
 * charger les deux ferait silencieusement gagner la configuration Docker.
 */
export function loadEnv(): void {
  if (existsSync(".env") && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env");
  }
}

export function parse<T extends OptionConfig>(options: T, argv = process.argv.slice(2)) {
  try {
    return parseArgs({ args: argv, options: { ...COMMON_OPTIONS, ...options }, allowPositionals: true });
  } catch (cause) {
    // parseArgs dit ce qui ne va pas mais pas ou regarder ensuite.
    fail(`${cause instanceof Error ? cause.message : String(cause)}\n--help liste les options.`);
  }
}

export function parseCommon(values: ParsedValues): CommonOptions {
  loadEnv();

  const dryRun = values["dry-run"] === true;
  const preview = integer(str(values.print), 0) ?? 0;
  const studioKey = str(values["studio-key"]) ?? process.env.STUDIO_KEY ?? "";
  // --print et --dry-run ne parlent jamais au Studio : exiger une cle pour
  // regarder son propre mapping serait un obstacle sans contrepartie.
  if (!studioKey && !dryRun && preview === 0) {
    fail("Cle API absente. Passer --studio-key sk_... ou definir STUDIO_KEY.\nL'emettre avec : pnpm issue-key <slug-boutique>");
  }

  const outDir = str(values.out) ?? "pdf";

  return {
    studioUrl: str(values["studio-url"]) ?? process.env.STUDIO_URL ?? "http://localhost:3000",
    studioKey,
    template: str(values.template),
    rules: str(values.rules),
    shopFile: str(values.shop),
    shopLogo: str(values["shop-logo"]),
    locale: str(values.locale) ?? "fr",
    outDir,
    // Le journal vit AVEC les PDF : deplacer le dossier de sortie sans son
    // journal ferait tout regenerer, et c'est la surprise qu'on evite ici.
    statePath: str(values.state) ?? join(outDir, ".journal.jsonl"),
    budgetMs: duration(str(values.budget)),
    limit: integer(str(values.limit), null),
    concurrency: integer(str(values.concurrency), 2) ?? 2,
    maxAttempts: integer(str(values["max-attempts"]), 3) ?? 3,
    pinVersion: pinned(str(values["pin-version"])),
    report: str(values.report),
    force: values.force === true,
    retryFailed: values["retry-failed"] === true,
    forget: Array.isArray(values.forget) ? (values.forget as string[]) : [],
    dryRun,
    preview,
    quiet: values.quiet === true,
  };
}

/** Tout ce qu'un collecteur doit avoir en main avant de lire sa source. */
export async function prepareRun(options: CommonOptions): Promise<{
  client: StudioClient;
  journal: Journal;
  resolver: TemplateResolver;
  shop: ShopInput | undefined;
  fixedAssets: CollectedAsset[];
}> {
  const client = new StudioClient({
    url: options.studioUrl,
    key: options.studioKey,
    onRetry: (attempt, waitMs, error) => {
      // Dit a l'ecran, sinon une generation qui rame ressemble a une generation
      // qui a plante.
      console.error(`  retentative ${attempt} dans ${Math.round(waitMs / 1000)} s — ${error.describe()}`);
    },
  });

  const journal = await Journal.open(options.statePath);
  if (options.retryFailed) {
    const lifted = await journal.clearFailures();
    if (lifted > 0 && !options.quiet) console.log(`${lifted} quarantaine(s) levee(s)`);
  }
  // Refaire UNE fiche sans regenerer le catalogue : --force est une masse,
  // --forget un tournevis.
  for (const ref of options.forget) {
    await journal.forget(ref);
    if (!options.quiet) console.log(`${ref} oubliee, elle sera refaite`);
  }

  const resolver = await TemplateResolver.load(options.rules, options.template);
  const shop = options.shopFile ? await loadShopFile(options.shopFile) : undefined;

  const fixedAssets: CollectedAsset[] = [];
  let withLogo = shop;
  if (options.shopLogo) {
    // Joint a CHAQUE requete : le Studio ne stocke rien. Pour un catalogue
    // entier, mieux vaut deposer le logo dans la bibliotheque de la boutique
    // depuis l'editeur et le referencer /assets/<boutique>/logo dans le
    // template — l'octet ne voyage alors plus du tout.
    fixedAssets.push(await attachFile(options.shopLogo, "logo"));
    // Sans --shop, la boutique vient de la source (une colonne shop.name) : le
    // logo doit quand meme s'y poser, sinon il serait joint sans etre reference.
    withLogo = { ...(shop ?? {}), logo: "asset://logo" };
  }

  return { client, journal, resolver, shop: withLogo, fixedAssets };
}

/**
 * Le bloc boutique est valide par le MEME schema que celui de la route de
 * rendu : une faute de frappe dans le fichier se voit au premier appel du
 * collecteur, pas au 402e produit.
 */
export async function loadShopFile(path: string): Promise<ShopInput> {
  const parsed = shopSchema.safeParse(JSON.parse(await readFile(path, "utf8")));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(racine)"} : ${issue.message}`)
      .join(" ; ");
    fail(`boutique invalide (${path}) — ${issues}`);
  }
  return parsed.data as ShopInput;
}

/**
 * Montre ce que la source produit, sans rien envoyer.
 *
 * C'est le geste qui evite de chercher une erreur de correspondance dans un
 * arbre zod renvoye en 422 — ou pire, de la decouvrir en relisant 300 PDF.
 * Commun aux trois collecteurs : le doute sur le mapping l'est aussi.
 */
export async function preview(source: Source, count: number): Promise<void> {
  let shown = 0;
  for await (const product of source.list()) {
    console.log(JSON.stringify(product.data, null, 2));
    console.log(`  ref ${product.ref}${product.template ? ` -> ${product.template}` : ""}`);
    for (const warning of product.warnings ?? []) console.log(`  ! ${warning}`);
    if (++shown >= count) break;
  }
  await source.close?.();
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function integer(value: string | undefined, fallback: number | null): number | null {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`valeur entiere positive attendue, recu "${value}"`);
  }
  return parsed;
}

/** "90s", "5m", "2h", ou un nombre nu de secondes. */
export function duration(value: string | undefined): number | null {
  if (value === undefined) return null;
  const match = value.match(/^(\d+)\s*(s|m|h)?$/i);
  if (!match) {
    fail(`duree attendue sous la forme 90s, 5m ou 2h — recu "${value}"`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  return amount * (unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : 1000);
}

function pinned(value: string | undefined): "published" | number {
  if (value === undefined || value === "published") return "published";
  const version = Number(value);
  if (!Number.isInteger(version) || version <= 0) {
    fail(`--pin-version attend un entier positif ou "published", recu "${value}"`);
  }
  return version;
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
