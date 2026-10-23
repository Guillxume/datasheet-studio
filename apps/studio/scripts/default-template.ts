/**
 * Fiche produit simple — le template PAR DEFAUT de la bibliotheque.
 *
 * Module de DONNEES PURES, sans effet de bord : importe par l'installateur
 * (install-default-template.ts) comme par un rendu de controle.
 *
 * POURQUOI IL EXISTE. Les seuls templates livres etaient faits sur mesure pour
 * une boutique : une boutique sans template a elle repartait d'un canvas
 * vide. Celui-ci couvre le cas courant — un produit simple, une page A4 — et se
 * personnalise ensuite dans l'editeur.
 *
 * NEUTRE PAR CONSTRUCTION. Aucune couleur de marque n'est codee ici : l'accent
 * est `--color-primary`, qui arrive du payload, avec un gris sombre en repli si
 * la configuration du module n'a pas ete renseignee. Les neutres sont des
 * jetons propres au template (`--dt-*`), declares dans sa feuille de style, de
 * sorte qu'il ne depend d'aucune feuille installee par `pnpm typo`.
 *
 * ANATOMIE, celle des fiches faites a la main : titre centre, deux visuels, panneau gris
 * (finitions | points clefs), « Caracteristiques techniques » avec le schema
 * cote, puis pied (logo, coordonnees, pagination). Rien de conditionnel : les blocs dont le
 * token ne resout rien (pas de schema, pas de description) s'effacent d'eux
 * memes ou laissent un blanc discret.
 *
 * TOKENS : uniquement ceux declares dans src/lib/variables.ts.
 */

import { lucideSvg } from "../src/lib/icons";

let counter = 0;
const id = (type: string) => `${type.toLowerCase()}-${++counter}`;

/** Un noeud Puck. L'identifiant est obligatoire et unique dans l'arbre. */
const node = (type: string, props: Record<string, unknown>) => ({
  type,
  props: { id: id(type), ...props },
});

export const NAME = "Fiche produit simple";
export const SLUG = "fiche-produit-simple";

const ACCENT = "var(--color-primary, var(--dt-ink))";

/**
 * Geometrie A4 portrait. 14 mm en haut : aucun bandeau n'est repete en tete, le
 * titre ne s'imprime que sur la premiere feuille. 20 mm en bas : le pied (logo,
 * coordonnees, pagination) est lui repete sur chaque feuille.
 */
export const ROOT = {
  pageWidth: 210,
  pageHeight: 297,
  marginTop: 14,
  marginBottom: 20,
  marginLeft: 14,
  marginRight: 14,
  padding: 0,
  paddingRight: 0,
  blockGap: 5,
};

/**
 * Pied repete : logo, coordonnees, pagination. Compose en `Columns` et non en
 * `PageFooter`, dont la mise en page figee ne pose pas trois elements sur une
 * ligne.
 */
const FOOTER_CONTENT = [
  node("Divider", { thickness: 0.5, color: "var(--dt-hairline)", margin: 0 }),
  node("Spacer", { height: 2 }),
  node("Columns", {
    ratio: "0.6fr 2fr 0.4fr",
    gap: 4,
    align: "center",
    left: [node("Image", { source: "{{shop.logo}}", width: 26, widthUnit: "mm", align: "left", fit: "contain" })],
    right: [
      node("Text", {
        content: "{{shop.name}} - {{shop.url}} - {{shop.company.phone}}",
        size: 7.5,
        align: "left",
        color: "var(--dt-ink)",
      }),
    ],
    third: [node("PageNumber", { format: "n/total", size: 7.5, align: "right", color: "var(--dt-ink)" })],
  }),
];

/**
 * Titre centre, reference, filet : la seule place ou l'accent de la boutique
 * s'exprime.
 *
 * LA REFERENCE est absente des fiches faites a la main, et c'est un manque :
 * c'est elle qu'un client recopie dans une demande de devis, et elle seule
 * distingue deux variantes au nom identique.
 *
 * LE FILET est un trait d'un demi-point : a 1,5 pt il pesait autant que le
 * titre et coupait la page en deux.
 */
