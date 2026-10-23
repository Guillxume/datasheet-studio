import { loadEnv } from "./_env";
import { BODY, HEADER, FOOTER, CSS, NAME, SLUG } from "./default-template";

/**
 * Installe la fiche produit simple (template par defaut).
 *
 *   npx tsx scripts/install-default-template.ts                         # liste, n'ecrit rien
 *   npx tsx scripts/install-default-template.ts --bibliotheque
 *   npx tsx scripts/install-default-template.ts --shop ma-boutique --slug autre-slug
 *   npx tsx scripts/install-default-template.ts --bibliotheque --mettre-a-jour
 *
 * Ce script CREE, il n'ecrase jamais : relance sur un slug existant, il refuse —
 * sauf avec --mettre-a-jour, qui remplace le seul brouillon.
 * Pour retoucher un template deja installe, passer par l'editeur — c'est lui qui
 * versionne.
 *
 * IL N'ECRIT PAS LA FEUILLE DE STYLE PAR-DESSUS UNE EXISTANTE. Une police
 * installee par `pnpm typo` vit dans le meme champ ; l'ecraser la ferait
 * perdre en silence. Quand une feuille est deja presente, la feuille du
 * template est ajoutee A LA SUITE, ses jetons `--dt-*` etant declares dans un
 * `:root` qui ne peut rien casser de ce qui precede.
 *
 * A FAIRE APRES : publier depuis l'editeur. Un template sans version publiee
 * n'est pas selectionnable par le module — l'API repond 404, et la liste des
 * templates le remonte avec `selectable: false`.
 */

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

/** Un drapeau sans valeur : sa seule presence compte, `arg` renverrait undefined. */
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  loadEnv();

  const { listAllTemplates, getTemplateBySlug, createTemplate, getDraft, saveDraft } =
    await import("../src/lib/repository");

  const shop = arg("shop") ?? null;
  const slug = arg("slug") ?? SLUG;
  const name = arg("name") ?? NAME;

  if (!shop && !flag("bibliotheque")) {
    const templates = await listAllTemplates();
    console.log("Templates existants :\n");
    for (const row of templates) {
      console.log(`  ${row.slug}${row.shop_slug ? `  (${row.shop_slug})` : "  (bibliotheque)"}`);
    }
    console.log(
      "\nAucune modification effectuee.\n" +
        "  --shop <slug-boutique>   installe la fiche pour cette boutique\n" +
        "  --bibliotheque           installe dans la bibliotheque commune"
    );
    return;
  }

  const existing = await getTemplateBySlug(slug, shop);
  if (existing && flag("mettre-a-jour")) {
    // Remplace le BROUILLON seulement : la version publiee reste servie tant
    // qu'on ne republie pas depuis l'editeur, qui versionne.
    const draft = await getDraft(existing.id);
    const css = (draft.css ?? "").trim();
    // La feuille du template est ajoutee en dernier a l'installation : on la
    // retire de sa premiere declaration a la fin, et on garde ce qui precede
    // (une police installee par `pnpm typo`).
    const debut = css.indexOf(":root {\n  --dt-ink");
    const avant = (debut === -1 ? css : css.slice(0, debut)).trim();
    const version = await saveDraft(existing.id, {
      ...draft,
      body: BODY,
      header: HEADER,
      footer: FOOTER,
      css: avant === "" ? CSS : `${avant}\n\n${CSS}`,
    });
    console.log(`brouillon remplace  ${slug} — v${version}`);
    console.log("\nA FAIRE : ouvrir le template dans l'editeur, controler l'apercu, PUBLIER.");
    return;
  }
  if (existing) {
    throw new Error(
      `Un template « ${slug} » existe deja${shop ? ` pour ${shop}` : " dans la bibliotheque"}. ` +
        "Choisir un autre --slug, ou --mettre-a-jour pour remplacer son brouillon."
    );
  }

  // createTemplate RENVOIE l'erreur au lieu de la lever : une boutique inconnue
  // passerait sinon pour une reussite, et l'appel suivant echouerait sur un
  // identifiant absent avec un message sans rapport.
  const created = await createTemplate(slug, name, shop);
  if ("error" in created) {
    throw new Error(created.error);
  }

  const draft = await getDraft(created.id);
  const existante = (draft.css ?? "").trim();

  const version = await saveDraft(created.id, {
    ...draft,
    body: BODY,
    header: HEADER,
    footer: FOOTER,
    css: existante === "" ? CSS : `${existante}\n\n${CSS}`,
  });

  console.log(`template cree       ${slug}${shop ? ` (${shop})` : " (bibliotheque)"} — brouillon v${version}`);
  console.log(`                    ${name}`);
  if (existante !== "") {
    console.log("feuille de style    jetons --dt-* ajoutes a la suite de la feuille existante");
  }
  console.log("\nA FAIRE : ouvrir le template dans l'editeur et PUBLIER.");
  console.log("Tant qu'aucune version n'est publiee, le module ne peut pas le selectionner.");
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
