import { writeFile } from "node:fs/promises";
import { shopSchema } from "@/lib/payload";
import { COMMON_HELP, fail, parse, parseCommon, prepareRun, preview } from "../core/cli";
import { mergeShop } from "../core/payload";
import { run, summarize } from "../core/run";
import type { ShopInput } from "../core/types";
import { loadApiConfig } from "./config";
import { ApiSource } from "./source";

/**
 * pnpm collect:api collectors/api/exemple.config.json --template fiche-technique-01
 */

const HELP = `Collecteur d'API JSON — pilote par un fichier de configuration.

  pnpm collect:api <config.json> [options]

La configuration decrit ou taper, comment paginer, et la table CIBLE <- SOURCE.
Voir collectors/api/exemple.config.json et collectors/README.md.

  {
    "name": "pim-interne",
    "base_url": "https://pim.exemple.fr/api/v1",
    "auth": { "type": "bearer", "token_env": "PIM_TOKEN" },
    "list": {
      "path": "/produits",
      "items": "data",
      "pagination": { "type": "page", "size": 100, "total": "meta.total" }
    },
    "ref": "reference",
    "fingerprint": "updated_at",
    "map": {
      "product.name": "libelle",
      "product.sku": "reference",
      "product.price.amount": "tarifs.public | minor",
      "images[].src": "medias[].url"
    }
  }

Aucun secret dans ce fichier : l'authentification ne nomme que des variables
d'environnement (token_env, value_env...), lues au moment de la requete.

Options du collecteur
  --check                 valide la configuration et s'arrete

${COMMON_HELP}

Exemples
  pnpm collect:api pim.json --check
  pnpm collect:api pim.json --print 1
  pnpm collect:api pim.json --template fiche-technique-01 --budget 5m`;

async function main(): Promise<void> {
  const { values, positionals } = parse({ check: { type: "boolean" } });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const config = await loadApiConfig(positionals[0]);
  if (values.check === true) {
    console.log(`configuration valide : ${config.name} -> ${config.base_url}`);
    console.log(`  ${Object.keys(config.map).length} correspondance(s), pagination ${config.list.pagination.type}`);
    process.exit(0);
  }

  const options = parseCommon(values);
  const source = new ApiSource(config);

  if (options.preview > 0) {
    await preview(source, options.preview);
    process.exit(0);
  }

  const context = await prepareRun(options);
  const configShop = config.shop ? parseShop(config.shop, positionals[0]) : undefined;

  const report = await run({
    source,
    options,
    ...context,
    // Le fichier de configuration porte la boutique par defaut ; --shop, qui
    // est plus proche de la ligne de commande, l'emporte champ par champ.
    shop: mergeShop(configShop, context.shop),
  });

  if (options.report) await writeFile(options.report, JSON.stringify(report, null, 2), "utf8");
  console.log(summarize(report));
  process.exit(report.echecs > 0 || report.stopped_by === "erreur-bloquante" ? 1 : 0);
}

function parseShop(raw: unknown, path: string): ShopInput {
  const parsed = shopSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `shop.${issue.path.join(".")} : ${issue.message}`)
      .join(" ; ");
    fail(`bloc shop invalide dans ${path} — ${issues}`);
  }
  return parsed.data as ShopInput;
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
