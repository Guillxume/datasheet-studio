import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { loadEnv } from "./_env";

/**
 * Installe la typographie du Studio : les polices dans la bibliotheque, les
 * tokens dans la feuille de style d'un template.
 *
 * POURQUOI CE SCRIPT. Les deux operations sont faisables a la main — televerser
 * deux fichiers, coller un bloc de CSS dans l'onglet « Feuille de style ». Mais
 * elles doivent etre refaites a l'identique sur chaque environnement et sur
 * chaque nouveau template, et une cle d'asset mal recopiee produit une police
 * qui ne charge pas SANS message d'erreur : le document sort simplement en
 * Arial. Un script rend l'operation reproductible et verifiable.
 *
 * IMPORTS DYNAMIQUES, et ce n'est pas un detail : src/lib/db.ts cree son client
 * postgres a l'import et lit donc DATABASE_URL a ce moment-la. Charger le .env
 * AVANT d'importer est la seule facon de le faire fonctionner hors du runtime
 * Next, qui s'en charge lui-meme. Meme motif que src/lib/render.test.ts.
 *
 * Idempotent : relancer televerse les memes octets (putAsset fait un upsert) et
 * reecrit la meme feuille.
 *
 *   npx tsx scripts/install-typography.ts                      # liste, n'ecrit rien
 *   npx tsx scripts/install-typography.ts --template ma-fiche
 *   npx tsx scripts/install-typography.ts --template ma-fiche --shop acme-staging
 *   npx tsx scripts/install-typography.ts --template ma-fiche --force
 */

type Font = { key: string; file: string; weight: number };

const FONTS: Font[] = [
  /*
   * LES FICHIERS VIVENT DANS public/fonts/, PAS fonts/ : Next sert public/ au
   * navigateur, et ce dossier heberge aussi les polices du back-office lui-
   * meme (voir --font-ui dans src/app/tokens.css). Jost n'est plus l'une
   * d'elles depuis que l'interface est passee a IBM Plex Sans — ces deux
   * fichiers ne servent plus qu'a habiller une fiche imprimee, via ce script.
   *
   * La licence OFL est restee a cote des fichiers, comme elle le doit.
   */
  { key: "jost-400", file: "public/fonts/jost-400.woff2", weight: 400 },
  { key: "jost-500", file: "public/fonts/jost-500.woff2", weight: 500 },
];

/**
 * Feuille posee sur le template.
 *
 * Les valeurs viennent du systeme d'impression valide : rampe neutre chaude,
 * echelle typographique de ratio 1,200 sur une base de 9 pt (le corps deja
 * utilise par le tableau de caracteristiques), echelle d'espacement dont les pas
 * couvrent les valeurs par defaut du registry (3, 4 et 6 mm).
 *
 * Les contrastes annonces sont calcules par la formule de luminance relative,
 * seuils WCAG 2 niveau AA (4,5:1 texte courant, 3:1 texte large et elements
 * graphiques porteurs de sens).
 */
