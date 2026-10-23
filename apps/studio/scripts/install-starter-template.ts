import { loadEnv } from "./_env";

/**
 * Installe un template de depart : « Fiche paysage — bandeau lateral ».
 *
 * POURQUOI CE SCRIPT EXISTE. Une fiche se composait jusqu'ici depuis un canvas
 * vide, bloc par bloc, a chaque produit. Or une mise en page reussie n'est pas
 * une suite de reglages a retrouver : c'est une structure. Ce template pose la
 * structure — bandeau lateral pleine hauteur, colonne de contenu, filet de
 * liaison, tableau de caracteristiques — et laisse a regler ce qui varie
 * vraiment d'une fiche a l'autre.
 *
 * IL CONSOMME LES TOKENS de la feuille de style installee par
 * install-typography.ts : `var(--ds-band)`, `var(--ds-text-inverse)`,
 * `var(--ds-rule-soft)`, `var(--ds-stripe)`. Sans cette feuille, les blocs
 * s'affichent sans leurs couleurs — ce n'est pas une erreur silencieuse, c'est
 * visible du premier coup d'oeil, et le script le rappelle.
 *
 * TOKENS DE DONNEES : uniquement ceux du vocabulaire reel, verifies contre
 * src/lib/sampleData.ts. Aucun nom invente — un token qui ne resout rien produit
 * un bloc vide dans le PDF, ce que l'editeur ne montre qu'en mode Apercu.
 *
 *   npx tsx scripts/install-starter-template.ts             # liste, n'ecrit rien
 *   npx tsx scripts/install-starter-template.ts --slug fiche-paysage
 *   npx tsx scripts/install-starter-template.ts --slug fiche-paysage --shop ma-boutique
 */

let counter = 0;
const id = (type: string) => `${type.toLowerCase()}-${++counter}`;

/** Un noeud Puck. L'identifiant est obligatoire et doit etre unique dans l'arbre. */
const node = (type: string, props: Record<string, unknown>) => ({
  type,
  props: { id: id(type), ...props },
});

/**
 * Geometrie : A4 PAYSAGE, a fond perdu.
 *
 * Les marges papier et le retrait du contenu sont a zero, faute de quoi le
 * bandeau lateral s'arreterait avant le bord de la page et laisserait une bande
 * blanche qui trahit la composition. Le retrait est porte par le panneau de
 * contenu, qui est le seul a en avoir besoin.
 */
const ROOT = {
  pageWidth: 297,
  pageHeight: 210,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  padding: 0,
  paddingRight: 0,
  blockGap: 0,
};

/** Colonne de gauche : identification du produit, sur un aplat pleine hauteur. */
const SIDEBAR = node("Panel", {
  background: "var(--ds-band)",
  color: "var(--ds-text-inverse)",
  backgroundImage: "",
  backgroundSize: "cover",
  backgroundPosition: "center",
  borderWidth: 0,
  borderColor: "",
  padding: 8,
  radius: 0,
  align: "left",
  contentGap: 5,
  height: 0,
  // Le reglage qui rend le bandeau possible : sans lui, l'aplat s'arrete au
  // dernier mot ecrit au lieu de descendre jusqu'en bas de la rangee.
  fillHeight: true,
  verticalAlign: "start",
  avoidBreak: false,
  content: [
    node("Heading", {
      text: "{{product.brand}}",
      level: "h3",
      size: 9,
      align: "left",
      // Explicite, et non herite : la couleur par defaut d'un titre est la
      // couleur primaire de la boutique, illisible sur cet aplat sombre.
      color: "var(--ds-text-inverse)",
      uppercase: true,
      underline: false,
      background: "",
      padding: 0,
    }),
    node("Divider", {
      orientation: "horizontal",
      thickness: 1,
      color: "var(--ds-rule-soft)",
      margin: 1,
      length: 0,
    }),
    node("Heading", {
      text: "{{product.name}}",
      level: "h1",
      size: 15.5,
      align: "left",
      color: "var(--ds-text-inverse)",
      uppercase: true,
      underline: false,
      background: "",
      padding: 0,
    }),
    node("Spacer", { height: 4 }),
    node("SchemaImage", { source: "{{schema_image.src}}", width: 100, align: "center" }),
    node("Spacer", { height: 4 }),
    node("Text", {
      content: "Référence : {{product.sku}}",
      size: 7.5,
      align: "left",
      bold: false,
      color: "var(--ds-text-inverse)",
      background: "",
      padding: 0,
    }),
    node("QrCode", {
      content: "{{product.url}}",
      source: "",
      size: 20,
      caption: "",
      align: "left",
      // Modules clairs sur l'aplat sombre, fond transparent : un QR reste
      // lisible tant que le contraste entre modules et fond est franc.
      dark: "#ffffff",
      light: "",
      margin: 1,
    }),
  ],
});

