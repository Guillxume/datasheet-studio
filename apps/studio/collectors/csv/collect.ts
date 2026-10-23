import { readFile, writeFile } from "node:fs/promises";
import { COMMON_HELP, fail, parse, parseCommon, prepareRun, preview, str } from "../core/cli";
import { run, summarize } from "../core/run";
import { CsvSource, parseFilter } from "./source";

/**
 * pnpm collect:csv catalogue.csv --template fiche-technique-01
 *
 * Le collecteur le plus court a mettre en oeuvre : un export de catalogue, un
 * dossier d'images, et des PDF en sortie. Il sert aussi de banc d'essai a un
 * template avant de brancher la vraie source.
 */

const HELP = `Collecteur CSV — rend une fiche PDF par ligne.

  pnpm collect:csv <fichier.csv> [options]

L'en-tete de colonne est le CHEMIN du champ dans le payload :

  ref;product.name;product.sku;product.price.amount;images.0.src;feature:Capacite@Q
  TPM-2500;Transpalette 2500 kg;TPM-2500;489,00;photos/tpm.jpg;2500 kg

  - une cellule vide vaut « champ absent », pas « champ vide » ;
  - un chemin d'image local est JOINT a la requete, une URL https traverse ;
  - badges et product.category_path sont des listes (separateur --list-sep) ;
  - les colonnes ref, template et locale pilotent la fiche, pas son contenu.

Options du collecteur
  --mapping <fichier.json>  { "Reference": "product.sku", ... } pour un export subi
                            une cible accepte une transformation :
                            "Resume": "product.description_short | html2text"
  --where "Col=valeur"      ne garde que ces lignes (repetable, != accepte)
  --ref-column <nom>        colonne portant la reference (defaut : ref)
  --features <fichier.csv>  caracteristiques en format long : ref;name;value;abbreviation;group
  --features-column <nom>   colonne portant TOUTE la liste, au format PrestaShop
                            Nom:Valeur:Position (equivaut a la mapper sur "features")
  --no-merge-features       garde une ligne par valeur au lieu de "a / b / c"
  --assets-dir <dossier>    racine des chemins d'image (defaut : dossier du CSV)
  --delimiter <;>           force le separateur (detecte sinon)
  --list-sep <|>            separateur des listes dans une cellule
  --strict                  une image introuvable fait echouer la ligne

${COMMON_HELP}

Exemples
  pnpm collect:csv collectors/csv/exemple.csv --dry-run --template fiche-technique-01
  pnpm collect:csv catalogue.csv --shop boutique.json --rules regles.json --budget 5m

Export produits PrestaShop (colonnes francaises, caracteristiques en une colonne) :
  pnpm collect:csv export.csv \\
    --mapping collectors/csv/prestashop.mapping.json \\
    --list-sep , --where "Actif (0/1)=1" \\
    --shop boutique.json --rules regles.json --print 1`;

async function main(): Promise<void> {
  const { values, positionals } = parse({
    mapping: { type: "string" },
    "ref-column": { type: "string" },
    features: { type: "string" },
    "assets-dir": { type: "string" },
    delimiter: { type: "string" },
    "list-sep": { type: "string" },
    "features-column": { type: "string" },
    "no-merge-features": { type: "boolean" },
    where: { type: "string", multiple: true },
    strict: { type: "boolean" },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const options = parseCommon(values);
  const mapping = str(values.mapping)
    ? (JSON.parse(await readFile(str(values.mapping) as string, "utf8")) as Record<string, string>)
    : undefined;

  const filters = (Array.isArray(values.where) ? (values.where as string[]) : []).map(parseFilter);

  const source = new CsvSource({
    file: positionals[0],
    ...(str(values.delimiter) ? { delimiter: str(values.delimiter) } : {}),
    ...(mapping ? { mapping } : {}),
    ...(str(values["ref-column"]) ? { refColumn: str(values["ref-column"]) } : {}),
    ...(str(values.features) ? { featuresFile: str(values.features) } : {}),
    ...(str(values["assets-dir"]) ? { assetsDir: str(values["assets-dir"]) } : {}),
    ...(str(values["features-column"]) ? { featuresColumn: str(values["features-column"]) } : {}),
    ...(filters.length > 0 ? { filters } : {}),
    mergeFeatures: values["no-merge-features"] !== true,
    listSeparator: str(values["list-sep"]) ?? "|",
    strict: values.strict === true,
  });

  if (options.preview > 0) {
    await preview(source, options.preview);
    report(source);
    process.exit(0);
  }

  const context = await prepareRun(options);
  const runReport = await run({ source, options, ...context });

  if (options.report) await writeFile(options.report, JSON.stringify(runReport, null, 2), "utf8");
  console.log(summarize(runReport));
  report(source);

  // Code de sortie exploitable par un cron : une fiche en echec doit se voir
  // dans le systeme de supervision, pas seulement dans la sortie standard.
  process.exit(runReport.echecs > 0 || runReport.stopped_by === "erreur-bloquante" ? 1 : 0);
}

/** Ce que le fichier portait et que la fiche n'a pas recu. */
function report(source: CsvSource): void {
  if (source.filtered > 0) {
    console.log(`  ${source.filtered} ligne(s) ecartee(s) par --where`);
  }
  if (source.ignored.length > 0) {
    const shown = source.ignored.slice(0, 6).join(", ");
    const rest = source.ignored.length > 6 ? `, +${source.ignored.length - 6}` : "";
    console.log(`  ${source.ignored.length} colonne(s) non utilisee(s) : ${shown}${rest}`);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