const TITRE = [
  node("Heading", {
    text: "{{product.name}}",
    level: "h1",
    size: 17,
    align: "center",
    color: "var(--dt-ink)",
    uppercase: false,
    underline: false,
  }),
  node("Text", {
    content: "Réf. {{product.sku}}",
    size: 8.5,
    align: "center",
    color: "var(--dt-muted)",
  }),
  // Marge nulle : l'espacement entre blocs de la page (blockGap, 5 mm) suffit
  // a detacher le filet des cadres photo. Une marge en plus se cumule avec lui.
  node("Divider", { thickness: 0.5, color: ACCENT, margin: 0 }),
];

/**
 * Les deux premieres images du produit, cote a cote. Une galerie et non deux
 * blocs Image : un produit qui n'en a qu'une ne laisse pas de case vide.
 *
 * La seconde, mise en situation, remplit son cadre : voir la feuille de style.
 */
const VISUELS = node("ImageGallery", {
  source: "{{images}}",
  skip: 0,
  limit: 2,
  columns: 2,
  gap: 4,
  // Plafond de hauteur : sans lui, une photo en portrait repousse tout le
  // reste de la page.
  maxHeight: 60,
  // Un cadre d'un demi-point, en filet : les photos detourees sur fond blanc
  // se perdent dans la page sans lui.
  border: true,
  borderColor: "var(--dt-hairline)",
  borderWidth: 0.5,
  padding: 2,
});

/**
 * Un picto du jeu Lucide, inline en data URI.
 *
 * PAS DE PICTO DE BIBLIOTHEQUE ICI : une instance neuve n'en a aucun, et une
 * reference /assets/... absente s'effacerait en laissant un avertissement a
 * chaque rendu. Le data URI traverse le rendu tel quel (seules les references
 * /assets/ sont resolues), y compris dans les zones repetees. Remplacer un
 * picto par celui de la boutique se fait ensuite dans l'editeur.
 */
const picto = (nom: string) => `data:image/svg+xml,${encodeURIComponent(lucideSvg(nom, { size: 48, strokeWidth: 1.5 }))}`;

/**
 * Le nombre d'annees passe dans le libelle : un picto generique ne le porte
 * pas, la ou un picto dessine pour la boutique l'aurait affiche.
 */
const GARANTIES = [2, 3, 5, 10].map((ans) => ({
  badge: `garantie:${ans}`,
  iconUrl: picto("shield-check"),
  label: `Garantie ${ans} ans`,
}));

/**
 * LES QUATRE VALEURS DE « Montage », PAS DEUX. Un catalogue dit souvent « Livré
 * monté », mais aussi « Livré en kit », « À monter » et « A assembler » — trois
 * facons d'ecrire la meme chose, heritees de saisies successives. Les trois
 * pointent donc sur le meme picto et le meme libelle.
 */
const MONTAGE = [
  { badge: "montage:livre-monte", iconUrl: picto("package-check"), label: "Livré monté", group: "montage", connector: "OU" },
  { badge: "montage:livre-en-kit", iconUrl: picto("wrench"), label: "À monter", group: "montage", connector: "OU" },
  { badge: "montage:a-monter", iconUrl: picto("wrench"), label: "À monter", group: "montage", connector: "OU" },
  { badge: "montage:a-assembler", iconUrl: picto("wrench"), label: "À monter", group: "montage", connector: "OU" },
];

/**
 * Les points clefs : garantie et mode de livraison, les deux informations
 * qu'un produit simple porte le plus souvent.
 *
 * LES CLES SONT CELLES QUE PRODUISENT LES REGLES DE BADGES du module
 * (« garantie:5 », « montage:a-monter »). Une boutique qui n'emet pas ces
 * badges n'affiche rien : une regle sans badge correspondant ne laisse aucune
 * trace sur la fiche. Pour une autre boutique, ajouter ses propres regles sur
 * le bloc, dans l'editeur.
 */
const POINTS = [...GARANTIES, ...MONTAGE];

/**
 * Le panneau de choix : finitions a gauche, informations principales a droite.
 *
 * LA COULEUR DU TEXTE EST POSEE AVEC LE FOND : `Panel` rend son texte en blanc
 * par defaut, ce qui donne du blanc sur gris clair — un panneau qui parait vide.
 *
 * Les finitions viennent du payload (`{{finishes}}`), pastille et libelle ; les
 * groupes portent leur propre titre, donc aucun intitule fixe ne reste orphelin
 * sur un produit sans declinaison. A droite, les points clefs a pictos.
 */
