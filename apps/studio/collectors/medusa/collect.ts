import { writeFile } from "node:fs/promises";
import { COMMON_HELP, fail, integer, parse, parseCommon, prepareRun, preview, str } from "../core/cli";
import { run, summarize } from "../core/run";
import { MedusaSource, type MedusaSourceOptions } from "./source";

/**
 * pnpm collect:medusa --medusa-url https://api.exemple.fr --medusa-key sk_...
 */

const HELP = `Collecteur Medusa v2 — une fiche PDF par produit (ou par variante).

  pnpm collect:medusa [options]

Source
  --medusa-url <url>        defaut $MEDUSA_URL
  --mode admin|store        admin (defaut) : brouillons et prix par devise
                            store          : prix calcule pour une region
  --medusa-key sk_...       cle secrete d'administration, defaut $MEDUSA_API_KEY
  --medusa-jwt <jeton>      jeton deja obtenu (Bearer)
  --medusa-email <adresse>  identifiants, echanges contre un JWT
  --medusa-password <mdp>   defaut $MEDUSA_EMAIL / $MEDUSA_PASSWORD
  --publishable-key pk_...  mode store, defaut $MEDUSA_PUBLISHABLE_KEY
  --region-id <reg_...>     mode store : region du prix calcule
  --status <published>      mode admin : statut des produits collectes
  --updated-since <ISO>     ne prend que ce qui a bouge depuis
  --handle <handle>         cible un produit (repetable)
  --id <prod_...>           cible un produit par identifiant (repetable)
  --page-size <50>          taille de page de l'API

Mapping
  --currency <eur>          devise du prix a retenir
  --price-scale decimal|minor  v2 compte en unites ; minor divise par 100
  --tax-included            declare le montant comme TTC (sinon : rien n'est dit)
  --variants first|all      une fiche par produit, ou une par variante
  --store-url <url>         construit product.url : <url>/products/<handle>
  --brand-from collection|type|metadata|none   defaut : collection
  --brand-key <cle>         cle de metadonnee si --brand-from metadata
  --features-from options,metadata             defaut : options
  --no-badges               n'utilise pas les tags comme badges
  --download-images         rapatrie les images et les joint (stockage prive)

${COMMON_HELP}

Notes
  - les images sont laissees en URL par defaut : Chromium les charge au rendu,
    aucun octet ne transite par le collecteur ;
  - les tags deviennent des badges tels quels. Le template les traduit en
    pictos : ce sont des CLES, pas des libelles traduits ;
  - la reference du journal est le SKU de la variante, sinon le handle.

Exemples
  pnpm collect:medusa --medusa-url http://localhost:9000 --medusa-key sk_... \\
    --template fiche-technique-01 --limit 5
  pnpm collect:medusa --mode store --publishable-key pk_... --region-id reg_... \\
    --currency eur --rules regles.json --budget 10m`;

async function main(): Promise<void> {
  const { values } = parse({
    "medusa-url": { type: "string" },
    mode: { type: "string" },
    "medusa-key": { type: "string" },
    "medusa-jwt": { type: "string" },
    "medusa-email": { type: "string" },
    "medusa-password": { type: "string" },
    "publishable-key": { type: "string" },
    "region-id": { type: "string" },
    status: { type: "string" },
    "updated-since": { type: "string" },
    handle: { type: "string", multiple: true },
    id: { type: "string", multiple: true },
    "page-size": { type: "string" },
    currency: { type: "string" },
    "price-scale": { type: "string" },
    "tax-included": { type: "boolean" },
    variants: { type: "string" },
    "store-url": { type: "string" },
    "brand-from": { type: "string" },
    "brand-key": { type: "string" },
    "features-from": { type: "string" },
    "no-badges": { type: "boolean" },
    "download-images": { type: "boolean" },
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  const options = parseCommon(values);

  const url = str(values["medusa-url"]) ?? process.env.MEDUSA_URL;
  if (!url) fail("URL Medusa absente : --medusa-url https://... ou MEDUSA_URL");

  const mode = pick(str(values.mode) ?? "admin", ["admin", "store"], "--mode");
  const publishableKey = str(values["publishable-key"]) ?? process.env.MEDUSA_PUBLISHABLE_KEY;
  if (mode === "store" && !publishableKey) {
    fail("Le mode store exige une cle publiable : --publishable-key pk_... ou MEDUSA_PUBLISHABLE_KEY");
  }
  if (mode === "store" && !str(values["region-id"])) {
    // Sans region, l'API ne calcule pas de prix : les fiches sortiraient toutes
    // sans montant, et le motif serait a chercher longtemps.
    console.error("attention : --mode store sans --region-id, les prix calcules seront absents");
  }

  const sourceOptions: MedusaSourceOptions = {
    url,
    mode,
    ...optional("secretKey", str(values["medusa-key"]) ?? process.env.MEDUSA_API_KEY),
    ...optional("jwt", str(values["medusa-jwt"])),
    ...optional("email", str(values["medusa-email"]) ?? process.env.MEDUSA_EMAIL),
    ...optional("password", str(values["medusa-password"]) ?? process.env.MEDUSA_PASSWORD),
    ...optional("publishableKey", publishableKey),
    ...optional("regionId", str(values["region-id"])),
    ...optional("status", mode === "admin" ? (str(values.status) ?? "published") : undefined),
    ...optional("updatedSince", str(values["updated-since"])),
    ...optional("handles", list(values.handle)),
    ...optional("ids", list(values.id)),
    ...optional("storeUrl", str(values["store-url"])),
    ...(values["tax-included"] === true ? { taxIncluded: true } : {}),
    currency: str(values.currency) ?? "eur",
    priceScale: pick(str(values["price-scale"]) ?? "decimal", ["decimal", "minor"], "--price-scale"),
    variants: pick(str(values.variants) ?? "first", ["first", "all"], "--variants"),
    brandFrom: pick(
      str(values["brand-from"]) ?? "collection",
      ["collection", "type", "metadata", "none"],
      "--brand-from"
    ),
    featuresFrom: (str(values["features-from"]) ?? "options")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "")
      .map((item) => pick(item, ["options", "metadata"], "--features-from")),
    badgesFromTags: values["no-badges"] !== true,
    downloadImages: values["download-images"] === true,
    pageSize: integer(str(values["page-size"]), 50) ?? 50,
    brandMetadataKey: str(values["brand-key"]) ?? "brand",
  };

  const source = new MedusaSource(sourceOptions);
  if (options.preview > 0) {
    await preview(source, options.preview);
    process.exit(0);
  }

  const context = await prepareRun(options);
  const report = await run({ source, options, ...context });

  if (options.report) await writeFile(options.report, JSON.stringify(report, null, 2), "utf8");
  console.log(summarize(report));
  process.exit(report.echecs > 0 || report.stopped_by === "erreur-bloquante" ? 1 : 0);
}

function pick<T extends string>(value: string, allowed: readonly T[], option: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    fail(`${option} attend ${allowed.join(" | ")} — recu "${value}"`);
  }
  return value as T;
}

function list(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.length > 0 ? (value as string[]) : undefined;
}

/** Evite d'ecrire `undefined` dans un champ optionnel, que le mapping relirait. */
function optional<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