/** En-tete de la colonne de contenu : titre de section et logo de la boutique. */
const TOP_ROW = node("Columns", {
  ratio: "3fr 1fr",
  gap: 6,
  contentGap: 2,
  align: "start",
  avoidBreak: false,
  left: [
    node("Heading", {
      text: "Caractéristiques techniques",
      level: "h2",
      size: 15.5,
      align: "left",
      color: "var(--ds-text)",
      uppercase: false,
      underline: false,
      background: "",
      padding: 0,
    }),
    node("Divider", {
      orientation: "horizontal",
      thickness: 2,
      // Le seul endroit ou la couleur de la boutique s'exprime : un accent
      // unique tient la page, deux la dispersent.
      color: "var(--color-primary)",
      margin: 1,
      length: 0,
    }),
  ],
  right: [
    node("Image", {
      source: "{{shop.logo}}",
      width: 100,
      widthUnit: "%",
      height: 0,
      maxHeight: 12,
      align: "right",
      fit: "contain",
    }),
  ],
  third: [],
});

/**
 * Rangee principale : visuels a gauche, caracteristiques a droite, filet de
 * liaison au milieu.
 *
 * Le ratio declare TROIS colonnes, dont une en `auto` : c'est ce qui donne au
 * filet une colonne a lui, large de son seul trait. Une gouttiere ne suffirait
 * pas — elle separe sans rien montrer.
 */
const MAIN_ROW = node("Columns", {
  ratio: "1fr auto 1fr",
  gap: 6,
  contentGap: 4,
  // Etire les trois colonnes a la hauteur de la plus haute : c'est ce qui
  // permet au filet du milieu de courir sur toute la rangee.
  align: "stretch",
  avoidBreak: false,
  left: [
    node("ImageGallery", {
      source: "{{images}}",
      skip: 0,
      limit: 1,
      columns: 1,
      gap: 0,
      border: false,
      borderColor: "",
      borderWidth: 0,
      padding: 0,
    }),
    node("ImageGallery", {
      source: "{{images}}",
      // La premiere image est deja le visuel principal ci-dessus.
      skip: 1,
      limit: 4,
      columns: 4,
      gap: 3,
      border: true,
      borderColor: "var(--ds-rule-soft)",
      borderWidth: 1,
      padding: 1,
    }),
    node("Text", {
      content: "{{product.description_short}}",
      size: 9,
      align: "left",
      bold: false,
      color: "var(--ds-text-muted)",
      background: "",
      padding: 0,
    }),
  ],
  right: [
    node("Divider", {
      orientation: "vertical",
      thickness: 1,
      color: "var(--ds-rule)",
      margin: 0,
      // 0 = occupe la hauteur disponible : le filet suit le contenu voisin
      // sans qu'on ait a le remesurer a chaque retouche.
      length: 0,
    }),
  ],
  third: [
    node("FeatureTable", {
      source: "{{features}}",
      heading: "",
      nameHeader: "Caractéristique",
      valueHeader: "Valeur",
      showHeader: false,
      showAbbreviation: true,
      striped: true,
      size: 9,
      groupDuplicates: true,
      groupSeparator: " · ",
      rowPadding: 1.2,
      pairs: 1,
      stripeColor: "var(--ds-stripe)",
      stripeTextColor: "",
      pairGap: 6,
      nameWidth: 45,
      pairRule: true,
      headerColor: "",
      headerTextColor: "",
      background: "",
      color: "",
      padding: 0,
      radius: 0,
    }),
  ],
});