const PANNEAU = node("Panel", {
  background: "var(--dt-panel)",
  color: "var(--dt-ink)",
  padding: 7,
  radius: 0,
  contentGap: 0,
  content: [
    node("Columns", {
      ratio: "1.5fr 1fr",
      gap: 6,
      contentGap: 3,
      align: "start",
      divider: true,
      dividerColor: "var(--dt-hairline)",
      left: [
        node("SwatchGroups", {
          source: "{{finishes}}",
          exclude: "Sans",
          shape: "square",
          swatchSize: 7,
          gap: 3,
          groupGap: 7,
          titleSize: 9,
          size: 6.5,
          itemWidth: 15,
          mapping: [],
        }),
      ],
      right: [
        node("HighlightRow", {
          source: "{{badges}}",
          iconHeight: 12,
          gap: 8,
          rowGap: 5,
          itemWidth: 24,
          size: 8,
          align: "center",
          mapping: POINTS,
        }),
      ],
    }),
  ],
});

/** Caracteristiques a gauche, schema cote a droite. */
const TECHNIQUE = node("Columns", {
  ratio: "1fr 1fr",
  gap: 8,
  contentGap: 4,
  align: "start",
  left: [
    node("FeatureTable", {
      source: "{{features}}",
      showHeader: false,
      showAbbreviation: false,
      striped: false,
      groupDuplicates: true,
      groupSeparator: "\n",
      pairs: 1,
      pairRule: false,
      nameWidth: 45,
      rowPadding: 2,
      // Un filet fin sous chaque ligne : sans zebrage, c'est lui qui attache
      // chaque libelle a sa valeur.
      rowRule: true,
      size: 8,
      // La VALEUR en gras, le libelle en romain.
      emphasis: "value",
      color: "var(--dt-ink)",
    }),
  ],
  right: [
    node("SchemaImage", {
      source: "{{schema_image.src}}",
      width: 100,
      // Les schemas sont majoritairement en portrait : sans plafond, un schema
      // prendrait la hauteur de la page.
      maxHeight: 90,
      align: "center",
    }),
  ],
});

export const BODY = {
  root: { props: ROOT },
  zones: {},
  content: [
    node("Page", {
      mode: "always",
      onlyIf: "",
      content: [
        ...TITRE,
        VISUELS,
        PANNEAU,
        node("Heading", {
          text: "Caractéristiques techniques",
          level: "h2",
          size: 17,
          align: "center",
          color: "var(--dt-ink)",
          uppercase: false,
        }),
        TECHNIQUE,
      ],
    }),
  ],
};

export const HEADER = { root: { props: {} }, zones: {}, content: [] };
export const FOOTER = { root: { props: {} }, zones: {}, content: FOOTER_CONTENT };

/**
 * Feuille de style du template : des neutres, et rien de la marque.
 * Contrastes sur blanc : --dt-ink 16,1:1, --dt-muted 5,7:1 (AA).
 */
export const CSS = `:root {
  --dt-ink: #1f2933;
  --dt-muted: #5b6670;
  --dt-hairline: #dde1e5;
  --dt-panel: #f1f3f2;
}

/* La description arrive d'un editeur WYSIWYG : ses marges de paragraphe creent
   des trous irreguliers. On les normalise sans toucher au contenu. */
.ds-richtext p { margin: 0 0 2mm; }
.ds-richtext ul { margin: 0 0 2mm; padding-left: 4mm; }
.ds-richtext li { margin: 0 0 0.6mm; }
.ds-richtext h3 { margin: 0 0 1mm; font-size: 9.5pt; color: var(--dt-ink); }
.ds-richtext p, .ds-richtext li { orphans: 2; widows: 2; }

/* La 2e photo est une mise en situation : la boutique la livre dans un carre
   a bandes blanches. Elle remplit son cadre (cover) et perd la marge interieure ;
   la 1re, produit detoure, reste entiere. !important : la galerie pose ses
   styles en ligne. */
.ds-gallery img:nth-child(2) { object-fit: cover !important; padding: 0 !important; }
`;