function stylesheet(fonts: Font[]): string {
  const faces = fonts
    .map(
      (font) => `@font-face {
  font-family: "Jost";
  src: url("/assets/shared/${font.key}") format("woff2");
  font-weight: ${font.weight};
  font-style: normal;
  font-display: block;
}`
    )
    .join("\n");

  return `${faces}

:root {
  --font-body: "Jost", Arial, Helvetica, sans-serif;

  /* Primitifs — rampe neutre chaude. Jamais consommes directement. */
  --w-0: #ffffff;  --w-50: #faf8f6;  --w-100: #f2efea; --w-200: #e6e1d9;
  --w-300: #d6cec2; --w-400: #b3a998; --w-500: #8c8272; --w-600: #6b6355;
  --w-700: #4a453b; --w-800: #2e2b25; --w-900: #1a1815;

  /* Semantiques — ce que les champs des blocs consomment. */
  --paper:           var(--w-0);
  --ds-text:         var(--w-800);  /* 14,11:1 sur papier */
  --ds-text-muted:   var(--w-600);  /*  5,93:1 sur papier */
  --ds-text-inverse: var(--w-0);    /*  9,52:1 sur --ds-band */
  --ds-band:         var(--w-700);
  --ds-rule:         var(--w-500);  /* 3,78:1 — filets porteurs de sens */
  --ds-rule-soft:    var(--w-200);  /* decoratif uniquement */
  --ds-stripe:       var(--w-100);  /* zebrage, decoratif */

  /* Typographie — ratio 1,200, base 9 pt. */
  --t-xs: 7.5pt; --t-sm: 9pt; --t-md: 10.8pt; --t-lg: 13pt;
  --t-xl: 15.5pt; --t-2xl: 18.7pt; --t-3xl: 22.4pt;

  /* Espacement (mm). */
  --s-1: 1mm; --s-2: 2mm; --s-3: 3mm; --s-4: 4mm;
  --s-6: 6mm; --s-8: 8mm; --s-12: 12mm; --s-16: 16mm;
}
`;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  // AVANT tout import qui atteint la base : voir l'en-tete.
  loadEnv();

  const { putAsset } = await import("../src/lib/assetStore");
  const { listAllTemplates, getTemplateBySlug, getDraft, saveDraft } = await import(
    "../src/lib/repository"
  );

  const slug = arg("template");
  const shop = arg("shop") ?? null;
  const force = process.argv.includes("--force");

  if (!slug) {
    const templates = await listAllTemplates();
    console.log("Templates disponibles :\n");
    for (const row of templates) {
      const where = row.shop_slug ?? "bibliotheque partagee";
      console.log(`  --template ${row.slug}${row.shop_slug ? ` --shop ${row.shop_slug}` : ""}`);
      console.log(`      ${row.name}  (${where}, brouillon v${row.draft_version})`);
    }
    console.log("\nAucune modification effectuee : relancer avec --template.");
    return;
  }

  const template = await getTemplateBySlug(slug, shop);
  if (!template) {
    throw new Error(
      `Template introuvable : ${slug}${shop ? ` (boutique ${shop})` : " (bibliotheque partagee)"}. ` +
        "Relancer sans --template pour voir la liste."
    );
  }

  // 1. Les polices. La bibliotheque partagee ("shared") plutot que la boutique :
  //    une police sert a tous les templates, la dupliquer par boutique creerait
  //    autant de copies a maintenir.
  for (const font of FONTS) {
    const path = resolve(process.cwd(), font.file);
    const data = readFileSync(path);
    const result = await putAsset("shared", font.key, "font/woff2", data, basename(path));

    if (!result.ok) {
      throw new Error(`Televersement de ${font.key} refuse : ${result.error}`);
    }
    console.log(`police  ${font.key.padEnd(10)} ${String(data.length).padStart(6)} octets  -> ${result.asset.url}`);
  }

  // 2. La feuille de style.
  const draft = await getDraft(template.id);
  const existing = (draft.css ?? "").trim();

  if (existing.length > 0 && !force) {
    console.error(
      `\nLe template « ${template.name} » a deja une feuille de style ` +
        `(${existing.length} caracteres). Elle n'a PAS ete touchee.\n` +
        "Relancer avec --force pour la remplacer, ou coller les tokens a la main " +
        "dans l'onglet « Feuille de style » de l'editeur."
    );
    process.exitCode = 1;
    return;
  }

  const version = await saveDraft(template.id, { ...draft, css: stylesheet(FONTS) });

  console.log(`\nfeuille de style ecrite sur « ${template.name} » (brouillon v${version}).`);
  console.log("Elle n'est pas publiee : ouvrir l'editeur, verifier l'apercu, puis publier.");
}

main()
  // `process.exitCode` et non 0 en dur : le refus d'ecraser une feuille
  // existante le positionne a 1, et un `process.exit(0)` l'effacerait — un
  // enchainement de commandes conclurait a une reussite alors que rien n'a ete
  // ecrit. Sortir explicitement reste necessaire : le client postgres garde des
  // connexions ouvertes qui retiendraient le processus.
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