/** Colonne de droite : tout le contenu, avec le seul retrait de la page. */
const CONTENT = node("Panel", {
  background: "",
  color: "var(--ds-text)",
  backgroundImage: "",
  backgroundSize: "cover",
  backgroundPosition: "center",
  borderWidth: 0,
  borderColor: "",
  padding: 10,
  radius: 0,
  align: "left",
  contentGap: 6,
  height: 0,
  fillHeight: true,
  verticalAlign: "start",
  avoidBreak: false,
  content: [
    TOP_ROW,
    MAIN_ROW,
    node("Divider", {
      orientation: "horizontal",
      thickness: 1,
      color: "var(--ds-rule-soft)",
      margin: 1,
      length: 0,
    }),
    node("Text", {
      content:
        "{{shop.company.address}} — {{shop.company.phone}} — {{shop.company.email}}",
      size: 7.5,
      align: "left",
      bold: false,
      color: "var(--ds-text-muted)",
      background: "",
      padding: 0,
    }),
  ],
});

const BODY = {
  root: { props: ROOT },
  content: [
    node("Columns", {
      // Le bandeau occupe un cinquieme de la largeur : assez pour porter le nom
      // du produit sur deux lignes, assez peu pour ne pas rogner le tableau.
      ratio: "1fr 4fr",
      gap: 0,
      contentGap: 0,
      // Sans « stretch », le bandeau s'arrete a la hauteur de son propre
      // contenu et la page se lit comme deux blocs poses cote a cote.
      align: "stretch",
      // Et sans « fillHeight », « stretch » n'aligne les colonnes qu'entre
      // elles : la rangee, elle, s'arreterait au dernier bloc. Les deux vont
      // ensemble pour qu'un bandeau descende jusqu'au bas de la page.
      fillHeight: true,
      avoidBreak: false,
      left: [SIDEBAR],
      right: [CONTENT],
      third: [],
    }),
  ],
  zones: {},
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  loadEnv();

  const { listAllTemplates, getTemplateBySlug, createTemplate, getDraft, saveDraft } =
    await import("../src/lib/repository");

  const slug = arg("slug");
  const shop = arg("shop") ?? null;
  const name = arg("name") ?? "Fiche paysage — bandeau lateral";

  if (!slug) {
    const templates = await listAllTemplates();
    console.log("Templates existants :\n");
    for (const row of templates) {
      console.log(`  ${row.slug}${row.shop_slug ? `  (${row.shop_slug})` : "  (bibliotheque)"}`);
    }
    console.log(
      "\nAucune modification effectuee. Relancer avec --slug <nouveau-slug> " +
        "pour creer le template de depart."
    );
    return;
  }

  const existing = await getTemplateBySlug(slug, shop);
  if (existing) {
    throw new Error(
      `Un template « ${slug} » existe deja${shop ? ` pour ${shop}` : " dans la bibliotheque"}. ` +
        "Choisir un autre --slug : ce script cree, il n'ecrase jamais."
    );
  }

  // createTemplate RENVOIE l'erreur au lieu de la lever : un slug invalide ou
  // une boutique inconnue passerait sinon pour une reussite, et l'appel suivant
  // echouerait sur un identifiant absent avec un message sans rapport.
  const created = await createTemplate(slug, name, shop);
  if ("error" in created) {
    throw new Error(created.error);
  }

  const draft = await getDraft(created.id);

  // La feuille de style n'est PAS reecrite ici : elle appartient a
  // install-typography.ts, et l'ecraser ferait perdre une police deja installee.
  const version = await saveDraft(created.id, {
    ...draft,
    body: BODY,
    header: null,
    footer: null,
  });

  console.log(`template cree       ${slug} (brouillon v${version})`);
  console.log(`                    ${name}`);

  if (!(draft.css ?? "").trim()) {
    console.log(
      "\nCe template consomme les tokens --ds-band, --ds-rule, --ds-stripe.\n" +
        "Sa feuille de style est vide : lancer\n" +
        `    pnpm typo --template ${slug}${shop ? ` --shop ${shop}` : ""}\n` +
        "sans quoi les blocs s'afficheront sans leurs couleurs."
    );
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
