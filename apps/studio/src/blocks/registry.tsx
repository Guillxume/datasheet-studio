import { Fragment } from "react";
import type { CSSProperties, MouseEvent } from "react";
import type { Config, Slot } from "@puckeditor/core";
import { sanitizeRichHtml } from "@/lib/html";
import { qrSvgDataUri } from "@/lib/qr";
import { pageWillPrint } from "@/lib/pages";
import {
  BodyCanvas,
  MarginBoxCanvas,
  PageCanvas,
  pageContentStyle,
  type CanvasMeta,
} from "./canvasChrome";

/**
 * Registry des blocs de fiche technique.
 *
 * UN registry, DEUX consommateurs :
 *   - l'editeur    (src/app/editor/[slug]/page.tsx, cote client)
 *   - le rendu PDF (src/lib/render.tsx, cote serveur)
 *
 * C'est ce partage qui garantit que l'apercu de l'editeur et le PDF final ne
 * peuvent pas diverger : le meme composant React produit les deux.
 *
 * Les valeurs des props peuvent contenir des tokens ({{product.name}},
 * {{features}}) resolus en amont par src/lib/bind.ts. Les composants recoivent
 * donc toujours des valeurs concretes et n'ont aucune connaissance des tokens.
 *
 * ---------------------------------------------------------------------------
 * CE FICHIER FAIT PLUS DE DEUX MILLE LIGNES, ET ON NE LE DECOUPE PAS.
 *
 * La question a ete posee et tranchee (02/09/2026). Les chiffres qui l'ont
 * tranchee : 640 lignes de types et d'aides, puis UN objet declarant 20 blocs.
 * Le plus gros, FeatureTable, en fait 276 ; la mediane est autour de 50. Ce
 * n'est pas de la complexite accumulee, c'est une ENUMERATION.
 *
 * Ce que le decoupage en un fichier par bloc achete : de la navigation, que
 * l'ouverture rapide de fichier donne deja. Ce qu'il coute : un index a tenir a
 * jour, vingt imports, et la perte du seul endroit ou l'on voit tous les blocs
 * a la suite — ce qui est precisement l'interet d'un registry.
 *
 * L'argument des conflits de fusion ne s'applique pas : une seule personne
 * touche ce fichier.
 *
 * Et la logique reellement risquee n'y est PAS : `groupFeatures`, qui decide
 * comment un tableau de caracteristiques se replie en colonnes, est extraite et
 * testee (src/blocks/features.test.ts).
 *
 * CE QUI FERAIT CHANGER D'AVIS : une deuxieme personne sur ce fichier, ou un
 * bloc qui depasse les 300 lignes. Dans ce cas, on extrait CE bloc-la, pas les
 * vingt.
 * ---------------------------------------------------------------------------
 */

type Align = "left" | "center" | "right";

type Img = { src?: string; legend?: string };
type Feature = { name: string; value: string; abbreviation?: string | null };
type BadgeRule = { badge?: string; iconUrl?: string; label?: string };
type InfoItem = { label?: string; value?: string; iconUrl?: string };

/**
 * Les formes venues des collections de choix du payload.
 *
 * REDECLAREES ICI plutot qu'importees de src/lib/payload.ts, comme `Feature` et
 * `Img` au-dessus. Le registry ne doit rien savoir du schema : il recoit des
 * valeurs deja resolues, et une dependance vers zod dans un module charge par le
 * NAVIGATEUR se paierait en kilooctets pour zero garantie supplementaire — les
 * props arrivent d'un arbre JSON que rien ne retype de toute facon.
 *
 * Tous les champs sont optionnels, y compris ceux que le schema rend
 * obligatoires : un bloc doit survivre a un template ecrit a la main.
 */
type FinishOpt = { label?: string; color?: string | null; image?: string | null; note?: string | null };
type FinishGrp = { label?: string | null; options?: FinishOpt[]; note?: string | null };
type Card = {
  name?: string;
  /**
   * Libelle du CATALOGUE auquel cette fiche correspond, quand il differe du nom
   * imprime. Vide = le nom fait office de cle.
   *
   * Meme separation que sur une regle de nuancier, et pour la meme raison : la
   * boutique stocke « A code electronique », la fiche imprime « Serrure à code
   * électronique ». Sans ce champ, il faudrait choisir entre un rapprochement
   * qui echoue et un titre illisible sur le document.
   */
  match?: string;
  /**
   * Groupe du catalogue auquel cette fiche correspond, quand c'est le GROUPE qui
   * porte le sens et non ses valeurs.
   *
   * Le catalogue decline « Retour » en « Droit » et « Gauche », « Voile de
   * fond » en « Voile de fond » et « Sans voile de fond » : ce que la fiche
   * documente est l'option elle-meme, pas le cote choisi. Rapprocher par valeur
   * obligerait a saisir une fiche par variante, toutes identiques.
   *
   * La fiche s'affiche des que le produit decline ce groupe avec au moins une
   * valeur retenue — les valeurs d'absence etant ecartees en amont par
   * `exclude`, un bureau qui ne propose que « Sans voile de fond » ne l'allume
   * donc pas.
   */
  matchGroup?: string;
  subtitle?: string | null;
  image?: string | null;
  icon?: string | null;
  description?: string | null;
  features?: Feature[];
};
/**
 * Correspondance libelle -> presentation, pour un nuancier. Voir SwatchGroups.
 *
 * `text` REMPLACE le libelle imprime, et ce n'est pas un raffinement : les
 * valeurs d'attributs d'un back-office ne sont pas redigees pour etre imprimees.
 * Le catalogue Acme stocke « A code electronique » la ou la fiche faite a la
 * main imprime « Serrure à code électronique ». Sans cette surcharge, il
 * faudrait renommer les attributs — donc toucher au catalogue pour une question
 * de mise en page, et casser au passage l'historique des commandes.
 */
type SwatchRule = { label?: string; color?: string; image?: string; text?: string };

/** Correspondance badge -> picto ET libelle imprime. Voir HighlightRow. */
type HighlightRule = {
  badge?: string;
  iconUrl?: string;
  label?: string;
  note?: string;
  /**
   * Hauteur propre a ce picto (mm), quand celle du bloc ne convient pas.
   *
   * SERT AUX LOGOTYPES QUI PORTENT DEJA LEUR NOM. Un logotype de certification
   * — Möbelfakta, Blue Angel — contient sa propre signature : reimprimer le
   * libelle dessous ecrit le nom deux fois. On vide donc le libelle, et il faut
   * alors rendre au logotype la hauteur que le picto ET son libelle occupaient
   * ensemble, sans quoi il flotte plus haut que ses voisins.
   */
  height?: number;
  /** Points clefs mutuellement exclusifs, relies par une accolade. */
  group?: string;
  /** Mot porte par l'accolade : « OU ». */
  connector?: string;
};

/**
 * Carte des props, par bloc.
 *
 * Parametrer Config avec cette carte n'est pas cosmetique : sans elle, Puck
 * type les props en `any` et l'editeur perd toute verification sur les champs
 * comme sur les valeurs par defaut.
 *
 * Les champs de type `slot` se declarent en `Slot` ici ; Puck les convertit en
 * composants dans la signature de `render`.
 */
export type DatasheetProps = {
  /**
   * Un troisieme slot optionnel : le template 02 de l'ancien module dispose
   * vignettes / visuel principal / colonne laterale sur une meme ligne. On peut
   * l'obtenir en imbriquant deux Columns, mais le controle des proportions y
   * devient illisible.
   */
  Columns: {
    ratio?: string;
    gap?: number;
    /** Espacement vertical entre les blocs empiles DANS une colonne. Voir STACK. */
    contentGap?: number;
    align?: string;
    /** Garder les colonnes sur une meme page. Non par defaut, pour la meme raison que Panel. */
    avoidBreak?: boolean;
    /**
     * Occuper toute la hauteur disponible du conteneur parent.
     *
     * Meme reglage que sur Panel, et pour la meme raison : « Etirer » aligne les
     * colonnes ENTRE ELLES, sur la hauteur de la rangee — mais la rangee, elle,
     * s'arrete a son propre contenu. Sans ce reglage, un bandeau lateral cesse
     * au dernier bloc au lieu de descendre au bas de la page.
     */
    fillHeight?: boolean;
    /**
     * Filet vertical entre les colonnes.
     *
     * Les fiches faites a la main separent ainsi « Choix des finitions » de
     * « Informations principales » : un trait fin, sur toute la hauteur du
     * bloc. Sans lui, les deux moities flottent dans le meme aplat gris et rien
     * ne dit ou l'une finit.
     */
    divider?: boolean;
    dividerColor?: string;
    left: Slot;
    right: Slot;
    third: Slot;
  };
  /**
   * Conteneur decore. C'EST LE BLOC QUI MANQUAIT pour reprendre les anciens
   * templates : quatre des cinq posent un fond colore ou une bordure derriere un
   * groupe d'elements (colonne laterale du 02, barre de reference du 03 et du 05,
   * encadres du 04).
   */
  Panel: {
    background?: string;
    /** Fond en image — verifie fonctionnel jusque dans les zones repetees. */
    backgroundImage?: string;
    backgroundSize?: string;
    backgroundPosition?: string;
    color?: string;
    borderWidth?: number;
    borderColor?: string;
    padding?: number;
    radius?: number;
    align?: Align;
    /** Espacement vertical entre les blocs empiles dans le panneau. Voir STACK. */
    contentGap?: number;
    /** Renseigner une hauteur en fait un bandeau : utile pour un en-tete ou un pied. */
    height?: number;
    /**
     * Occuper toute la hauteur disponible dans le conteneur parent.
     *
     * Complement indispensable de l'alignement « Etirer » des Colonnes : celui-ci
     * etire la COLONNE, mais le panneau qu'elle contient reste a la hauteur de son
     * contenu — un fond de bandeau lateral s'arretait donc au dernier mot ecrit.
     * Sans hauteur fixe, un panneau ne peut pas savoir seul qu'il doit s'etendre.
     */
    fillHeight?: boolean;
    verticalAlign?: "start" | "center" | "end";
    /**
     * Garder le panneau entier sur une meme page.
     *
     * Par defaut NON : un panneau contenant un long tableau serait sinon
     * repousse en entier a la page suivante, laissant un grand vide. C'etait le
     * comportement force jusqu'ici, et il produisait exactement ce vide.
     */
    avoidBreak?: boolean;
    content: Slot;
  };
  /**
   * Element pose LIBREMENT par-dessus son conteneur.
   *
   * C'est ce qui permet de placer un logo dans un coin, un QR dans un autre et un
   * titre decale au-dessus d'une image de fond. Une rangee de colonnes ne sait
   * disposer les elements que cote a cote ; ici ils se superposent.
   *
   * Ancrage + decalages plutot que quatre valeurs de bords : neuf points de
   * reference couvrent le besoin reel et evitent de raisonner en top/left/right/
   * bottom, ou 0 est une valeur legitime qu'on ne peut pas distinguer de « vide ».
   */
  /**
   * Groupe : des blocs qui se deplacent ensemble, sans rien ajouter a la fiche.
   *
   * Retour utilisateur : « faire des groupages d'elements pour faciliter le
   * deplacement ». Un Panneau sans fond ferait l'affaire a l'impression, mais
   * son nom promet un fond et une bordure ; et c'est le Groupe que l'editeur
   * sait transformer en composant (le groupe n'est alors qu'une enveloppe, son
   * CONTENU devient le composant).
   */
  Group: {
    /**
     * Espacement entre les blocs du groupe. VIDE PAR DEFAUT : le groupe reprend
     * alors celui de la zone ou il est pose — grouper des blocs ne doit pas les
     * deplacer d'un millimetre.
     */
    contentGap?: number;
    avoidBreak?: boolean;
    content: Slot;
  };
  Positioned: {
    anchor?: string;
    offsetX?: number;
    offsetY?: number;
    width?: number;
    zIndex?: number;
    content: Slot;
  };
  /**
   * Image libre : logo, picto, visuel de la bibliotheque, image produit.
   *
   * C'ETAIT LA PIECE MANQUANTE pour composer un en-tete a la main : les autres
   * blocs d'image sont specialises (galerie produit, schema cote), et le logo
   * n'etait accessible qu'a travers la mise en page figee de PageHeader.
   */
  Image: {
    source?: string;
    width?: number;
    widthUnit?: "mm" | "%";
    height?: number;
    /**
     * Plafond de hauteur, sans lequel « largeur 100 % » est inutilisable : une
     * photo produit en portrait remplirait la moitie de la page et repousserait
     * tout le reste. Avec `fit: contain`, l'image se contente de la place
     * disponible au lieu d'etre deformee.
     */
    maxHeight?: number;
    align?: Align;
    fit?: "contain" | "cover";
    /** Bordure de l'image, en points. 0 = aucune. Voir imageFrame. */
    borderWidth?: number;
    /** Couleur de la bordure ; vide = couleur du texte. */
    borderColor?: string;
    /** Espace entre l'image et sa bordure, en millimetres. */
    padding?: number;
    /** Arrondi des angles, en millimetres. */
    radius?: number;
  };
  Spacer: { height?: number };
  /**
   * Un composant reutilisable, designe par son slug (src/lib/components.ts).
   * Deplie AVANT le rendu : le moteur PDF ne rencontre jamais ce bloc.
   */
  Composant: { component?: string };
  Divider: {
    thickness?: number;
    color?: string;
    margin?: number;
    /**
     * Un filet VERTICAL n'etait pas exprimable : la regle posait un `border-top`,
     * donc toujours horizontal. Or c'est le trait de liaison vertical qui relie
     * visuellement deux sections d'une meme colonne.
     */
    orientation?: "horizontal" | "vertical";
    /** Longueur d'un filet vertical (mm). 0 = occupe la hauteur disponible. */
    length?: number;
  };
  /**
   * UNE page du document. Le corps est une liste de `Page`, et rien d'autre.
   *
   * `mode` et `onlyIf` sont DEUX champs : `onlyIf` arrive au bloc deja resolu,
   * donc un champ laisse vide et un token qui ne resout rien sont la meme
   * chaine. Un champ unique ne saurait pas distinguer « pas de condition » de
   * « condition non remplie », et une page sans condition disparaitrait.
   */
  Page: { content: Slot; mode?: "always" | "ifFilled"; onlyIf?: string };
  PageBreak: { mode?: "always" | "ifFilled"; onlyIf?: string };
  Heading: {
    text?: string;
    level?: "h1" | "h2" | "h3";
    size?: number;
    align?: Align;
    color?: string;
    uppercase?: boolean;
    background?: string;
    padding?: number;
    underline?: boolean;
  };
  Text: {
    content?: string;
    size?: number;
    align?: Align;
    bold?: boolean;
    color?: string;
    background?: string;
    padding?: number;
  };
  RichText: { html?: string; size?: number; columns?: number };
  FeatureTable: {
    /**
     * Token AVANT resolution, tableau APRES : le champ contient "{{features}}",
     * que src/lib/bind.ts remplace par la valeur reelle au rendu.
     *
     * Typer uniquement `Feature[]` obligeait a mettre `[]` en valeur par defaut,
     * ce qui rendait tout bloc fraichement ajoute silencieusement vide.
     */
    source?: Feature[] | string;
    heading?: string;
    nameHeader?: string;
    valueHeader?: string;
    showHeader?: boolean;
    showAbbreviation?: boolean;
    striped?: boolean;
    size?: number;
    /**
     * Fusionne les caracteristiques de meme nom en une seule ligne.
     *
     * Un catalogue PrestaShop porte regulierement plusieurs valeurs sous le meme
     * libelle (« Reglage : hauteur », « Reglage : assise »), chacune stockee comme
     * une caracteristique distincte. Les empiler produit un tableau deux fois plus
     * haut que necessaire, et c'est la premiere cause de debordement sur une
     * seconde page.
     */
    groupDuplicates?: boolean;
    /** Separateur des valeurs regroupees. "\n" met une valeur par ligne. */
    groupSeparator?: string;
    /** Marge interieure des cellules : le levier direct sur la hauteur du tableau. */
    rowPadding?: number;
    /**
     * 2 = deux paires libelle/valeur cote a cote, donc moitie moins de lignes.
     * Le levier le plus fort sur un tableau pleine largeur.
     */
    pairs?: number;
    /** Couleur des lignes alternees. Voir DEFAULT_STRIPE. */
    stripeColor?: string;
    /** Couleur du texte sur une ligne alternee. Vide = inchangee. */
    stripeTextColor?: string;
    /** Gouttiere entre les deux paires de colonnes (mm). */
    pairGap?: number;
    /** Part du libelle dans chaque paire, en % — mode 2 colonnes uniquement. */
    nameWidth?: number;
    /** Filet vertical entre les deux paires, en plus de la gouttiere. */
    pairRule?: boolean;
    /**
     * Filet fin sous chaque ligne. Alternative au zebrage pour un tableau sans
     * fond, ou chaque libelle doit rester attache a sa valeur. Desactive par
     * defaut : un reglage absent n'ecrit rien dans le HTML deja publie.
     */
    rowRule?: boolean;
    /**
     * Quelle colonne porte le gras.
     *
     * « name » par defaut, qui est le comportement d'origine et celui des
     * templates deja publies. Les fiches Acme font l'inverse : le libelle en
     * romain, la VALEUR en gras — c'est elle qu'on vient chercher du regard dans
     * un tableau de trente lignes.
     */
    emphasis?: "name" | "value";
    /** Fond de la ligne d'en-tete. Meme piege que stripeColor : voir DEFAULT_HEADER. */
    headerColor?: string;
    /** Couleur du texte d'en-tete. Vide = inchangee. */
    headerTextColor?: string;
    /**
     * Fond, texte et marge interieure DU TABLEAU.
     *
     * Sans eux, colorer un tableau imposait de l'entourer d'un `Panel` — dont le
     * fond s'etend alors a tout ce que le panneau contient. Un schema cote place a
     * cote du tableau se retrouvait donc sur le meme aplat, ce qui n'a aucune
     * raison d'etre.
     */
    background?: string;
    color?: string;
    padding?: number;
    radius?: number;
  };
  ImageGallery: {
    /** Token avant resolution, tableau apres. Voir FeatureTable.source. */
    source?: Img[] | string;
    skip?: number;
    limit?: number;
    columns?: number;
    gap?: number;
    /**
     * Plafond de hauteur (mm). 0 = aucun.
     *
     * MEME RAISON QUE SUR `Image`, et c'etait une incoherence de ne l'avoir que
     * la : sans plafond, une rangee de vignettes prend la hauteur de la PLUS
     * HAUTE, et deux photos de rapports differents — une mise en situation en
     * paysage, une vue de face en portrait — font un bandeau deux fois trop
     * grand qui repousse tout le reste sur la page suivante. Mesure a l'appui :
     * 190 mm au lieu des 72 mm des fiches de reference.
     */
    maxHeight?: number;
    border?: boolean;
    /** Le template 04 encadre ses visuels d'un liseré jaune epais : la bordure doit etre reglable. */
    borderColor?: string;
    borderWidth?: number;
    padding?: number;
  };
  SchemaImage: {
    source?: string;
    /** Largeur en POURCENTAGE de la colonne, comme le champ de l'editeur l'annonce. */
    width?: number;
    /**
     * Plafond de hauteur, en millimetres. 0 = aucun.
     *
     * SANS LUI, UN SCHEMA EN PORTRAIT MANGE LA FEUILLE. La largeur etant un
     * pourcentage, elle ne borne pas la hauteur : un dessin haut et etroit
     * demande a 92 % de la colonne occupait une page entiere et debordait sur
     * la suivante — constate sur le vestiaire 474, dont la fiche sortait sur
     * quatre feuilles. Le bloc Image portait deja ce plafond ; celui-ci ne
     * l'avait pas.
     */
    maxHeight?: number;
    align?: Align;
    /** Bordure de l'image, en points. 0 = aucune. Voir imageFrame. */
    borderWidth?: number;
    /** Couleur de la bordure ; vide = couleur du texte. */
    borderColor?: string;
    /** Espace entre l'image et sa bordure, en millimetres. */
    padding?: number;
    /** Arrondi des angles, en millimetres. */
    radius?: number;
  };
  BadgeRow: {
    /** Token avant resolution, tableau apres. Voir FeatureTable.source. */
    source?: string[] | string;
    height?: number;
    gap?: number;
    align?: Align;
    /**
     * Indispensable en pratique : les pictos de certification du parc (CE, TUV,
     * Bureau Veritas) sont des PNG BLANCS a fond transparent. Sans fond colore
     * ils se rendent correctement mais sont invisibles sur une page blanche.
     */
    background?: string;
    padding?: number;
    mapping?: BadgeRule[];
  };
  KeyValueGrid: { columns?: number; gap?: number; iconHeight?: number; items?: InfoItem[] };
  /**
   * « Choix des finitions » : les groupes de valeurs proposees au client.
   *
   * UN bloc pour TOUS les groupes, et non un bloc par groupe. Leur nombre varie
   * d'une fiche a l'autre — deux sur un vestiaire (coloris, fermeture), trois
   * sur un fauteuil (dossier, assise, pietement), un seul et sans titre sur une
   * chaise coque. Un montage en `Columns` figerait ce nombre dans le template,
   * donc un template par famille de produit.
   */
  SwatchGroups: {
    /** Token avant resolution, tableau apres. Voir FeatureTable.source. */
    source?: FinishGrp[] | string;
    shape?: "square" | "circle";
    /** Cote de la pastille (mm). */
    swatchSize?: number;
    /**
     * Valeurs a ne PAS montrer, par leur libelle, separees par des virgules.
     *
     * UNE ABSENCE N'EST PAS UNE FINITION. Le catalogue declare « Sans cloison »,
     * « Sans socle banc », « Sans option » : des choix legitimes en commande,
     * mais qui n'ont rien a faire dans un nuancier. La regle « pas de code
     * hexadecimal, pas de pastille » les ecartait toutes — sauf une, a laquelle
     * la boutique a associe une image de croix rouge, qui s'imprimait donc comme
     * une couleur disponible.
     *
     * Le rapprochement suit la meme regle que les fiches : egalite, ou prefixe
     * s'arretant sur une espace. « Sans » ecarte donc « Sans cloison » sans
     * toucher a une couleur qui s'appellerait « Sansone ».
     */
    exclude?: string;
    gap?: number;
    groupGap?: number;
    size?: number;
    titleSize?: number;
    /**
     * Largeur d'une valeur (mm), libelle compris.
     *
     * REGLEE ET NON DEDUITE de la taille de la pastille, comme elle l'etait
     * d'abord : c'est ce nombre qui decide si deux groupes tiennent cote a cote
     * ou passent l'un sous l'autre, et donc la hauteur du panneau de choix —
     * le poste qui fait basculer la premiere page sur une seconde. Une valeur
     * deduite mettait cette decision hors de portee de celui qui compose.
     */
    itemWidth?: number;
    /**
     * Couleurs et pictos absents du payload, rapproches PAR LIBELLE.
     *
     * C'est ce qui rend le contrat tenable depuis une plateforme qui ne connait
     * pas la presentation de ses propres valeurs d'option — le cas de Medusa.
     * Une valeur qui porte sa couleur l'emporte ; la regle ne sert qu'a combler.
     */
    mapping?: SwatchRule[];
  };
  /**
   * « Informations principales » / « Caracteristiques principales » : un picto
   * surmontant son libelle, sur une rangee qui se replie.
   *
   * DISTINCT DE BadgeRow, qui ne montre que des pictos nus, et de KeyValueGrid,
   * dont la grille est a colonnes fixes et les entrees saisies a la main. La
   * source est la MEME que BadgeRow — `{{badges}}` — ce qui evite d'ajouter une
   * collection au payload pour une zone que les deux plateformes savent deja
   * alimenter.
   */
  HighlightRow: {
    /** Token avant resolution, tableau apres. Voir FeatureTable.source. */
    source?: string[] | string;
    mapping?: HighlightRule[];
    iconHeight?: number;
    gap?: number;
    rowGap?: number;
    size?: number;
    align?: Align;
    /** Largeur maximale d'un libelle (mm) : sans elle, « Tôle d'acier finition
     *  époxy 7/10ᵉ » s'etale sur une ligne et disloque la rangee. */
    itemWidth?: number;
  };
  /**
   * « Accessoires », « Options », « FERMETURES » : une grille de fiches.
   *
   * UN bloc pour les trois, parce que les fiches de reference les composent a
   * l'identique et ne different que par ce qu'elles affichent — la rangee de la
   * page 1 montre image et nom, la page de detail y ajoute description et puces.
   * Trois blocs auraient triple la surface a maintenir pour trois reglages.
   */
  CardGrid: {
    /** Token avant resolution, tableau apres. Vide = saisie manuelle. */
    source?: Card[] | string;
    /**
     * Fiches SAISIES DANS LE TEMPLATE, quand la source est laissee vide.
     *
     * C'est ce qui fait vivre l'encart « FERMETURES » des fiches de vestiaires.
     * Les fermetures sont des DECLINAISONS du produit, pas des articles qui lui
     * seraient rattaches : leur documentation — photo, description,
     * caracteristiques — est la meme sur toutes les fiches de la famille. La
     * faire voyager dans le payload reviendrait a envoyer le meme texte avec
     * chacune des fiches du catalogue.
     */
    items?: Card[];
    /**
     * Groupe de finitions qui FILTRE les fiches saisies, par son libelle.
     *
     * SANS LUI, LA GRILLE MENT. Les fiches saisies sont fixes : un vestiaire qui
     * ne propose que la fermeture a cles afficherait quand meme le cadenas et
     * les deux serrures a code, et la fiche annoncerait des options que le
     * produit n'a pas. Renseigne, ce champ ne garde que les fiches dont le nom
     * correspond a une valeur REELLEMENT declinee par le produit, dans l'ordre
     * du catalogue.
     *
     * Le rapprochement passe par `normalizeLabel`, comme le nuancier : le
     * catalogue stocke « A code electronique », la fiche saisie s'appelle
     * « Serrure à code électronique ».
     */
    group?: string;
    /**
     * Titre de la section, PORTE PAR LA GRILLE et non par un bloc voisin.
     *
     * UN TITRE POSE A COTE SURVIT A SON CONTENU. « Accessoires » ecrit dans un
     * bloc `Heading` s'imprimait sur les fiches des produits qui n'en ont
     * aucun : un intitule suivi d'un demi-page de blanc, qui affirme une
     * rubrique inexistante. Rattache ici, il disparait avec la grille vide.
     */
    /**
     * Valeurs a ecarter avant tout rapprochement, separees par des virgules.
     *
     * Meme role et meme regle que sur le nuancier : « Sans voile de fond »,
     * « Sans Goulotte », « Sans cloison » sont des choix legitimes en commande,
     * mais ils ne documentent aucune option. Sans ce filtre, un bureau qui
     * n'offre que l'absence allumerait quand meme la fiche de l'option.
     */
    exclude?: string;
    /**
     * Seconde source, lue a la suite de la premiere.
     *
     * Les options vivent tantot en declinaison, tantot en caracteristique selon
     * le produit. Deux grilles auraient impose deux titres pour une seule
     * rubrique ; un second champ suffit, et le rapprochement ne change pas.
     */
    extraSource?: Card[] | string;
    /**
     * Les produits associes, lus PAR LEUR NOM, sans filtre de groupe.
     *
     * Une option se vend parfois comme un produit a part, rattache au bureau en
     * « Produits associes » : « Cloison séparatrice bureau H.35 cm tissu ». Ce
     * n'est ni une declinaison ni une caracteristique, et la rangee l'ignorait.
     * Le nom de l'accessoire passe par le meme rapprochement qu'une valeur de
     * catalogue — exact, puis prefixe —, donc un accessoire qu'aucune fiche ne
     * documente (un fauteuil, un bras d'ecran) n'allume rien.
     */
    relatedSource?: Card[] | string;
    heading?: string;
    headingSize?: number;
    headingColor?: string;
    /** Centre par defaut — « FERMETURES » est a gauche sur les fiches de reference. */
    headingAlign?: Align;
    columns?: number;
    gap?: number;
    rowGap?: number;
    limit?: number;
    showDescription?: boolean;
    showFeatures?: boolean;
    featuresHeading?: string;
    /**
     * Nom au-dessus de l'image (page de detail), en dessous (rangee page 1), ou
     * A SA DROITE : la photo a gauche, nom et texte alignes a gauche a cote.
     *
     * « A droite » est la composition des fermetures sur les fiches Ironside :
     * une petite photo de serrure et son nom sur la meme ligne, deux par rangee.
     * Empilees, quatre fermetures prenaient trois fois la hauteur pour dire la
     * meme chose.
     */
    titlePosition?: "above" | "below" | "beside";
    imageHeight?: number;
    border?: boolean;
    borderColor?: string;
    /**
     * Epaisseur du cadre, en points. 0,5 par defaut — la valeur d'origine, que les
     * fiches publiees gardent. Retour utilisateur : a l'ecran, un trait de 0,5 pt
     * gris clair tombe sous le pixel au zoom d'un lecteur PDF (60 a 75 %), et le
     * lecteur le dessine net d'un cote, efface de l'autre — « les bords sont
     * etranges ». Reproduit avec pdf.js : le trait tombe a cheval sur deux
     * pixels, etale a mi-intensite, et ce gris deja clair disparait. A 1,5 pt
     * (meme couleur), les quatre cotes sont reguliers de 60 a 100 % ; a 1 pt,
     * il faut en plus un gris plus fonce.
     */
    borderWidth?: number;
    /** Espace entre l'image et son cadre, en millimetres. */
    padding?: number;
    /** Arrondi des angles du cadre, en millimetres. */
    radius?: number;
    titleSize?: number;
    size?: number;
    /** Texte justifie : c'est la composition des fiches de reference. */
    justify?: boolean;
  };
  QrCode: {
    /** Contenu a encoder. Le QR est genere au rendu, aucune image a fournir. */
    content?: string;
    /** Image deja prete, si la boutique en fournit une. Prioritaire sur content. */
    source?: string;
    size?: number;
    caption?: string;
    align?: Align;
    dark?: string;
    light?: string;
    margin?: number;
  };
  PageHeader: {
    title?: string;
    subtitle?: string;
    logoUrl?: string;
    logoHeight?: number;
    backgroundUrl?: string;
    backgroundColor?: string;
    textColor?: string;
    height?: number;
  };
  PageFooter: {
    left?: string;
    center?: string;
    backgroundColor?: string;
    backgroundUrl?: string;
    textColor?: string;
    height?: number;
    showPageNumbers?: boolean;
  };
  /**
   * Numerotation utilisable seule, pour composer un pied de page librement.
   *
   * Sans ce bloc, la numerotation n'etait accessible qu'en passant par la mise en
   * page fixe de PageFooter — un couplage genant des que le pied de page contient
   * autre chose (pictos, coordonnees avec icones, comme dans les templates 01, 03
   * et 05 de l'ancien module).
   */
  PageNumber: { format?: string; size?: number; align?: Align; color?: string };
};

const mm = (value: number): string => `${value}mm`;

/**
 * STACK — espacement vertical entre blocs empiles.
 *
 * Rien ne separait les blocs jusqu'ici : chacun portait, ou non, sa propre marge
 * en dur (3 mm sous un titre, 2 mm sous un paragraphe, rien ailleurs). D'ou des
 * fiches tantot serrees tantot aerees, et aucun reglage possible.
 *
 * Realise en flex + gap, et NON par une regle CSS du type `> * + *` : le registry
 * ne pose que des styles EN LIGNE, ce qui est justement ce qui garantit que
 * l'apercu de l'editeur et le PDF ne peuvent pas diverger. Une regle CSS devrait
 * etre injectee dans deux documents distincts — la feuille d'impression et la
 * page de l'editeur — donc dupliquee, avec une divergence a la premiere retouche.
 *
 * Deux effets de bord utiles :
 *  - un element hors flux (« Element positionne ») n'est pas un item flex : le gap
 *    l'ignore, son ancrage reste donc exact ;
 *  - une marge negative sur un bloc « Espace » annule le gap, ce qui permet de
 *    resserrer deux blocs sans toucher au reglage du document.
 *
 * La pagination reste correcte : Chromium sait fragmenter un conteneur flex en
 * colonne. Ce point EXIGEAIT une mesure, la defaillance eventuelle etant
 * silencieuse — une fiche longue tiendrait sur une page, le reste absent sans
 * erreur. Sonde : 90 blocs de texte numerotes, 5 pages produites, et 1881
 * operateurs d'affichage comptes dans le PDF pour 1881 caracteres attendus.
 * Aucun contenu perdu.
 */
const stack = (gap: number): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: mm(gap),
});

/** Un src vide signifie « asset non resolu » : le bloc s'efface au lieu de rendre une image cassee. */
const hasSrc = (value?: string): value is string => typeof value === "string" && value.length > 0;

/**
 * Bordure, espace interieur et arrondi d'une image (blocs Image et Schema coté).
 *
 * Retour utilisateur : « il faut qu'on puisse mettre des bordures aux images ».
 * La Galerie et la Grille de fiches avaient deja leur cadre ; l'image seule non.
 *
 * RIEN N'EST ECRIT TANT QUE RIEN N'EST REGLE : une propriete explicite, meme
 * neutre, changerait le HTML de tous les templates deja publies (temoin
 * fixtures/golden) et pourrait deplacer leurs sauts de page.
 *
 * `box-sizing: border-box` des qu'il y a une bordure ou un espace : sans lui, une
 * image a 100 % de largeur deborderait de sa colonne de leur epaisseur.
 */
function imageFrame(borderWidth?: number, borderColor?: string, padding?: number, radius?: number): CSSProperties {
  const bordered = typeof borderWidth === "number" && borderWidth > 0;
  const padded = typeof padding === "number" && padding > 0;
  const rounded = typeof radius === "number" && radius > 0;
  return {
    ...(bordered ? { border: `${borderWidth}pt solid ${borderColor || "currentColor"}` } : {}),
    ...(padded ? { padding: mm(padding as number) } : {}),
    ...(rounded ? { borderRadius: mm(radius as number) } : {}),
    ...(bordered || padded ? { boxSizing: "border-box" as const } : {}),
  };
}

/** Les champs de imageFrame, identiques sur chaque bloc qui l'emploie. */
const IMAGE_FRAME_FIELDS = {
  borderWidth: { type: "number" as const, label: "Bordure (pt) — 0 = aucune", min: 0, max: 20 },
  borderColor: {
    type: "text" as const,
    label: "Couleur de la bordure",
    placeholder: "vide = couleur du texte",
  },
  padding: { type: "number" as const, label: "Espace entre l'image et la bordure (mm)", min: 0, max: 20 },
  radius: { type: "number" as const, label: "Arrondi des angles (mm)", min: 0, max: 20 },
};

const IMAGE_FRAME_DEFAULTS = { borderWidth: 0, borderColor: "", padding: 0, radius: 0 };

const justifyFor = (align?: Align): string =>
  align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

const ALIGN_OPTIONS = [
  { label: "Gauche", value: "left" },
  { label: "Centre", value: "center" },
  { label: "Droite", value: "right" },
];

const YES_NO = [
  { label: "Non", value: false },
  { label: "Oui", value: true },
];

/**
 * Props de la racine du document.
 *
 * La geometrie de page vit ICI, dans l'arbre, et non dans une colonne settings
 * separee : une seule source de verite, editable dans l'editeur, et le renderer
 * la lit au meme endroit que le reste du template.
 */
export type DatasheetRootProps = {
  /** Marge horizontale du contenu du corps. 0 = pleine largeur. */
  padding?: number;
  paddingRight?: number;
  /** Espacement vertical entre les blocs du corps. Voir STACK. */
  blockGap?: number;
  pageWidth?: number;
  pageHeight?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
};

/**
 * Zebrage par defaut : 14 % de la couleur du TEXTE courant, posee sur le fond du
 * conteneur.
 *
 * La couleur etait auparavant `var(--color-primary)` en dur, avec un texte blanc
 * force. Dans un `Panel` de la meme couleur primaire — la disposition la plus
 * courante des anciens templates — le zebrage devenait donc rigoureusement
 * invisible : bleu sur bleu, sans qu'aucune option ne permette d'en sortir.
 *
 * Un melange de la couleur du texte s'adapte seul aux deux cas : texte blanc sur
 * panneau colore -> lignes plus claires ; texte sombre sur page blanche -> gris
 * tres leger. Aucune valeur fixe ne peut convenir aux deux.
 *
 * color-mix EST supporte par le Chromium de Gotenberg — verifie par mesure, un
 * melange opaque ressortant bien en `.5 0 .5` dans le flux du PDF, la ou une
 * valeur invalide ne produit aucun remplissage.
 */
const DEFAULT_STRIPE = "color-mix(in srgb, currentColor 14%, transparent)";

/** Filet de separation : assez visible pour separer, assez discret pour ne pas cloisonner. */
const DEFAULT_RULE = "color-mix(in srgb, currentColor 40%, transparent)";

/**
 * Fond de la ligne d'en-tete, meme principe que DEFAULT_STRIPE et pour la meme
 * raison : il valait `var(--color-primary)` en dur, donc invisible des que le
 * tableau se trouvait dans un panneau de la couleur primaire.
 *
 * 30 % de la couleur du texte : bande grise a texte sombre sur une page blanche,
 * bande claire a texte blanc sur un panneau colore. Un en-tete doit ressortir
 * plus qu'une ligne alternee, d'ou 30 % contre 14 %.
 */
const DEFAULT_HEADER = "color-mix(in srgb, currentColor 30%, transparent)";

/**
 * Forme comparable d'un libelle de back-office.
 *
 * QUATRE DEFAUTS, TOUS RELEVES DANS LE CATALOGUE REEL, et chacun suffit a faire
 * echouer un rapprochement exact sans qu'aucune erreur ne soit signalee — la
 * pastille reste simplement vide :
 *
 *   espaces de bord      « Sans coiffe », « Coiffe L.120cm », «  4D »
 *   espaces doubles      « Coiffe  L.30cm »
 *   casse                « bleu » et « Bleu » coexistent, « vert » et « Vert »
 *   accents absents      « A code electronique » pour « À code électronique »
 *
 * LE PLIAGE DES ACCENTS EST LE POINT DISCUTABLE : il rapproche des chaines que
 * l'orthographe distingue. Le risque theorique est une collision entre deux
 * valeurs qui ne different que par un accent ; aucune n'existe dans le
 * catalogue, et le cout de l'alternative est concret — il faudrait corriger
 * l'orthographe de valeurs d'attributs utilisees par l'historique des commandes.
 */
export function normalizeLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    // Bloc « Combining Diacritical Marks » : retire l'accent, garde la lettre.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Quelles fiches la grille affiche, et dans quel ordre.
 *
 * EXTRAITE ET TESTEE (src/blocks/cardSelection.test.ts) selon la regle du
 * registry : c'est ici que se joue le seul defaut de ce bloc qui produise un
 * document FAUX plutot que vide. Une grille qui affiche une fermeture que le
 * produit ne propose pas annonce une option inexistante au client, et rien dans
 * le PDF ne le signale.
 *
 * Trois sources, jamais l'une en repli de l'autre :
 *   ""            les fiches saisies, toutes
 *   token + group les fiches saisies, filtrees par les valeurs du produit
 *   token         la collection du payload telle quelle
 *
 * @param source valeur resolue du champ « Donnees affichees »
 * @param items  fiches saisies dans le template
 * @param group  libelle du groupe de finitions qui filtre, ou vide
 */
/**
 * UNE CARACTERISTIQUE EST UN GROUPE A UNE SEULE VALEUR.
 *
 * Le catalogue decrit la meme option de deux facons selon le produit : en
 * DECLINAISON quand le client choisit — « Type d'accoudoirs : 1 D, 3 D » — et en
 * CARACTERISTIQUE quand elle est actee — « Accoudoirs : Accoudoirs 3D ». La
 * seconde forme couvre d'ailleurs plus de produits que la premiere : 95 contre
 * 39 pour les accoudoirs.
 *
 * Plutot que deux mecanismes de rapprochement, on ramene la caracteristique a
 * la forme du groupe. Tout ce qui suit — egalite, prefixe, groupe, exclusion —
 * s'applique alors sans rien savoir de son origine.
 *
 * Une valeur peut porter plusieurs lignes quand le collecteur a regroupe des
 * doublons : chacune devient une valeur a part entiere.
 */
function enGroupes(source: unknown): FinishGrp[] {
  if (!Array.isArray(source)) return [];

  return source.flatMap((entree): FinishGrp[] => {
    const objet = entree as Record<string, unknown>;
    if (Array.isArray(objet?.options)) return [objet as unknown as FinishGrp];

    const nom = typeof objet?.name === "string" ? objet.name : "";
    const valeur = objet?.value;
    if (nom === "" || valeur === undefined || valeur === null) return [];

    return [
      {
        label: nom,
        options: String(valeur)
          .split("\n")
          .map((ligne) => ({ label: ligne.trim() }))
          .filter((option) => option.label !== ""),
      } as FinishGrp,
    ];
  });
}

export function selectCards(
  source: unknown,
  items: unknown,
  group: unknown,
  exclude?: unknown,
  extra?: unknown,
  related?: unknown
): Card[] {
  const saisies = Array.isArray(items) ? (items as Card[]) : [];

  if (source === "" && !Array.isArray(extra) && !Array.isArray(related)) {
    return saisies;
  }

  // PLUSIEURS GROUPES, separes par des virgules — comme le reglage « Groupes de
  // finitions » du module. Les options d'un vestiaire vivent dans trois groupes
  // distincts (« Coiffe inclinée », « Option socle banc », « Option pieds ») et
  // forment pourtant une seule rubrique sur la fiche. Une grille par groupe
  // aurait impose trois titres pour une seule idee.
  const cibles = (typeof group === "string" ? group.split(",") : [])
    .map((nom) => normalizeLabel(nom))
    .filter((nom) => nom !== "");

  if (cibles.length === 0) {
    return Array.isArray(source) ? (source as Card[]) : [];
  }

  // Les deux sources se lisent d'affilee : le produit decide de l'ordre, comme
  // toujours, et une option decrite des deux facons ne sort qu'une fois grace
  // au dedoublonnage par fiche.
  const groupes = [...enGroupes(source), ...enGroupes(extra)];

  // UNE ABSENCE NE DOCUMENTE AUCUNE OPTION. « Sans voile de fond », « Sans
  // Goulotte », « Sans cloison » sont des choix legitimes en commande ; sans ce
  // filtre, un bureau qui n'offre que l'absence allumerait quand meme la fiche.
  const masques = (typeof exclude === "string" ? exclude.split(",") : [])
    .map((mot) => normalizeLabel(mot))
    .filter((mot) => mot !== "");
  const ecartee = (etiquette: string): boolean =>
    masques.some((mot) => etiquette === mot || etiquette.startsWith(mot + " "));

  // L'ORDRE EST CELUI DU CATALOGUE et non celui de la saisie : c'est le produit
  // qui decide de ce qu'il propose, et dans quel ordre il le propose. Le groupe
  // voyage avec sa valeur : certaines fiches se rapprochent de l'un, d'autres
  // de l'autre.
  const valeurs = groupes
    .filter((entree) => cibles.includes(normalizeLabel(entree?.label)))
    .flatMap((entree) =>
      (Array.isArray(entree.options) ? entree.options : []).map((option) => ({
        groupe: normalizeLabel(entree?.label),
        valeur: normalizeLabel(option?.label),
      }))
    )
    .filter((paire) => !ecartee(paire.valeur));

  // LES PRODUITS ASSOCIES N'ONT PAS DE GROUPE : seul leur nom se rapproche, et
  // le repli sur `matchGroup` ne s'applique pas — un groupe vide n'y repond pas.
  const associes = (Array.isArray(related) ? related : [])
    .map((accessoire) => ({ groupe: "", valeur: normalizeLabel((accessoire as Card)?.name) }))
    .filter((paire) => paire.valeur !== "" && !ecartee(paire.valeur));

  const retenues: Card[] = [];
  for (const { groupe, valeur } of [...valeurs, ...associes]) {
    const carte = rapprocher(saisies, valeur, groupe);
    // UNE FICHE N'APPARAIT QU'UNE FOIS. Le catalogue decline « Socle banc
    // L.30cm » jusqu'a « L.120cm » : six valeurs qui designent le meme objet.
    // Sans ce filtre, la grille imprimerait six fois la meme photo.
    if (carte !== undefined && !retenues.includes(carte)) {
      retenues.push(carte);
    }
  }

  return retenues;
}

/**
 * La fiche qui documente une valeur du catalogue, ou `undefined`.
 *
 * DEUX PASSES, ET L'ORDRE COMPTE.
 *
 * 1. Egalite exacte. C'est le cas des fermetures, ou chaque valeur a sa fiche.
 *
 * 2. A defaut, PREFIXE LE PLUS LONG. Le catalogue nomme ses options par leur
 *    type ET leur taille — « Socle banc L.30cm », « Coiffe L.90cm », « Pieds
 *    inox » — alors que la photo documente le TYPE. Une fiche « Socle banc »
 *    doit donc repondre pour les six longueurs.
 *
 *    Le plus long gagne, faute de quoi « Socle banc » repondrait aussi pour
 *    « Socle banc retractable L30 cm », qui est un autre produit et a sa propre
 *    photo. C'est la seule regle qui rende ce cas deterministe.
 *
 *    Le prefixe doit s'arreter sur une ESPACE : sans cette frontiere, une fiche
 *    nommee « Cle » repondrait pour « Cles », et une fiche d'une lettre
 *    repondrait pour tout le catalogue.
 */
function rapprocher(saisies: Card[], etiquette: string, groupe: string): Card | undefined {
  if (etiquette === "") return undefined;

  // UNE FICHE PEUT PORTER LES DEUX. « Roulettes » se reconnait a la valeur
  // « Roulettes autobloquantes » dans le groupe « Type piétement », et au
  // GROUPE « Roulettes » quand c'est une caracteristique qui repond « Oui ».
  // Un seul libelle ne suffit donc pas, et deux fiches repeteraient la photo.
  //
  // Les fiches sans `match` ne concourent pas sur la valeur : leur nom imprime
  // n'est pas un libelle de catalogue et rapprocherait au hasard.
  const parValeur = saisies.filter((carte) => carte?.match || !carte?.matchGroup);

  /**
   * PLUSIEURS LIBELLES POUR UNE SEULE FICHE, separes par des virgules.
   *
   * Une cloison de bureau se decline en « Tissu Gris », « Tissu Vert »,
   * « Polycarbonate blanc »… : des matieres et des couleurs differentes pour la
   * MEME option. Ce que la fiche documente est la presence d'une cloison, pas sa
   * teinte — une fiche par valeur repeterait la meme photo cinq fois.
   */
  const cles = (carte: Card): string[] =>
    (carte?.match || carte?.name || "")
      .split(",")
      .map((mot) => normalizeLabel(mot))
      .filter((mot) => mot !== "");

  const exacte = parValeur.find((carte) => cles(carte).includes(etiquette));
  if (exacte !== undefined) return exacte;

  let meilleure: Card | undefined;
  let longueur = 0;

  for (const carte of parValeur) {
    for (const prefixe of cles(carte)) {
      if (prefixe.length <= longueur) continue;
      if (etiquette.startsWith(prefixe + " ")) {
        meilleure = carte;
        longueur = prefixe.length;
      }
    }
  }
  if (meilleure !== undefined) return meilleure;

  // A DEFAUT, LE GROUPE. Le catalogue decline « Retour » en « Droit » et
  // « Gauche » : ce que la fiche documente est l'option, pas le cote choisi.
  // PLUSIEURS GROUPES POUR UNE FICHE, comme pour les libelles : le catalogue
  // decrit le socle d'un vestiaire dans « Socle casier », « Option socle » ou
  // « Plinthe » selon le produit, et tous se declinent en « Avec » et « Sans ».
  // Trois fiches auraient repete la meme photo.
  if (groupe === "") return undefined;

  return saisies.find((carte) =>
    (carte?.matchGroup ?? "")
      .split(",")
      .map((nom) => normalizeLabel(nom))
      .includes(groupe)
  );
}

/** Une caracteristique prete a afficher : un libelle, une ou plusieurs valeurs. */
type GroupedFeature = { name: string; cells: string[] };

/**
 * Regroupe les caracteristiques portant le meme libelle.
 *
 * PrestaShop autorise plusieurs valeurs sous un meme nom de caracteristique, et
 * les catalogues du parc en usent : « Reglage / hauteur », « Reglage / assise ».
 * Chacune arrive comme une ligne distincte, ce qui produit un tableau deux fois
 * plus haut que necessaire et pousse la fiche sur une seconde page.
 *
 * L'abreviation reste collee A SA valeur et non au groupe : c'est un renvoi vers
 * une cote du schema, il designe une valeur precise. Regrouper « (H) » et « (A) »
 * en fin de ligne les rendrait inutilisables.
 */
export function groupFeatures(
  rows: Feature[],
  showAbbreviation: boolean,
  group: boolean
): GroupedFeature[] {
  const out: GroupedFeature[] = [];
  const index = new Map<string, number>();

  for (const row of rows) {
    const name = String(row?.name ?? "");
    const value = String(row?.value ?? "");
    const abbreviation = row?.abbreviation;
    const cell = showAbbreviation && abbreviation ? `${value} (${abbreviation})` : value;

    if (!group) {
      out.push({ name, cells: [cell] });
      continue;
    }

    // Cle normalisee : « Reglage », « reglage » et « Reglage  » designent la meme
    // caracteristique pour qui lit la fiche, donc pour le tableau. Le libelle
    // affiche reste celui de la premiere occurrence.
    const key = name.trim().toLowerCase().replace(/\s+/g, " ");
    const at = index.get(key);

    if (at === undefined) {
      index.set(key, out.length);
      out.push({ name, cells: [cell] });
      continue;
    }

    // Une meme valeur saisie deux fois sous le meme libelle n'est pas repetee.
    if (!out[at].cells.includes(cell)) {
      out[at].cells.push(cell);
    }
  }

  return out;
}

/**
 * Etiquette de conteneur, visible UNIQUEMENT dans l'editeur.
 *
 * Sans elle, un conteneur dont les slots occupent toute la surface est
 * impossible a selectionner : chaque clic atteint le slot, jamais le conteneur.
 * Donc impossible de le supprimer, de le deplacer ou de regler ses proprietes
 * DEPUIS LE CANVAS — le passage par le panneau Outline (l'arbre des composants)
 * reste, lui, toujours possible : c'est un chemin distinct dans Puck, qui ne
 * repose pas sur un clic dans la surface du conteneur.
 *
 * L'etiquette a donc deux roles : identifier visuellement le conteneur (comme
 * avant), et depuis ce tour, agir directement sur lui sans passer par l'Outline —
 * selectionner, dupliquer, supprimer. Elle disparait du PDF, ou le contexte Puck
 * est absent.
 *
 * COMMENT L'ACTION ATTEINT PUCK SANS HOOK ICI. Ce fichier est importe par le
 * chemin de rendu PDF (voir l'en-tete du fichier) : aucun hook n'y est permis, y
 * compris dans ce composant, qui est appele que ce soit `puck.isEditing` vrai
 * ou faux. Le clic emet donc un CustomEvent DOM ordinaire (aucun hook), capte
 * par `ContainerActionsBridge` dans src/blocks/previewConfig.tsx — un module
 * garanti EDITEUR SEUL, ou `usePuck()` est sans risque.
 */
function ContainerTag({
  puck,
  label,
  id,
  slotFields,
}: {
  puck?: { isEditing?: boolean };
  label: string;
  /** Identifiant Puck du conteneur, fourni par `WithId`. Absent hors editeur. */
  id?: string;
  /** Noms des props de type Slot portees par ce conteneur — voir CanEmitContainerEvent. */
  slotFields?: string[];
}) {
  if (!puck?.isEditing) return <></>;

  /**
   * POURQUOI `onClickCapture` ET NON `onClick` — mesure, pas preference.
   *
   * Puck enveloppe chaque bloc du canvas dans un conteneur qui ARRETE la
   * propagation du clic. React 19 delegue ses gestionnaires a la racine de
   * l'application : un `onClick` pose ici n'est donc jamais appele, puisque
   * l'evenement n'atteint plus la racine. Constate dans un navigateur avec le
   * code reel — en instrumentant chaque ancetre, le clic remonte l'etiquette et
   * deux div, puis s'arrete juste avant la DropZone de Puck.
   *
   * La phase de CAPTURE, elle, descend de la racine vers la cible : le
   * gestionnaire delegue de React s'y execute AVANT l'ancetre qui arrete tout.
   * C'est ce qui rend ces trois boutons a nouveau cliquables.
   *
   * A reverifier a chaque montee de version de @puckeditor/core : si Puck cesse
   * d'arreter la propagation, `onClick` redeviendrait suffisant — mais la
   * capture, elle, continuerait de fonctionner.
   */
  const emit = (kind: "select" | "remove" | "duplicate") => (event: MouseEvent) => {
    // En capture, l'etiquette recoit AUSSI les clics de ses propres boutons,
    // avant eux. Sans ce garde-fou, `stopPropagation` ci-dessous les priverait
    // de leur clic et « Dupliquer » selectionnerait au lieu de dupliquer.
    if (kind === "select" && (event.target as Element | null)?.closest?.("button")) return;

    event.stopPropagation();
    if (!id) return;
    window.dispatchEvent(
      new CustomEvent(`ds:${kind}-container`, { detail: { id, slotFields: slotFields ?? [] } })
    );
  };

  return (
    <span
      // La classe permet a la feuille de l'editeur d'estomper l'etiquette au
      // repos : sur une fiche composee de conteneurs imbriques, une dizaine
      // d'etiquettes opaques recouvrent le contenu qu'on essaie justement de
      // juger. Elle reprend sa pleine opacite au survol du conteneur.
      className="ds-tag"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 9,
        transform: "translateY(-100%)",
        // Jeton de la surface de page, defini dans globals.css. Utilisable ici
        // sans risque pour le PDF : ce composant ne rend rien hors de l'editeur
        // (garde `puck.isEditing` en tete de fonction), et la variable n'existe
        // donc jamais dans le document imprime.
        background: "var(--sheet-tag)",
        color: "#fff",
        font: "600 9px/1.6 system-ui, sans-serif",
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        padding: "0 2px 0 5px",
        borderRadius: "3px 3px 0 0",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        // Le bloc parent (le conteneur lui-meme) ignore le pointeur : cette
        // etiquette est la SEULE surface cliquable qu'on lui ajoute, et son
        // empreinte visuelle correspond exactement a sa zone cliquable — pas
        // de zone fantome au-dessus du contenu.
        pointerEvents: "auto",
        cursor: id ? "pointer" : "default",
      }}
      onClickCapture={emit("select")}
      title={id ? `Sélectionner ${label}` : undefined}
    >
      {label}
      {id ? (
        <>
          <button
            type="button"
            className="ds-tag-btn"
            aria-label={`Dupliquer ${label}`}
            title={`Dupliquer ${label}`}
            onClickCapture={emit("duplicate")}
            style={ContainerTagButtonStyle}
          >
            ⧉
          </button>
          <button
            type="button"
            // Deuxieme classe : distinction visuelle au survol/focus, pas
            // seulement par la forme du glyphe — voir son style dans editor.css
            // pour le calcul de contraste qui justifie la couleur choisie.
            // Ecart supplementaire avant ce bouton (marginLeft) : irreversible,
            // il ne doit pas etre le clic « le plus proche » depuis Dupliquer.
            className="ds-tag-btn ds-tag-btn-danger"
            aria-label={`Supprimer ${label}`}
            title={`Supprimer ${label}`}
            onClickCapture={emit("remove")}
            style={{ ...ContainerTagButtonStyle, marginLeft: "3px" }}
          >
            ✕
          </button>
        </>
      ) : null}
    </span>
  );
}

/** Boutons de l'etiquette : memes proportions, sans bordure ni fond propre. */
const ContainerTagButtonStyle: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  padding: "0 3px",
  cursor: "pointer",
  lineHeight: 1.6,
};

export const datasheetConfig: Config<DatasheetProps, DatasheetRootProps> = {
  categories: {
    structure: {
      title: "Structure",
      components: ["Columns", "Panel", "Group", "Positioned", "Spacer", "Divider", "PageBreak"],
    },
    contenu: { title: "Contenu", components: ["Heading", "Text", "RichText", "Image"] },
    produit: {
      title: "Produit",
      components: ["FeatureTable", "ImageGallery", "SchemaImage", "BadgeRow", "KeyValueGrid", "QrCode"],
    },
    /**
     * Categorie a part, et non un ajout a « Produit ».
     *
     * Ces quatre blocs repondent a une autre question : non pas « qu'est-ce que
     * ce produit », mais « qu'est-ce que le client choisit, et qu'est-ce qui
     * s'y accroche ». Les noyer parmi les six blocs Produit rendrait la palette
     * illisible au moment precis ou l'on compose la page de choix.
     */
    choix: {
      title: "Choix et détails",
      components: ["SwatchGroups", "HighlightRow", "CardGrid"],
    },
    bandeaux: { title: "Bandeaux", components: ["PageHeader", "PageFooter", "PageNumber"] },
    /**
     * Les composants reutilisables : un pied de page, un bandeau de coordonnees,
     * composes une fois, places partout. L'editeur remplace le champ texte par
     * la liste des composants disponibles, et retire le bloc quand on compose un
     * composant (pas de composant dans un composant).
     */
    composants: { title: "Composants", components: ["Composant"] },
  },

  root: {
    fields: {
      pageWidth: { type: "number", label: "Largeur de page (mm)", min: 100, max: 500 },
      pageHeight: { type: "number", label: "Hauteur de page (mm)", min: 100, max: 500 },
      marginTop: {
        type: "number",
        label: "Bande haute réservée à l'en-tête (mm)",
        min: 0,
        max: 80,
      },
      marginBottom: {
        type: "number",
        label: "Bande basse réservée au pied (mm)",
        min: 0,
        max: 80,
      },
      marginLeft: { type: "number", label: "Marge papier gauche (mm)", min: 0, max: 60 },
      marginRight: { type: "number", label: "Marge papier droite (mm)", min: 0, max: 60 },
      padding: {
        type: "number",
        label: "Retrait du contenu à gauche (mm) — 0 = pleine largeur",
        min: 0,
        max: 40,
      },
      paddingRight: {
        type: "number",
        label: "Retrait du contenu à droite (mm) — 0 = pleine largeur",
        min: 0,
        max: 40,
      },
      blockGap: {
        type: "number",
        label: "Espacement entre les blocs (mm)",
        min: 0,
        max: 30,
      },
    },
    defaultProps: {
      padding: 12,
      paddingRight: 12,
      // 4 mm : assez pour que deux blocs ne se touchent pas, assez peu pour ne
      // pas couter une page. Reglable, et 0 redonne le comportement d'avant.
      blockGap: 4,
      pageWidth: 210,
      pageHeight: 297,
      // Les marges haute et basse reservent la place des bandeaux repetes :
      // Chromium y dessine header.html et footer.html.
      marginTop: 32,
      marginBottom: 22,
      marginLeft: 0,
      marginRight: 0,
    },
    render: ({
      padding,
      paddingRight,
      blockGap,
      pageWidth,
      pageHeight,
      marginTop,
      marginBottom,
      children,
      puck,
    }) => {
      // Hauteur utile d'une feuille. Une seule formule, ici, pour les deux
      // chemins : le canvas la relit dans la variable posee ci-dessous.
      const contentMm = Math.max(20, (pageHeight ?? 297) - (marginTop ?? 32) - (marginBottom ?? 22));

      /**
       * Les reglages de la racine qui s'appliquent DANS chaque page.
       *
       * Ils descendent par variables CSS et non par props, parce que le corps
       * est desormais une liste de blocs `Page` : ces blocs sont des enfants
       * ordinaires de la zone racine, et rien ne permet a la racine de leur
       * passer quoi que ce soit. Une variable CSS traverse, et se met a jour a
       * la frappe.
       */
      const reglagesDePage = {
        "--ds-pad-left": mm(padding ?? 12),
        // Le retrait droit retombe sur le gauche s'il n'est pas defini :
        // les templates crees avant l'ajout de ce champ restent symetriques.
        "--ds-pad-right": mm(paddingRight ?? padding ?? 12),
        "--ds-block-gap": mm(blockGap ?? 4),
        // SANS CE MINIMUM, une page s'arretait a la hauteur de son contenu : un
        // bandeau lateral etire s'interrompait donc au dernier bloc, laissant
        // une bande blanche jusqu'au bas de la feuille. Un MINIMUM, pas une
        // hauteur : un contenu plus long continue de se paginer.
        "--ds-page-content": mm(contentMm),
      } as CSSProperties;

      // CHEMIN PDF. Le contexte Puck est absent hors de l'editeur : aucun repere,
      // aucune surface de page, rien qui puisse fuir dans un document.
      //
      // La racine n'applique plus ni retrait ni espacement : c'est chaque page
      // qui le fait, et le corps est TOUJOURS une liste de pages — les arbres
      // enregistres avant l'introduction des pages sont convertis au rendu par
      // `normalizeBodyTree` (src/lib/pages.ts). Sans cette garantie, la racine
      // et les pages appliqueraient le retrait toutes les deux.
      if (!puck?.isEditing) {
        return (
          <div className="ds-body" style={{ ...reglagesDePage, position: "relative" }}>
            {children}
          </div>
        );
      }

      // La zone en cours d'edition est transmise par <Puck metadata>.
      const meta = (puck.metadata ?? {}) as CanvasMeta;

      // Les zones repetees ignorent la racine au rendu : elle ne porte que la
      // geometrie de page, le retrait du corps et les reperes de pagination.
      if (meta.zone === "header" || meta.zone === "footer") {
        return <MarginBoxCanvas meta={meta}>{children}</MarginBoxCanvas>;
      }

      return (
        <BodyCanvas pageWidth={pageWidth ?? 210} style={reglagesDePage}>
          {children}
        </BodyCanvas>
      );
    },
  },

  components: {
    // ---------------------------------------------------------------- Structure

    Columns: {
      label: "Colonnes",
      fields: {
        ratio: {
          type: "select",
          label: "Répartition",
          options: [
            { label: "50 / 50", value: "1fr 1fr" },
            { label: "1 / 2", value: "1fr 2fr" },
            { label: "2 / 1", value: "2fr 1fr" },
            { label: "1 / 3", value: "1fr 3fr" },
            { label: "3 / 1", value: "3fr 1fr" },
          ],
        },
        gap: { type: "number", label: "Espacement entre les colonnes (mm)", min: 0, max: 30 },
        contentGap: { type: "number", label: "Espacement dans une colonne (mm)", min: 0, max: 30 },
        align: {
          type: "select",
          label: "Alignement vertical",
          options: [
            { label: "Haut", value: "start" },
            { label: "Centre", value: "center" },
            { label: "Bas", value: "end" },
            // Sans cette valeur, aucune colonne ne peut porter un fond qui
            // descend jusqu'en bas de la rangee : chaque colonne s'arretait a la
            // hauteur de son propre contenu. C'est ce qui rendait un bandeau
            // lateral colore — le parti pris le plus courant d'une fiche
            // composee — inatteignable, quel que soit le reglage tente.
            { label: "Étirer sur toute la hauteur", value: "stretch" },
          ],
        },
        avoidBreak: { type: "radio", label: "Garder sur une seule page", options: YES_NO },
        fillHeight: {
          type: "radio",
          label: "Occuper toute la hauteur disponible",
          options: YES_NO,
        },
        left: { type: "slot" },
        right: { type: "slot" },
        third: { type: "slot" },
        divider: { type: "radio", label: "Filet entre les colonnes", options: YES_NO },
        dividerColor: { type: "text", label: "Couleur du filet" },
      },
      defaultProps: {
        ratio: "1fr 1fr",
        gap: 6,
        contentGap: 4,
        align: "start",
        avoidBreak: false,
        fillHeight: false,
        divider: false,
        dividerColor: "",
        left: [],
        right: [],
        third: [],
      },
      render: ({
        ratio,
        gap,
        contentGap,
        align,
        avoidBreak,
        fillHeight,
        divider,
        dividerColor,
        left: Left,
        right: Right,
        third: Third,
        puck,
        id,
      }) => {
        // LE FILET APPARTIENT AUX COLONNES QUI SUIVENT LA PREMIERE, et il est
        // pose a mi-distance dans la gouttiere : borde a ras du texte, il se
        // lirait comme un cadre ouvert plutot que comme une separation.
        const filet = divider
          ? {
              borderLeft: `0.2mm solid ${dividerColor || "currentColor"}`,
              paddingLeft: mm((gap ?? 6) / 2),
            }
          : undefined;
        // Le troisieme slot n'occupe une colonne QUE si le ratio en declare trois :
        // un template a deux colonnes n'herite ainsi d'aucune colonne vide.
        const columns = (ratio ?? "1fr 1fr").trim().split(/\s+/).length;

        return (
          // grid : impossible avec mPDF, qui imposait des <table> imbriquees
          // avec des largeurs en mm codees en dur.
          <div
            /*
             * Marqueur lu par editor.css, et par lui seul.
             *
             * Dans l'editeur, Puck intercale [data-puck-dropzone] puis
             * [data-puck-component] entre le conteneur de page et ce bloc, tous
             * deux en display:block : le `flexGrow` ci-dessous s'applique alors
             * a un enfant de bloc, donc a rien. Mesure sur un Puck reel : le
             * conteneur faisait 918 px, ce bloc 18. Les enveloppes ne peuvent
             * grandir que si elles savent qu'un bloc le demande — c'est ce que
             * cet attribut leur dit, via :has().
             *
             * Aucun effet sur le chemin PDF, ou les enveloppes n'existent pas.
             */
            data-ds-fill={fillHeight ? "" : undefined}
            style={{
              display: "grid",
              gridTemplateColumns: ratio ?? "1fr 1fr",
              gap: mm(gap ?? 6),
              alignItems: align ?? "start",
              breakInside: avoidBreak ? "avoid" : undefined,
              // `flexGrow` et non une hauteur : ce bloc est un item du STACK de
              // son parent (flex en colonne). Une hauteur en pourcentage s'y
              // resoudrait contre une valeur que le parent ne fixe pas ; seul
              // flexGrow prend la place restante — celle que la racine reserve
              // desormais en imposant la hauteur d'une page.
              flexGrow: fillHeight ? 1 : undefined,
              minHeight: fillHeight ? 0 : undefined,
              // Ancre l'etiquette d'editeur sur ce conteneur.
              position: "relative",
            }}
          >
            <ContainerTag
              puck={puck}
              label={`Colonnes ${columns} — hauteur auto`}
              id={id}
              slotFields={["left", "right", "third"]}
            />
            <div style={stack(contentGap ?? 4)}>
              <Left />
            </div>
            <div style={{ ...stack(contentGap ?? 4), ...filet }}>
              <Right />
            </div>
            {columns >= 3 ? (
              <div style={{ ...stack(contentGap ?? 4), ...filet }}>
                <Third />
              </div>
            ) : null}
          </div>
        );
      },
    },

    Panel: {
      label: "Panneau (fond, bordure)",
      fields: {
        background: { type: "text", label: "Couleur de fond", placeholder: "vide = transparent" },
        backgroundImage: {
          type: "text",
          label: "Image de fond",
          placeholder: "/assets/shared/bandeau-haut",
        },
        backgroundSize: {
          type: "select",
          label: "Cadrage de l'image de fond",
          options: [
            { label: "Remplir en rognant (cover)", value: "cover" },
            { label: "Contenir en entier (contain)", value: "contain" },
            { label: "Étirer sur toute la largeur", value: "100% 100%" },
            { label: "Taille réelle", value: "auto" },
          ],
        },
        backgroundPosition: {
          type: "select",
          label: "Position de l'image de fond",
          options: [
            { label: "Centre", value: "center" },
            { label: "Haut", value: "top" },
            { label: "Bas", value: "bottom" },
            { label: "Gauche", value: "left" },
            { label: "Droite", value: "right" },
          ],
        },
        color: { type: "text", label: "Couleur du texte" },
        borderWidth: { type: "number", label: "Épaisseur de bordure (pt)", min: 0, max: 20 },
        borderColor: { type: "text", label: "Couleur de bordure" },
        padding: { type: "number", label: "Marge intérieure (mm)", min: 0, max: 20 },
        radius: { type: "number", label: "Arrondi (mm)", min: 0, max: 10 },
        align: { type: "select", label: "Alignement du texte", options: ALIGN_OPTIONS },
        contentGap: { type: "number", label: "Espacement entre les blocs internes (mm)", min: 0, max: 30 },
        height: {
          type: "number",
          label: "Hauteur fixe (mm) — 0 = selon le contenu",
          min: 0,
          max: 80,
        },
        fillHeight: {
          type: "radio",
          label: "Occuper toute la hauteur disponible",
          options: YES_NO,
        },
        verticalAlign: {
          type: "select",
          label: "Alignement vertical du contenu",
          options: [
            { label: "Centre", value: "center" },
            { label: "Haut", value: "start" },
            { label: "Bas", value: "end" },
          ],
        },
        avoidBreak: { type: "radio", label: "Garder sur une seule page", options: YES_NO },
        content: { type: "slot" },
      },
      defaultProps: {
        background: "var(--color-primary)",
        backgroundImage: "",
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: "#ffffff",
        borderWidth: 0,
        borderColor: "var(--color-primary)",
        padding: 3,
        radius: 0,
        align: "left",
        contentGap: 4,
        height: 0,
        fillHeight: false,
        verticalAlign: "center",
        avoidBreak: false,
        content: [],
      },
      render: ({
        background,
        backgroundImage,
        backgroundSize,
        backgroundPosition,
        color,
        borderWidth,
        borderColor,
        padding,
        radius,
        align,
        contentGap,
        height,
        fillHeight,
        verticalAlign,
        avoidBreak,
        content: Content,
        puck,
        id,
      }) => {
        // Une hauteur fixe transforme le panneau en bandeau : on passe alors en
        // flex pour pouvoir centrer verticalement le contenu, ce qu'un simple
        // bloc ne permet pas. Sans hauteur, le comportement reste celui d'un
        // conteneur ordinaire — les templates deja composes ne bougent pas.
        const isBand = typeof height === "number" && height > 0;

        // « Occuper toute la hauteur » n'a de sens qu'a defaut de hauteur fixe :
        // les deux reglages decrivent la meme dimension, et une hauteur explicite
        // est la plus specifique des deux, donc elle gagne.
        const isFilling = fillHeight === true && !isBand;

        return (
          <div
            /* Voir Columns : marqueur lu par editor.css pour que les enveloppes
               inserees par Puck relaient l'etirement dans l'editeur. */
            data-ds-fill={isFilling ? "" : undefined}
            style={{
              width: "100%",
              boxSizing: "border-box",
              backgroundColor: background || undefined,
              backgroundImage: hasSrc(backgroundImage) ? `url("${backgroundImage}")` : undefined,
              backgroundSize: hasSrc(backgroundImage) ? backgroundSize || "cover" : undefined,
              backgroundPosition: hasSrc(backgroundImage) ? backgroundPosition || "center" : undefined,
              backgroundRepeat: "no-repeat",
              color: color || undefined,
              border: borderWidth ? `${borderWidth}pt solid ${borderColor || "currentColor"}` : undefined,
              padding: mm(padding ?? 3),
              borderRadius: radius ? mm(radius) : undefined,
              textAlign: align ?? "left",
              breakInside: avoidBreak ? "avoid" : undefined,
              // Contexte de positionnement : indispensable pour que les blocs
              // « Element positionne » se placent par rapport a CE panneau, et
              // non par rapport a la page entiere.
              position: "relative",
              ...(isBand
                ? {
                    height: mm(height as number),
                    display: "flex",
                    alignItems: verticalAlign ?? "center",
                  }
                : {}),
              ...(isFilling
                ? {
                    // `flexGrow` et non `height: 100%` : le panneau est un enfant
                    // du conteneur flex en colonne pose par STACK. Un pourcentage
                    // s'y resout contre une hauteur que le parent n'a pas fixee,
                    // donc sans effet ; `flexGrow` prend au contraire toute la
                    // place restante, ce qui est exactement le comportement voulu.
                    flexGrow: 1,
                    // Sans cela, le contenu impose son minimum et le panneau ne
                    // peut pas se reduire sous cette taille dans une colonne
                    // etroite — le fond deborderait de la rangee.
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: verticalAlign ?? "start",
                  }
                : {}),
            }}
          >
            <ContainerTag
              puck={puck}
              label={isBand ? `Bandeau ${height} mm` : "Panneau — hauteur auto"}
              id={id}
              slotFields={["content"]}
            />
            {/* Un seul enveloppement dans les deux cas : le contenu d'un bandeau et
                celui d'un panneau s'espacent donc de la meme facon, et il n'y a plus
                deux structures de DOM a maintenir pour un meme bloc. */}
            <div style={{ width: "100%", ...stack(contentGap ?? 4) }}>
              <Content />
            </div>
          </div>
        );
      },
    },

    Group: {
      label: "Groupe",
      fields: {
        contentGap: {
          type: "number",
          label: "Espacement entre les blocs du groupe (mm) — vide = celui de la zone",
          min: 0,
          max: 30,
        },
        avoidBreak: { type: "radio", label: "Garder sur une seule page", options: YES_NO },
        content: { type: "slot" },
      },
      defaultProps: { avoidBreak: false, content: [] },
      render: ({ contentGap, avoidBreak, content: Content, puck, id }) => (
        // Ni fond, ni bordure, ni marge : a l'impression, un groupe n'est que
        // l'empilement de ses blocs. Sans espacement saisi, `gap: inherit`
        // reprend celui du conteneur parent — la page, la colonne, le panneau —
        // dont le groupe est l'enfant direct dans le PDF.
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: typeof contentGap === "number" ? mm(contentGap) : "inherit",
            breakInside: avoidBreak ? "avoid" : undefined,
            // Ancre l'etiquette d'editeur, comme pour les autres conteneurs.
            position: "relative",
          }}
        >
          <ContainerTag puck={puck} label="Groupe" id={id} slotFields={["content"]} />
          <Content />
        </div>
      ),
    },

    Positioned: {
      label: "Élément positionné",
      fields: {
        anchor: {
          type: "select",
          label: "Ancrage dans le conteneur",
          options: [
            { label: "Haut gauche", value: "top-left" },
            { label: "Haut centre", value: "top-center" },
            { label: "Haut droite", value: "top-right" },
            { label: "Milieu gauche", value: "middle-left" },
            { label: "Centre", value: "middle-center" },
            { label: "Milieu droite", value: "middle-right" },
            { label: "Bas gauche", value: "bottom-left" },
            { label: "Bas centre", value: "bottom-center" },
            { label: "Bas droite", value: "bottom-right" },
          ],
        },
        offsetX: { type: "number", label: "Décalage horizontal (mm)", min: -200, max: 200 },
        offsetY: { type: "number", label: "Décalage vertical (mm)", min: -200, max: 200 },
        width: { type: "number", label: "Largeur (mm) — 0 = selon le contenu", min: 0, max: 300 },
        zIndex: { type: "number", label: "Ordre de superposition", min: 0, max: 20 },
        content: { type: "slot" },
      },
      defaultProps: {
        anchor: "top-left",
        offsetX: 8,
        offsetY: 4,
        width: 0,
        zIndex: 2,
        content: [],
      },
      render: ({ anchor, offsetX, offsetY, width, zIndex, content: Content, puck, id }) => {
        const [vertical, horizontal] = (anchor ?? "top-left").split("-");
        const dx = offsetX ?? 0;
        const dy = offsetY ?? 0;

        const style: Record<string, string | number> = {
          position: "absolute",
          zIndex: zIndex ?? 2,
        };

        // Les decalages s'ajoutent TOUJOURS vers l'interieur du conteneur, quel
        // que soit l'ancrage : un decalage positif eloigne du bord choisi, ce qui
        // est le comportement attendu quand on regle « a 5 mm du bord droit ».
        if (vertical === "top") {
          style.top = mm(dy);
        } else if (vertical === "bottom") {
          style.bottom = mm(dy);
        } else {
          style.top = "50%";
        }

        if (horizontal === "left") {
          style.left = mm(dx);
        } else if (horizontal === "right") {
          style.right = mm(dx);
        } else {
          style.left = "50%";
        }

        // Le centrage exige une translation : sans elle, « centre » alignerait le
        // bord de l'element sur le milieu, pas son centre.
        const translateX = horizontal === "center" ? `calc(-50% + ${mm(dx)})` : "0";
        const translateY = vertical === "middle" ? `calc(-50% + ${mm(dy)})` : "0";
        if (translateX !== "0" || translateY !== "0") {
          style.transform = `translate(${translateX}, ${translateY})`;
        }

        if (width && width > 0) {
          style.width = mm(width);
        }

        // En edition, un element positionne vide n'aurait aucune surface
        // cliquable : on lui garantit de quoi etre saisi et supprime.
        if (puck?.isEditing) {
          style.minWidth = "12mm";
          style.minHeight = "8mm";
          // Meme jeton que l'etiquette, pour que le repere d'un element
          // positionne et son etiquette ne soient pas de deux bleus differents.
          style.outline = "1px dashed var(--sheet-tag)";
        }

        return (
          // La classe est indispensable DANS L'EDITEUR, et n'a aucun effet au
          // rendu. Puck impose `el.style.position = "relative"` sur l'element
          // racine de chaque bloc, par effet, apres le rendu de React : un
          // element positionne se retrouvait donc dans le flux a l'ecran, et hors
          // flux dans le PDF. Une regle `!important` de la feuille de l'editeur
          // reprend la main sur ce style en ligne. Le PDF, lui, ne definit pas
          // cette classe et applique le style en ligne, inchange.
          <div className="ds-positioned" style={style}>
            <ContainerTag
              puck={puck}
              label={`Positionné ${anchor ?? "top-left"}`}
              id={id}
              slotFields={["content"]}
            />
            <Content />
          </div>
        );
      },
    },

    Composant: {
      label: "Composant",
      fields: {
        component: { type: "text", label: "Composant" },
      },
      defaultProps: { component: "" },
      /*
       * RIEN AU RENDU PDF : le bloc est remplace par le contenu du composant
       * avant le rendu (src/lib/componentStore.ts). Arriver ici veut dire que le
       * composant est introuvable — supprime, jamais publie, ou d'une autre
       * boutique — et la fiche sort sans lui. L'editeur, lui, affiche le contenu
       * (src/blocks/previewConfig.tsx).
       */
      render: () => <></>,
    },

    Spacer: {
      label: "Espace",
      fields: {
        height: {
          type: "number",
          label: "Hauteur (mm) — une valeur négative resserre",
          min: -60,
          max: 100,
        },
      },
      defaultProps: { height: 6 },
      render: ({ height, puck }) => {
        const value = height ?? 6;

        return (
          <div
            style={{
              // Une hauteur negative se traduit en marge negative : c'est le seul
              // moyen de RETIRER de l'espace, l'espacement du document ne pouvant
              // que s'ajouter. Utile pour coller un sous-titre a son titre sans
              // deregler l'aeration de toute la fiche.
              height: value > 0 ? mm(value) : 0,
              marginBottom: value < 0 ? mm(value) : undefined,
              position: "relative",
            }}
          >
            <ContainerTag
              puck={puck}
              label={value < 0 ? `Resserré ${-value} mm` : `Espace ${value} mm`}
            />
          </div>
        );
      },
    },

    Divider: {
      label: "Filet",
      fields: {
        orientation: {
          type: "radio",
          label: "Orientation",
          options: [
            { label: "Horizontal", value: "horizontal" },
            { label: "Vertical", value: "vertical" },
          ],
        },
        thickness: { type: "number", label: "Épaisseur (pt)", min: 1, max: 8 },
        color: { type: "text", label: "Couleur", placeholder: "var(--color-primary)" },
        margin: { type: "number", label: "Marge (mm)", min: 0, max: 30 },
        length: {
          type: "number",
          label: "Longueur si vertical (mm) — 0 = hauteur disponible",
          min: 0,
          max: 260,
        },
      },
      defaultProps: {
        orientation: "horizontal",
        thickness: 1,
        color: "var(--color-primary)",
        margin: 4,
        length: 0,
      },
      render: ({ thickness, color, margin, orientation, length }) => {
        const stroke = `${thickness ?? 1}pt solid ${color ?? "var(--color-primary)"}`;

        if (orientation === "vertical") {
          const fixed = typeof length === "number" && length > 0;
          return (
            <hr
              style={{
                border: 0,
                borderLeft: stroke,
                // La marge bascule sur l'axe horizontal : un filet vertical
                // s'ecarte de ses voisins de gauche et de droite, pas du dessus.
                margin: `0 ${mm(margin ?? 4)}`,
                width: 0,
                // A defaut de longueur donnee, le filet prend la place restante
                // dans la colonne — c'est le trait de liaison qui court d'une
                // section a l'autre, dont on ne veut justement pas mesurer la
                // hauteur a la main a chaque retouche du contenu voisin.
                //
                // `flexGrow` et NON `alignSelf: stretch`, et c'est mesure : tout
                // parent produit par le registry est un STACK, donc un flex en
                // COLONNE (voir stack()). Dans ce sens, `stretch` agit sur l'axe
                // transversal — la largeur — et laisse la hauteur a 0 : le filet
                // etait purement invisible. Seul `flexGrow` agit sur la hauteur.
                // Le risque inverse (flexGrow devorant la largeur dans un parent
                // en rangee) n'existe pas ici : aucun bloc a slot n'en produit.
                height: fixed ? mm(length as number) : "auto",
                flexGrow: fixed ? undefined : 1,
                flexShrink: 0,
              }}
            />
          );
        }

        return (
          <hr
            style={{
              border: 0,
              borderTop: stroke,
              margin: `${mm(margin ?? 4)} 0`,
            }}
          />
        );
      },
    },

    /**
     * Saut de page, inconditionnel ou conditionne a un champ.
     *
     * POURQUOI DEUX CHAMPS PLUTOT QU'UN. Un seul champ « ne couper que si ceci
     * est rempli » aurait suffi en apparence, mais les tokens sont resolus AVANT
     * que le bloc ne rende : un champ laisse vide et un token qui se resout en
     * vide arrivent ici sous la meme forme, la chaine vide. Le bloc ne pourrait
     * donc pas distinguer « pas de condition » de « condition non remplie », et
     * l'un des deux cas serait forcement traite a tort. Le mode explicite leve
     * l'ambiguite.
     *
     * CE QUE CELA RESOUT. Un meme template sert des produits de longueurs
     * differentes. Un saut inconditionnel place pour loger une description
     * longue produit une deuxieme page VIDE sur les produits qui n'en ont pas.
     * Conditionne, le saut disparait avec le contenu qui le justifiait.
     */
    /**
     * UNE page du document — la brique dont le corps est fait.
     *
     * CE QUE CE BLOC REND POSSIBLE. Avant lui, le corps etait un flux continu
     * que Chromium paginait : la deuxieme page n'existait nulle part, ni dans le
     * modele ni dans le studio, et se composait a l'aveugle en poussant du
     * contenu jusqu'a ce qu'il deborde. Ici chaque page est une surface a part,
     * qu'on remplit comme la premiere, et l'ordre des pages est l'ordre des
     * blocs.
     *
     * LA COUPURE N'EST PAS DANS CE BLOC. Elle est posee par la feuille
     * d'impression, sur `.ds-page + .ds-page` (src/lib/printCss.ts) : une page
     * conditionnelle qui ne s'imprime pas disparait du DOM, et le selecteur de
     * frere adjacent ne laisse donc aucune coupure orpheline derriere elle. Un
     * `break-after` porte par le bloc lui-meme aurait fait exactement l'inverse.
     *
     * `disallow` sur le slot : une page dans une page n'a pas de sens, et Puck
     * autoriserait le depot sans cela.
     */
    Page: {
      label: "Page",
      fields: {
        mode: {
          type: "radio",
          label: "Quand imprimer cette page",
          options: [
            { label: "Toujours", value: "always" },
            { label: "Seulement si un champ est rempli", value: "ifFilled" },
          ],
        },
        onlyIf: {
          type: "text",
          label: "Champ a tester",
          // `description_html` et non un `description_long` qui n'existe dans
          // aucun payload : un placeholder qui nomme un champ absent fait
          // ecrire une condition qui ne sera jamais remplie, donc une page qui
          // ne sortira jamais. Voir productSchema dans src/lib/payload.ts.
          placeholder: "{{product.description_html}}",
        },
        content: { type: "slot", disallow: ["Page"] },
      },
      defaultProps: { mode: "always", onlyIf: "", content: [] },
      render: ({ mode, onlyIf, content: Content, puck }) => {
        const imprimee = pageWillPrint(mode, onlyIf);

        // CHEMIN PDF. Une page qui ne s'imprime pas ne rend RIEN : ni contenu,
        // ni element vide, sinon la regle de coupure verrait un frere et
        // couperait pour une page absente.
        if (!puck?.isEditing) {
          if (!imprimee) return <></>;
          return (
            <div className="ds-page" style={pageContentStyle}>
              <Content />
            </div>
          );
        }

        const meta = (puck.metadata ?? {}) as CanvasMeta;

        return (
          <PageCanvas meta={meta} inactif={!imprimee}>
            <Content />
          </PageCanvas>
        );
      },
    },

    PageBreak: {
      label: "Saut de page",
      fields: {
        mode: {
          type: "radio",
          label: "Quand couper",
          options: [
            { label: "Toujours", value: "always" },
            { label: "Seulement si un champ est rempli", value: "ifFilled" },
          ],
        },
        onlyIf: {
          type: "text",
          label: "Champ a tester",
          // `description_html` et non un `description_long` qui n'existe dans
          // aucun payload : un placeholder qui nomme un champ absent fait
          // ecrire une condition qui ne sera jamais remplie, donc une page qui
          // ne sortira jamais. Voir productSchema dans src/lib/payload.ts.
          placeholder: "{{product.description_html}}",
        },
      },
      defaultProps: { mode: "always", onlyIf: "" },
      render: ({ mode, onlyIf }) => {
        // `onlyIf` arrive DEJA resolu : c'est la valeur du produit, pas le token.
        // Un espace seul ne compte pas comme du contenu — une description faite
        // d'un espace insecable ne doit pas provoquer une page.
        if (mode === "ifFilled" && (onlyIf ?? "").trim() === "") return <></>;
        return <div className="ds-pagebreak" />;
      },
    },

    // ----------------------------------------------------------------- Contenu

    Heading: {
      label: "Titre",
      fields: {
        text: {
          type: "text",
          label: "Texte",
          placeholder: "{{product.name}}",
          // Edition directe sur le canvas, sans passer par le panneau lateral.
          contentEditable: true,
        },
        level: {
          type: "select",
          label: "Niveau",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
          ],
        },
        size: { type: "number", label: "Corps (pt)", min: 6, max: 40 },
        align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
        color: { type: "text", label: "Couleur", placeholder: "var(--color-primary)" },
        uppercase: { type: "radio", label: "Majuscules", options: YES_NO },
        underline: { type: "radio", label: "Souligné", options: YES_NO },
        background: { type: "text", label: "Couleur de fond", placeholder: "vide = transparent" },
        padding: { type: "number", label: "Marge intérieure (mm)", min: 0, max: 15 },
      },
      defaultProps: {
        text: "{{product.name}}",
        level: "h1",
        size: 18,
        align: "center",
        color: "var(--color-primary)",
        uppercase: true,
        underline: false,
        background: "",
        padding: 0,
      },
      render: ({ text, level, size, align, color, uppercase, underline, background, padding }) => {
        const Tag = level ?? "h1";
        return (
          <Tag
            style={{
              fontSize: `${size ?? 18}pt`,
              textAlign: align ?? "center",
              color: color ?? "var(--color-primary)",
              textTransform: uppercase ? "uppercase" : "none",
              textDecoration: underline ? "underline" : undefined,
              backgroundColor: background || undefined,
              padding: padding ? mm(padding) : undefined,
              boxSizing: "border-box",
              // Aucune marge propre : l'espacement appartient au conteneur (STACK).
              // Deux blocs qui decident chacun de leur marge, c'est exactement ce
              // qui rendait l'aeration des fiches impossible a regler.
              margin: 0,
            }}
          >
            {text}
          </Tag>
        );
      },
    },

    Text: {
      label: "Paragraphe",
      fields: {
        content: {
          type: "textarea",
          label: "Texte",
          placeholder: "Référence : {{product.sku}}",
          contentEditable: true,
        },
        size: { type: "number", label: "Corps (pt)", min: 5, max: 24 },
        align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
        bold: { type: "radio", label: "Gras", options: YES_NO },
        color: { type: "text", label: "Couleur du texte" },
        background: { type: "text", label: "Couleur de fond", placeholder: "vide = transparent" },
        padding: { type: "number", label: "Marge intérieure (mm)", min: 0, max: 15 },
      },
      defaultProps: {
        content: "Référence : {{product.sku}}",
        size: 10,
        align: "left",
        bold: false,
        color: "",
        background: "",
        padding: 0,
      },
      render: ({ content, size, align, bold, color, background, padding }) => (
        <p
          style={{
            fontSize: `${size ?? 10}pt`,
            textAlign: align ?? "left",
            fontWeight: bold ? 700 : 400,
            color: color || undefined,
            backgroundColor: background || undefined,
            padding: padding ? mm(padding) : undefined,
            boxSizing: "border-box",
            // Voir Heading : l'espacement est celui du conteneur, pas du bloc.
            margin: 0,
            whiteSpace: "pre-line",
          }}
        >
          {content}
        </p>
      ),
    },

    RichText: {
      label: "Texte riche (HTML)",
      fields: {
        html: {
          type: "textarea",
          label: "Contenu HTML",
          placeholder: "{{product.description_html}}",
        },
        size: { type: "number", label: "Corps (pt)", min: 5, max: 24 },
        columns: { type: "number", label: "Colonnes de texte", min: 1, max: 3 },
      },
      defaultProps: { html: "{{product.description_html}}", size: 9, columns: 1 },
      render: ({ html, size, columns }) => (
        /*
         * ASSAINI ICI, AU POINT DE RENDU — et non plus seulement en confiance
         * dans le seul appelant (src/lib/prepare.ts).
         *
         * CE COMPOSANT SERT DEUX CONTEXTES : le rendu de production (donnees
         * passees par prepare.ts, deja assainies) ET le canevas LIVE de
         * l'editeur Puck, qui rend directement ce que la personne tape dans le
         * champ « Contenu HTML » — sans jamais traverser prepare.ts. Un
         * brouillon enregistre avec <script> dans ce champ s'executait donc
         * dans le navigateur de quiconque rouvrait ensuite ce brouillon dans
         * l'editeur (un autre editeur, un administrateur) : une XSS stockee
         * entre comptes a privilege, pas seulement contre son propre auteur.
         *
         * sanitizeRichHtml() est IDEMPOTENTE : la reappliquer sur une valeur
         * deja assainie par prepare.ts ne change rien. Le cout (un parseur
         * HTML, cote client comme cote serveur) est rendu une fois par bloc et
         * par frappe dans l'editeur — negligeable devant celui du reste du
         * canevas Puck.
         */
        <div
          className="ds-richtext"
          style={{
            fontSize: `${size ?? 9}pt`,
            columnCount: columns && columns > 1 ? columns : undefined,
            columnGap: "8mm",
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
        />
      ),
    },

    Image: {
      label: "Image",
      fields: {
        source: {
          type: "text",
          label: "Image",
          placeholder: "{{shop.logo}} ou /assets/shared/mon-picto",
        },
        width: { type: "number", label: "Largeur", min: 1, max: 400 },
        widthUnit: {
          type: "radio",
          label: "Unité de largeur",
          options: [
            { label: "% du conteneur", value: "%" },
            { label: "mm", value: "mm" },
          ],
        },
        height: { type: "number", label: "Hauteur (mm) — 0 = proportionnelle", min: 0, max: 200 },
        maxHeight: {
          type: "number",
          label: "Hauteur maximale (mm) — 0 = aucune",
          min: 0,
          max: 260,
        },
        align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
        fit: {
          type: "radio",
          label: "Cadrage",
          options: [
            { label: "Entière", value: "contain" },
            { label: "Remplir", value: "cover" },
          ],
        },
        ...IMAGE_FRAME_FIELDS,
      },
      defaultProps: {
        source: "{{shop.logo}}",
        // PLEINE LARGEUR par defaut, et non 30 mm.
        //
        // 30 mm etait taille pour un logo, seul usage de ce bloc a sa creation. Un
        // visuel produit pose avec ce defaut sortait donc en vignette, sans que rien
        // ne le signale : une image trop grande se voit et se corrige, une image
        // trop petite passe pour un defaut du moteur.
        width: 100,
        widthUnit: "%",
        height: 0,
        maxHeight: 0,
        align: "left",
        fit: "contain",
        ...IMAGE_FRAME_DEFAULTS,
      },
      render: ({
        source,
        width,
        widthUnit,
        height,
        maxHeight,
        align,
        fit,
        borderWidth,
        borderColor,
        padding,
        radius,
        puck,
      }) => {
        // Une source vide efface le bloc plutot que d'afficher une image cassee :
        // un logo absent ne doit pas trouer la fiche.
        if (!hasSrc(source)) return <></>;

        const unit = widthUnit ?? "%";
        const value = width ?? 100;
        const w = unit === "%" ? `${value}%` : mm(value);
        const capped = typeof maxHeight === "number" && maxHeight > 0;

        return (
          <div style={{ display: "flex", justifyContent: justifyFor(align), position: "relative" }}>
            <ContainerTag
              puck={puck}
              label={
                `Image ${value} ${unit === "%" ? "%" : "mm"}` +
                (height && height > 0 ? ` × ${height} mm` : capped ? ` × max ${maxHeight} mm` : "")
              }
            />
            <img
              src={source}
              alt=""
              style={{
                width: w,
                height: height && height > 0 ? mm(height) : "auto",
                // Un plafond de hauteur sur une image en pleine largeur la
                // deformerait sans object-fit : la boite est bridee, le contenu
                // s'y inscrit en conservant ses proportions.
                maxHeight: capped ? mm(maxHeight as number) : undefined,
                /**
                 * SANS CE ZERO, UN PLAFOND DE HAUTEUR RETRECIT AUSSI LA LARGEUR.
                 *
                 * Le conteneur est un flex (il porte l'alignement). Une image
                 * y est donc un ELEMENT FLEX, et `max-height` fait retomber sa
                 * taille principale sur celle deduite de ses proportions : une
                 * image demandee en pleine largeur sortait a 114 mm au lieu de
                 * 186, centree entre deux vides. Mesure sur le visuel des
                 * details des fiches Acme, qui est le premier a combiner
                 * pleine largeur et plafond.
                 *
                 * Inerte partout ailleurs : sans plafond, la taille demandee
                 * tient deja dans le conteneur, donc rien ne se retractait.
                 */
                flexShrink: 0,
                objectFit: fit ?? "contain",
                ...imageFrame(borderWidth, borderColor, padding, radius),
              }}
            />
          </div>
        );
      },
    },

    // ----------------------------------------------------------------- Produit

    FeatureTable: {
      label: "Tableau de caractéristiques",
      fields: {
        source: {
          type: "select",
          label: "Données affichées",
          options: [{ label: "Les caractéristiques du produit", value: "{{features}}" }],
        },
        heading: { type: "text", label: "Titre au-dessus du tableau", placeholder: "vide = aucun titre" },
        nameHeader: { type: "text", label: "En-tête colonne libellé", placeholder: "Caractéristique" },
        valueHeader: { type: "text", label: "En-tête colonne valeur", placeholder: "Valeur" },
        showHeader: { type: "radio", label: "Afficher l'en-tête", options: YES_NO },
        showAbbreviation: { type: "radio", label: "Afficher les renvois de schéma", options: YES_NO },
        striped: { type: "radio", label: "Lignes alternées", options: YES_NO },
        size: { type: "number", label: "Corps (pt)", min: 5, max: 16 },
        groupDuplicates: {
          type: "radio",
          label: "Regrouper les caractéristiques de même nom",
          options: YES_NO,
        },
        groupSeparator: {
          type: "select",
          label: "Séparateur des valeurs regroupées",
          options: [
            { label: "Puce (·)", value: " · " },
            { label: "Virgule", value: ", " },
            { label: "Une valeur par ligne", value: "\n" },
          ],
        },
        rowPadding: {
          // Un choix nomme plutot qu'une saisie libre : les valeurs utiles sont
          // decimales, et un champ numerique au pas de 1 les refuse.
          type: "select",
          label: "Densité des lignes",
          options: [
            { label: "Serrée", value: 0.6 },
            { label: "Normale", value: 1.2 },
            { label: "Aérée", value: 2 },
          ],
        },
        pairs: {
          type: "select",
          label: "Colonnes de caractéristiques",
          options: [
            { label: "1 — pleine largeur", value: 1 },
            { label: "2 — deux fois moins haut", value: 2 },
          ],
        },
        stripeColor: {
          type: "text",
          label: "Couleur des lignes alternées",
          placeholder: "vide = 14 % de la couleur du texte",
        },
        stripeTextColor: {
          type: "text",
          label: "Couleur du texte des lignes alternées",
          placeholder: "vide = inchangée",
        },
        pairGap: { type: "number", label: "Gouttière entre les 2 colonnes (mm)", min: 0, max: 20 },
        nameWidth: {
          type: "number",
          label: "Part du libellé en mode 2 colonnes (%)",
          min: 25,
          max: 70,
        },
        pairRule: { type: "radio", label: "Filet entre les 2 colonnes", options: YES_NO },
        rowRule: { type: "radio", label: "Filets entre les lignes", options: YES_NO },
        emphasis: {
          type: "select",
          label: "Gras sur",
          options: [
            { label: "Le libellé", value: "name" },
            { label: "La valeur", value: "value" },
          ],
        },
        headerColor: {
          type: "text",
          label: "Fond de l'en-tête",
          placeholder: "vide = 30 % de la couleur du texte",
        },
        headerTextColor: {
          type: "text",
          label: "Couleur du texte d'en-tête",
          placeholder: "vide = inchangée",
        },
        background: {
          type: "text",
          label: "Couleur de fond du tableau",
          placeholder: "vide = transparent",
        },
        color: { type: "text", label: "Couleur du texte du tableau", placeholder: "vide = héritée" },
        padding: { type: "number", label: "Marge intérieure du tableau (mm)", min: 0, max: 20 },
        radius: { type: "number", label: "Arrondi (mm)", min: 0, max: 10 },
      },
      defaultProps: {
        source: "{{features}}",
        heading: "",
        // Accentue : contrairement aux libelles de l'editeur, cette valeur est du
        // CONTENU, elle s'imprime dans la fiche.
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
        stripeColor: "",
        stripeTextColor: "",
        pairGap: 6,
        nameWidth: 45,
        pairRule: true,
        rowRule: false,
        emphasis: "name",
        headerColor: "",
        headerTextColor: "",
        background: "",
        color: "",
        padding: 0,
        radius: 0,
      },
      render: ({
        source,
        heading,
        nameHeader,
        valueHeader,
        showHeader,
        showAbbreviation,
        striped,
        size,
        groupDuplicates,
        groupSeparator,
        rowPadding,
        pairs,
        stripeColor,
        stripeTextColor,
        pairGap,
        nameWidth,
        pairRule,
        rowRule,
        emphasis,
        headerColor,
        headerTextColor,
        background,
        color,
        padding,
        radius,
      }) => {
        const raw = Array.isArray(source) ? source : [];
        if (raw.length === 0) return <></>;

        const rows = groupFeatures(raw, showAbbreviation !== false, groupDuplicates !== false);
        const separator = groupSeparator ?? " · ";
        const pad = `${rowPadding ?? 1.2}mm 2mm`;
        const columns = pairs === 2 ? 2 : 1;
        const stripe = stripeColor || DEFAULT_STRIPE;
        const rule = pairRule !== false ? `1pt solid ${DEFAULT_RULE}` : undefined;
        // Plus fin et plus clair que le filet vertical : il rythme la lecture
        // sans dessiner une grille. Porte par les cellules et non par la ligne,
        // pour s'interrompre a la gouttiere comme le zebrage.
        const rowLine = rowRule === true ? "0.5pt solid color-mix(in srgb, currentColor 22%, transparent)" : undefined;

        // La gouttiere est une VRAIE colonne, sans fond : c'est ce qui fait lire
        // deux tableaux distincts la ou quatre colonnes accolees, toutes du meme
        // fond, formaient un mur de texte.
        const gutterWidth = mm(pairGap ?? 6);

        // Chaque paire dispose de 46 % de la largeur ; les 8 % restants laissent
        // la place a la gouttiere, exprimee en mm et non en pourcentage. Le partage
        // interne est reglable : dans une colonne etroite, un libelle comme
        // « Dimensions Hors tout (cm) » se replie sur trois lignes si on lui donne
        // moins de la moitie de la place.
        const share = Math.min(70, Math.max(25, nameWidth ?? 45));
        const pairName = `${((46 * share) / 100).toFixed(1)}%`;
        const pairValue = `${(46 - (46 * share) / 100).toFixed(1)}%`;

        // Le fond du zebrage est porte par les CELLULES et non par la ligne : le
        // fond d'une ligne se peint sous toutes ses cellules, gouttiere comprise,
        // ce qui reboucherait la separation qu'on vient d'ouvrir.
        const shadedCell = (shaded: boolean): CSSProperties =>
          shaded ? { backgroundColor: stripe, color: stripeTextColor || undefined } : {};

        // Alignement en haut : une valeur qui se replie sur trois lignes face a un
        // libelle d'une seule ligne se lit mal centree, on ne sait plus quelle
        // valeur va avec quel libelle.
        const cell: CSSProperties = { padding: pad, verticalAlign: "top" };

        const header: CSSProperties = {
          ...cell,
          textAlign: "left",
          backgroundColor: headerColor || DEFAULT_HEADER,
          color: headerTextColor || undefined,
          // Un filet sous l'en-tete le detache meme quand son fond est proche de
          // celui du tableau.
          borderBottom: `1pt solid ${DEFAULT_RULE}`,
        };

        // Decoupe en deux moities et non en alternance : la lecture reste
        // verticale, colonne par colonne, comme dans un tableau ordinaire.
        const perColumn = Math.ceil(rows.length / columns);
        const lines = Array.from({ length: perColumn }, (_, line) =>
          Array.from({ length: columns }, (_, column) => rows[column * perColumn + line])
        );

        return (
          <div
            style={{
              fontSize: `${size ?? 9}pt`,
              // Le fond appartient au tableau, pas a son voisinage : c'est ce qui
              // permet de le colorer sans repeindre ce qui est pose a cote de lui.
              backgroundColor: background || undefined,
              color: color || undefined,
              padding: padding ? mm(padding) : undefined,
              borderRadius: radius ? mm(radius) : undefined,
              // Sans decoupe, le zebrage des cellules d'angle depasse l'arrondi.
              overflow: radius ? "hidden" : undefined,
            }}
          >
            {heading ? (
              <div style={{ fontWeight: 700, marginBottom: "2mm", color: "var(--color-primary)" }}>{heading}</div>
            ) : null}
            <table style={{ tableLayout: columns === 2 ? "fixed" : "auto" }}>
              {/* Largeurs explicites en mode 2 colonnes : en repartition
                  automatique, les deux moities se calaient sur la longueur de leur
                  propre contenu et ne s'alignaient donc jamais. */}
              {columns === 2 ? (
                <colgroup>
                  <col style={{ width: pairName }} />
                  <col style={{ width: pairValue }} />
                  <col style={{ width: gutterWidth }} />
                  <col style={{ width: pairName }} />
                  <col style={{ width: pairValue }} />
                </colgroup>
              ) : null}
              {showHeader ? (
                // display: table-header-group (feuille de base) -> l'en-tete se
                // repete automatiquement si le tableau deborde sur la page
                // suivante. Inatteignable avec l'ancien moteur.
                <thead>
                  <tr>
                    {Array.from({ length: columns }, (_, column) => (
                      <Fragment key={column}>
                        {column > 0 ? <td /> : null}
                        <th style={{ ...header, borderLeft: column > 0 ? rule : undefined }}>
                          {nameHeader}
                        </th>
                        <th style={header}>{valueHeader}</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {lines.map((line, index) => {
                  // L'alternance demarre a la deuxieme ligne quand un en-tete est
                  // affiche : deux bandes teintees l'une sous l'autre affadissent
                  // l'en-tete, qu'on veut justement voir en premier.
                  const shaded = striped !== false && index % 2 === (showHeader ? 1 : 0);
                  return (
                    <tr key={index}>
                      {line.map((row, column) => (
                        <Fragment key={column}>
                          {/* Gouttiere : hors zebrage, elle laisse voir le fond du
                              conteneur et separe donc reellement les deux moities. */}
                          {column > 0 ? <td /> : null}
                          {/* PAS DE CASE FANTOME. Avec un nombre impair de
                              caracteristiques, la colonne de droite a une ligne de
                              moins : la combler d'une case filetee et zebree
                              imprimait une caracteristique vide. La place reste
                              nue — ni filet, ni fond. */}
                          {row === undefined ? (
                            <td colSpan={2} />
                          ) : (
                            <>
                              <td
                                style={{
                                  ...cell,
                                  ...shadedCell(shaded),
                                  fontWeight: emphasis === "value" ? 400 : 700,
                                  borderLeft: column > 0 ? rule : undefined,
                                  borderBottom: rowLine,
                                }}
                              >
                                {row.name}
                              </td>
                              <td
                                style={{
                                  ...cell,
                                  ...shadedCell(shaded),
                                  whiteSpace: "pre-line",
                                  // `undefined` et NON 400 : une valeur explicite,
                                  // meme identique au poids herite, change le HTML
                                  // de tous les templates deja publies et fait
                                  // echouer le temoin de fixtures/golden. Un reglage
                                  // qu'on n'a pas choisi ne doit rien ecrire.
                                  fontWeight: emphasis === "value" ? 700 : undefined,
                                  borderBottom: rowLine,
                                }}
                              >
                                {row.cells.join(separator)}
                              </td>
                            </>
                          )}
                        </Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      },
    },

    ImageGallery: {
      label: "Galerie d'images",
      fields: {
        source: {
          type: "select",
          label: "Données affichées",
          options: [{ label: "Les images du produit", value: "{{images}}" }],
        },
        skip: { type: "number", label: "Ignorer les N premières images", min: 0, max: 10 },
        limit: { type: "number", label: "Nombre maximum", min: 1, max: 12 },
        columns: { type: "number", label: "Colonnes", min: 1, max: 6 },
        gap: { type: "number", label: "Espacement (mm)", min: 0, max: 20 },
        maxHeight: { type: "number", label: "Hauteur maximale (mm) — 0 = aucune", min: 0, max: 250 },
        border: { type: "radio", label: "Cadre", options: YES_NO },
        borderColor: { type: "text", label: "Couleur du cadre" },
        borderWidth: { type: "number", label: "Épaisseur du cadre (pt)", min: 0, max: 20 },
        padding: { type: "number", label: "Marge intérieure du cadre (mm)", min: 0, max: 10 },
      },
      defaultProps: {
        source: "{{images}}",
        skip: 1,
        limit: 4,
        columns: 4,
        gap: 3,
        // 0 : aucun plafond, donc aucun changement pour les templates deja
        // publies, qui n'ont pas ce champ enregistre.
        maxHeight: 0,
        border: false,
        borderColor: "#cccccc",
        borderWidth: 1,
        padding: 0,
      },
      render: ({ source, skip, limit, columns, gap, maxHeight, border, borderColor, borderWidth, padding }) => {
        const all = Array.isArray(source) ? source.filter((item) => hasSrc(item?.src)) : [];
        const items = all.slice(skip ?? 0, (skip ?? 0) + (limit ?? 4));
        if (items.length === 0) return <></>;

        return (
          <div
            className="ds-gallery"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns ?? 4}, 1fr)`,
              gap: mm(gap ?? 3),
            }}
          >
            {items.map((item, index) => (
              <img
                key={`${item.src}-${index}`}
                src={item.src}
                alt={item.legend ?? ""}
                style={{
                  width: "100%",
                  maxHeight: maxHeight ? mm(maxHeight) : undefined,
                  objectFit: "contain",
                  border: border ? `${borderWidth ?? 1}pt solid ${borderColor || "#cccccc"}` : undefined,
                  padding: border && padding ? mm(padding) : undefined,
                  boxSizing: "border-box",
                }}
              />
            ))}
          </div>
        );
      },
    },

    SchemaImage: {
      label: "Schéma coté",
      fields: {
        source: {
          type: "select",
          label: "Données affichées",
          options: [{ label: "Le schéma coté du produit", value: "{{schema_image.src}}" }],
        },
        width: { type: "number", label: "Largeur (%)", min: 10, max: 100 },
        maxHeight: { type: "number", label: "Hauteur maximale (mm, 0 = aucune)", min: 0, max: 260 },
        align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
        ...IMAGE_FRAME_FIELDS,
      },
      defaultProps: {
        source: "{{schema_image.src}}",
        width: 100,
        maxHeight: 0,
        align: "center",
        ...IMAGE_FRAME_DEFAULTS,
      },
      render: ({ source, width, maxHeight, align, borderWidth, borderColor, padding, radius }) => {
        if (!hasSrc(source)) return <></>;
        const plafond = maxHeight && maxHeight > 0 ? mm(maxHeight) : undefined;
        return (
          <div className="ds-schema" style={{ display: "flex", justifyContent: justifyFor(align) }}>
            <img
              src={source}
              alt=""
              style={{
                // La largeur reste un pourcentage — mais des qu'un plafond
                // existe, c'est LUI qui pilote : `width: auto` laisse le rapport
                // de l'image choisir la largeur qui tient dans cette hauteur,
                // au lieu de l'etirer a 92 % et de deborder en bas.
                width: plafond ? "auto" : `${width ?? 100}%`,
                // N'EXISTENT QUE SOUS PLAFOND : sans cela, ces deux proprietes
                // changeraient le HTML de tous les templates deja publies, et
                // deplaceraient leurs sauts de page sans qu'on l'ait demande.
                maxWidth: plafond ? `${width ?? 100}%` : undefined,
                maxHeight: plafond,
                objectFit: "contain",
                ...imageFrame(borderWidth, borderColor, padding, radius),
              }}
            />
          </div>
        );
      },
    },

    BadgeRow: {
      label: "Bandeau de pictos",
      fields: {
        source: {
          type: "select",
          label: "Données affichées",
          options: [{ label: "Les badges du produit (CE, TUV, garantie...)", value: "{{badges}}" }],
        },
        height: { type: "number", label: "Hauteur des pictos (mm)", min: 4, max: 40 },
        gap: { type: "number", label: "Espacement (mm)", min: 0, max: 20 },
        align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
        background: {
          type: "text",
          label: "Couleur de fond du bandeau",
        },
        padding: { type: "number", label: "Marge intérieure (mm)", min: 0, max: 20 },
        mapping: {
          type: "array",
          label: "Correspondance badge / picto",
          arrayFields: {
            badge: { type: "text", label: "Badge", placeholder: "ce, tuv, garantie:3-ans" },
            iconUrl: { type: "text", label: "Picto", placeholder: "/assets/shared/tuv" },
            label: { type: "text", label: "Texte alternatif" },
          },
          getItemSummary: (item) => item?.badge || "badge",
        },
      },
      defaultProps: {
        source: "{{badges}}",
        height: 14,
        gap: 4,
        align: "left",
        background: "",
        padding: 2,
        mapping: [],
      },
      render: ({ source, height, gap, align, background, padding, mapping }) => {
        const badges = Array.isArray(source) ? source : [];
        const rules = Array.isArray(mapping) ? mapping : [];
        if (badges.length === 0 || rules.length === 0) return <></>;

        // Correspondance par prefixe : la regle "garantie" capte
        // "garantie:3ans" comme "garantie:5ans". Une regle exacte reste
        // possible en ecrivant le badge complet.
        const matched = rules.filter(
          (rule) =>
            hasSrc(rule.iconUrl) &&
            badges.some((badge) => badge === rule.badge || badge.startsWith(`${rule.badge}:`))
        );
        if (matched.length === 0) return <></>;

        return (
          <div
            style={{
              display: "flex",
              gap: mm(gap ?? 4),
              justifyContent: justifyFor(align),
              alignItems: "center",
              backgroundColor: background || undefined,
              padding: background ? mm(padding ?? 2) : undefined,
              boxSizing: "border-box",
            }}
          >
            {matched.map((rule, index) => (
              <img
                key={`${rule.badge}-${index}`}
                src={rule.iconUrl}
                alt={rule.label ?? rule.badge ?? ""}
                style={{ height: mm(height ?? 14), width: "auto" }}
              />
            ))}
          </div>
        );
      },
    },

    KeyValueGrid: {
      label: "Grille d'informations",
      fields: {
        columns: { type: "number", label: "Colonnes", min: 1, max: 6 },
        gap: { type: "number", label: "Espacement (mm)", min: 0, max: 20 },
        iconHeight: { type: "number", label: "Hauteur des icônes (mm)", min: 3, max: 20 },
        items: {
          type: "array",
          label: "Entrées",
          arrayFields: {
            label: { type: "text", label: "Libellé", placeholder: "Prix" },
            value: { type: "text", label: "Valeur", placeholder: "{{product.price.formatted}}" },
            iconUrl: { type: "text", label: "Icône", placeholder: "/assets/shared/icone-telephone" },
          },
          getItemSummary: (item) => item?.label || "entrée",
        },
      },
      defaultProps: { columns: 4, gap: 4, iconHeight: 8, items: [] },
      render: ({ columns, gap, iconHeight, items }) => {
        const entries = Array.isArray(items) ? items : [];
        if (entries.length === 0) return <></>;

        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns ?? 4}, 1fr)`,
              gap: mm(gap ?? 4),
            }}
          >
            {entries.map((entry, index) => (
              <div key={index} style={{ textAlign: "center" }}>
                {hasSrc(entry.iconUrl) ? (
                  <img
                    src={entry.iconUrl}
                    alt=""
                    style={{ height: mm(iconHeight ?? 8), width: "auto", marginBottom: "1mm" }}
                  />
                ) : null}
                {entry.label ? (
                  <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>{entry.label}</div>
                ) : null}
                {entry.value ? <div>{entry.value}</div> : null}
              </div>
            ))}
          </div>
        );
      },
    },

    SwatchGroups: {
      label: "Nuancier de finitions",
      fields: {
        source: {
          type: "select",
          label: "Données affichées",
          options: [{ label: "Les finitions du produit", value: "{{finishes}}" }],
        },
        shape: {
          type: "radio",
          label: "Forme des pastilles",
          options: [
            { label: "Carrée", value: "square" },
            { label: "Ronde", value: "circle" },
          ],
        },
        swatchSize: { type: "number", label: "Côté d'une pastille (mm)", min: 3, max: 30 },
        exclude: {
          type: "text",
          label: "Valeurs à masquer",
          placeholder: "Sans — écarte « Sans cloison », « Sans option »…",
        },
        gap: { type: "number", label: "Espacement entre valeurs (mm)", min: 0, max: 20 },
        groupGap: { type: "number", label: "Espacement entre groupes (mm)", min: 0, max: 40 },
        titleSize: { type: "number", label: "Corps du titre de groupe (pt)", min: 5, max: 20 },
        size: { type: "number", label: "Corps des libellés (pt)", min: 5, max: 16 },
        itemWidth: { type: "number", label: "Largeur d'une valeur (mm)", min: 8, max: 60 },
        mapping: {
          type: "array",
          label: "Couleur ou picto, par libellé",
          arrayFields: {
            label: { type: "text", label: "Libellé", placeholder: "Bleu, Clés, Chêne clair" },
            color: { type: "text", label: "Couleur", placeholder: "#2b4ea2" },
            image: { type: "text", label: "Picto ou texture", placeholder: "/assets/shared/picto-cles" },
            text: { type: "text", label: "Libellé imprimé", placeholder: "vide = celui de la boutique" },
          },
          getItemSummary: (item) => item?.label || "libellé",
        },
      },
      defaultProps: {
        exclude: "",
        source: "{{finishes}}",
        shape: "square",
        swatchSize: 8,
        gap: 5,
        groupGap: 12,
        titleSize: 9,
        size: 8,
        itemWidth: 20,
        mapping: [],
      },
      render: ({ source, shape, swatchSize, gap, groupGap, titleSize, size, itemWidth, mapping, exclude }) => {
        const groups = Array.isArray(source) ? source : [];
        if (groups.length === 0) return <></>;

        const rules = Array.isArray(mapping) ? mapping : [];
        // Rapprochement sur la forme normalisee des DEUX cotes : voir
        // normalizeLabel pour les quatre defauts que cela absorbe.
        const ruleFor = (label?: string): SwatchRule | undefined => {
          const key = normalizeLabel(label);
          if (key === "") return undefined;
          return rules.find((rule) => normalizeLabel(rule.label) === key);
        };

        // Memes regles que le rapprochement des fiches : egalite, ou prefixe
        // s'arretant sur une espace.
        const masques = (typeof exclude === "string" ? exclude.split(",") : [])
          .map((mot) => normalizeLabel(mot))
          .filter((mot) => mot !== "");

        const ecartee = (label?: string): boolean => {
          const etiquette = normalizeLabel(label);
          return masques.some((mot) => etiquette === mot || etiquette.startsWith(mot + " "));
        };

        const side = mm(swatchSize ?? 8);

        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: mm(groupGap ?? 12) }}>
            {groups.map((group, groupIndex) => {
              const brutes = Array.isArray(group?.options) ? group.options : [];

              /**
               * LES PASTILLES SONT RESOLUES AVANT DE DECIDER DU GROUPE.
               *
               * Ecarter les options muettes a l'interieur de la boucle laissait
               * un groupe rendre son titre et sa note au-dessus de rien — un
               * intitule « Coloris des portes » suivi du vide, ce qui se lit
               * comme une donnee perdue.
               */
              const options = brutes
                .map((option) => {
                  const rule = ruleFor(option?.label);
                  // La valeur du payload l'emporte : une plateforme qui connait
                  // sa propre presentation ne doit pas etre corrigee par une
                  // regle de template.
                  return {
                    option,
                    rule,
                    image: option?.image || rule?.image,
                    color: option?.color || rule?.color,
                  };
                })
                /**
                 * UNE PASTILLE SANS RIEN A MONTRER NE S'AFFICHE PAS. Ni couleur,
                 * ni picto, ni texture : la case sortait en carre vide a contour
                 * fin, ce qui se lit comme un defaut d'impression.
                 *
                 * LA REGLE EST ICI ET NON DANS LE COLLECTEUR, et c'est ce qui la
                 * rend rattrapable : releve sur le catalogue Acme, les decors
                 * bois (« Chêne clair », « Hêtre », « Noyer ») n'ont pas de code
                 * hexadecimal — un bois n'est pas un aplat. Ecartes cote
                 * boutique, ils disparaitraient sans recours ; ecartes ici, une
                 * regle du template leur rend une texture et ils reviennent.
                 */
                .filter((entree) => Boolean(entree.image) || Boolean(entree.color))
                .filter((entree) => !ecartee(entree.option?.label));

              if (options.length === 0) return null;

              return (
                <div key={groupIndex} style={{ ...stack(2) }}>
                  {group.label ? (
                    <div style={{ fontSize: `${titleSize ?? 9}pt`, fontWeight: 700 }}>
                      {group.label}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", gap: mm(gap ?? 5), alignItems: "flex-start" }}>
                    {options.map(({ option, rule, image, color }, optionIndex) => {
                      return (
                        <div
                          key={optionIndex}
                          style={{
                            textAlign: "center",
                            fontSize: `${size ?? 8}pt`,
                            // UN PLAFOND, ET NON UNE LARGEUR IMPOSEE. Sans lui,
                            // « Serrure à code électronique » etale le groupe
                            // sur toute la largeur et chasse le suivant a la
                            // ligne ; avec une largeur imposee, « Clés » et
                            // « Bleu » occupent autant de place que lui, et deux
                            // groupes cessent de tenir cote a cote. Les fiches
                            // faites a la main laissent chaque valeur a sa
                            // largeur propre, bornee.
                            maxWidth: mm(itemWidth ?? 20),
                          }}
                        >
                          <div
                            style={{
                              width: side,
                              height: side,
                              margin: "0 auto",
                              borderRadius: shape === "circle" ? "50%" : "1pt",
                              // Un aplat sans contour disparait quand il est
                              // blanc — et « Blanc » est une finition courante.
                              border: image ? undefined : "0.5pt solid rgba(0,0,0,0.25)",
                              backgroundColor: image ? undefined : color || "transparent",
                              backgroundImage: image ? `url("${image}")` : undefined,
                              backgroundSize: "contain",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                              boxSizing: "border-box",
                            }}
                          />
                          {/* La surcharge du template l'emporte sur la valeur
                              stockee : « A code electronique » s'imprime
                              « Serrure à code électronique ». */}
                          <div style={{ marginTop: mm(1.5) }}>{rule?.text || option?.label || ""}</div>
                          {option?.note ? (
                            <div style={{ opacity: 0.7, fontSize: `${(size ?? 8) - 1}pt` }}>
                              {option.note}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {group.note ? (
                    <div style={{ fontSize: `${(size ?? 8) - 0.5}pt`, opacity: 0.75 }}>
                      ↳ {group.note}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      },
    },

    HighlightRow: {
      label: "Bandeau de points clés",
      fields: {
        source: {
          type: "select",
          label: "Données affichées",
          options: [{ label: "Les badges du produit (CE, garantie, livré monté...)", value: "{{badges}}" }],
        },
        iconHeight: { type: "number", label: "Hauteur des pictos (mm)", min: 4, max: 40 },
        gap: { type: "number", label: "Espacement horizontal (mm)", min: 0, max: 30 },
        rowGap: { type: "number", label: "Espacement entre lignes (mm)", min: 0, max: 20 },
        itemWidth: { type: "number", label: "Largeur maximale d'un libellé (mm)", min: 10, max: 60 },
        size: { type: "number", label: "Corps des libellés (pt)", min: 5, max: 16 },
        align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
        mapping: {
          type: "array",
          label: "Correspondance badge / picto et libellé",
          arrayFields: {
            badge: { type: "text", label: "Badge", placeholder: "livre-monte, garantie:10-ans" },
            iconUrl: { type: "text", label: "Picto", placeholder: "/assets/shared/picto-livre-monte" },
            label: { type: "text", label: "Libellé imprimé", placeholder: "Livré monté" },
            note: { type: "text", label: "Seconde ligne" },
            height: { type: "number", label: "Hauteur propre (mm)", min: 4, max: 40 },
            group: { type: "text", label: "Groupe exclusif", placeholder: "montage" },
            connector: { type: "text", label: "Mot de l'accolade", placeholder: "OU" },
          },
          getItemSummary: (item) => item?.label || item?.badge || "point clé",
        },
      },
      defaultProps: {
        source: "{{badges}}",
        iconHeight: 12,
        gap: 8,
        rowGap: 5,
        itemWidth: 24,
        size: 8,
        align: "center",
        mapping: [],
      },
      render: ({ source, iconHeight, gap, rowGap, itemWidth, size, align, mapping }) => {
        const badges = Array.isArray(source) ? source : [];
        const rules = Array.isArray(mapping) ? mapping : [];
        if (badges.length === 0 || rules.length === 0) return <></>;

        // Correspondance par prefixe, comme BadgeRow : la regle « garantie »
        // capte « garantie:10-ans ». L'ORDRE EST CELUI DES REGLES, et non celui
        // des badges : c'est la seule facon de garantir que « Livré monté »
        // precede « À monter » sous leur accolade, quel que soit l'ordre dans
        // lequel la boutique a renvoye ses badges.
        const matched = rules.filter((rule) =>
          badges.some((badge) => badge === rule.badge || badge.startsWith(`${rule.badge}:`))
        );
        if (matched.length === 0) return <></>;

        /**
         * Regroupe les regles consecutives partageant un `group`.
         *
         * Le regroupement porte sur des voisins et non sur tout le tableau : deux
         * points clefs exclusifs sont toujours cote a cote sur les fiches, et
         * relier par une accolade deux elements separes par un troisieme
         * produirait un trait qui passe SOUS cet intrus.
         */
        const runs: HighlightRule[][] = [];
        for (const rule of matched) {
          const last = runs[runs.length - 1];
          const key = rule.group?.trim();
          if (key && last && last[0].group?.trim() === key) last.push(rule);
          else runs.push([rule]);
        }

        const item = (rule: HighlightRule, key: number) => (
          <div
            key={key}
            style={{
              textAlign: "center",
              // Plafond et non largeur imposee, meme raison que sur le
              // nuancier : « Garantie » n'a pas a occuper la place de « Tôle
              // d'acier finition époxy 7/10ᵉ ».
              maxWidth: mm(itemWidth ?? 24),
              fontSize: `${size ?? 8}pt`,
            }}
          >
            {hasSrc(rule.iconUrl) ? (
              <img
                src={rule.iconUrl}
                alt=""
                style={{
                  height: mm(rule.height ?? iconHeight ?? 12),
                  width: "auto",
                  display: "block",
                  margin: "0 auto",
                  marginBottom: mm(2),
                }}
              />
            ) : null}
            {/* Pas de div vide quand le libelle l'est : elle reserverait une
                ligne sous le logotype, et decalerait toute la rangee. */}
            {rule.label ? <div>{rule.label}</div> : null}
            {rule.note ? <div style={{ opacity: 0.75 }}>{rule.note}</div> : null}
          </div>
        );

        return (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: `${mm(rowGap ?? 5)} ${mm(gap ?? 8)}`,
              justifyContent: justifyFor(align),
              alignItems: "flex-start",
            }}
          >
            {runs.map((run, runIndex) =>
              run.length > 1 ? (
                // Le groupe exclusif forme UN item de la rangee : sans cela,
                // un repli de ligne pourrait tomber entre deux elements que
                // l'accolade est censee relier, et le trait se dessinerait
                // en travers du vide.
                <div key={runIndex} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", gap: mm(gap ?? 8), alignItems: "flex-start" }}>
                    {run.map(item)}
                  </div>
                  <div style={{ position: "relative", height: mm(4), marginTop: mm(1) }}>
                    <div style={{ position: "absolute", left: "12%", top: 0, bottom: 0, borderLeft: "0.75pt solid currentColor" }} />
                    <div style={{ position: "absolute", right: "12%", top: 0, bottom: 0, borderRight: "0.75pt solid currentColor" }} />
                    <div
                      style={{
                        position: "absolute",
                        left: "12%",
                        right: "12%",
                        bottom: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: mm(1.5),
                        fontSize: `${(size ?? 8) - 0.5}pt`,
                        fontWeight: 700,
                        transform: "translateY(50%)",
                      }}
                    >
                      <span style={{ flex: 1, borderTop: "0.75pt solid currentColor" }} />
                      <span>{run[0].connector || "OU"}</span>
                      <span style={{ flex: 1, borderTop: "0.75pt solid currentColor" }} />
                    </div>
                  </div>
                </div>
              ) : (
                item(run[0], runIndex)
              )
            )}
          </div>
        );
      },
    },

    CardGrid: {
      label: "Grille de fiches",
      fields: {
        source: {
          type: "select",
          label: "Données affichées",
          options: [
            { label: "Les accessoires du produit", value: "{{accessories}}" },
            { label: "Fiches saisies, filtrées par un groupe de finitions", value: "{{finishes}}" },
            { label: "Fiches saisies, toutes affichées", value: "" },
          ],
        },
        group: {
          type: "text",
          label: "Groupe de finitions qui filtre",
          placeholder: "Fermeture",
        },
        extraSource: {
          type: "select",
          label: "Source complémentaire",
          options: [
            { label: "Aucune", value: "" },
            { label: "Les caractéristiques du produit", value: "{{features}}" },
          ],
        },
        relatedSource: {
          type: "select",
          label: "Produits associés",
          options: [
            { label: "Ignorés", value: "" },
            { label: "Reconnus par leur nom", value: "{{accessories}}" },
          ],
        },
        exclude: {
          type: "text",
          label: "Valeurs à écarter",
          placeholder: "Sans — écarte « Sans voile de fond », « Sans Goulotte »…",
        },
        items: {
          type: "array",
          label: "Fiches saisies à la main",
          arrayFields: {
            name: { type: "text", label: "Nom imprimé" },
            match: {
              type: "text",
              label: "Libellé du catalogue",
              placeholder: "vide = le nom imprimé",
            },
            matchGroup: {
              type: "text",
              label: "Groupe du catalogue",
              placeholder: "Retour — quand c'est le groupe qui porte le sens",
            },
            subtitle: { type: "text", label: "Sous-titre", placeholder: "2 clés fournies" },
            image: { type: "text", label: "Image", placeholder: "/assets/shared/fermeture-cles" },
            description: { type: "textarea", label: "Description" },
            features: {
              type: "array",
              label: "Caractéristiques",
              arrayFields: {
                name: { type: "text", label: "Libellé" },
                value: { type: "text", label: "Valeur" },
              },
              getItemSummary: (item) => item?.name || "caractéristique",
            },
          },
          getItemSummary: (item) => item?.name || "fiche",
        },
        heading: {
          type: "text",
          label: "Titre de la section",
          placeholder: "Accessoires — vide = aucun titre",
        },
        headingSize: { type: "number", label: "Corps du titre (pt)", min: 8, max: 28 },
        headingColor: { type: "text", label: "Couleur du titre" },
        headingAlign: { type: "select", label: "Alignement du titre", options: ALIGN_OPTIONS },
        columns: { type: "number", label: "Colonnes", min: 1, max: 6 },
        gap: { type: "number", label: "Espacement horizontal (mm)", min: 0, max: 30 },
        rowGap: { type: "number", label: "Espacement vertical (mm)", min: 0, max: 30 },
        limit: { type: "number", label: "Nombre maximum", min: 1, max: 24 },
        titlePosition: {
          type: "radio",
          label: "Nom",
          options: [
            { label: "Au-dessus", value: "above" },
            { label: "En dessous", value: "below" },
            { label: "À droite de l'image", value: "beside" },
          ],
        },
        imageHeight: { type: "number", label: "Hauteur des images (mm)", min: 10, max: 120 },
        showDescription: { type: "radio", label: "Description", options: YES_NO },
        showFeatures: { type: "radio", label: "Caractéristiques", options: YES_NO },
        featuresHeading: { type: "text", label: "Titre des caractéristiques" },
        justify: { type: "radio", label: "Texte justifié", options: YES_NO },
        border: { type: "radio", label: "Cadre autour des images", options: YES_NO },
        borderColor: { type: "text", label: "Couleur du cadre" },
        borderWidth: {
          type: "number",
          label: "Épaisseur du cadre (pt) — 1,5 pour un trait régulier à l'écran",
          min: 0.25,
          max: 10,
        },
        padding: { type: "number", label: "Marge intérieure du cadre (mm)", min: 0, max: 10 },
        radius: { type: "number", label: "Arrondi des angles (mm)", min: 0, max: 10 },
        titleSize: { type: "number", label: "Corps du nom (pt)", min: 6, max: 20 },
        size: { type: "number", label: "Corps du texte (pt)", min: 5, max: 14 },
      },
      defaultProps: {
        source: "{{accessories}}",
        items: [],
        group: "",
        extraSource: "",
        relatedSource: "",
        exclude: "",
        heading: "",
        headingSize: 14,
        headingColor: "",
        headingAlign: "center",
        columns: 4,
        gap: 8,
        rowGap: 10,
        limit: 12,
        titlePosition: "below",
        imageHeight: 26,
        showDescription: false,
        showFeatures: false,
        featuresHeading: "Caractéristiques",
        justify: false,
        border: true,
        borderColor: "#d9d9d9",
        borderWidth: 0.5,
        padding: 0,
        radius: 0,
        titleSize: 9,
        size: 8,
      },
      render: ({
        source,
        items,
        group,
        exclude,
        extraSource,
        relatedSource,
        heading,
        headingSize,
        headingColor,
        headingAlign,
        columns,
        gap,
        rowGap,
        limit,
        titlePosition,
        imageHeight,
        showDescription,
        showFeatures,
        featuresHeading,
        justify,
        border,
        borderColor,
        borderWidth,
        padding,
        radius,
        titleSize,
        size,
      }) => {
        const all = selectCards(source, items, group, exclude, extraSource, relatedSource);

        const cards = all.filter((card) => typeof card?.name === "string" && card.name !== "");
        const shown = cards.slice(0, limit ?? 12);
        if (shown.length === 0) return <></>;

        // A cote de l'image, le nom s'aligne sur elle, a gauche ; partout
        // ailleurs il se centre sous ou sur elle.
        const beside = titlePosition === "beside";
        const titleAlign = beside ? "left" : "center";
        const title = (card: Card) => (
          <div>
            <div style={{ fontSize: `${titleSize ?? 9}pt`, fontWeight: 700, textAlign: titleAlign }}>
              {card.name}
            </div>
            {card.subtitle ? (
              <div style={{ textAlign: titleAlign, opacity: 0.8 }}>{card.subtitle}</div>
            ) : null}
          </div>
        );

        /**
         * UNE RANGEE INCOMPLETE SE CENTRE, elle ne se tasse pas a gauche.
         *
         * Trois accessoires dans une grille de quatre colonnes laissaient la
         * quatrieme vide : le bloc paraissait decale, alors qu'il etait simplement
         * aligne sur une colonne qui n'existait pour personne.
         *
         * Les pistes gardent LA LARGEUR QU'ELLES AURAIENT EUE pleines — sans quoi
         * trois fiches s'etaleraient sur toute la largeur et changeraient de taille
         * d'un produit a l'autre. Seule leur position change.
         *
         * Quand la rangee est pleine, la declaration reste `1fr` a l'identique :
         * le HTML des templates deja publies ne bouge pas.
         */
        const colonnes = columns ?? 4;
        const partielle = shown.length < colonnes;
        const gouttiere = gap ?? 8;

        const grille = (
          <div
            className="ds-cardgrid"
            style={{
              display: "grid",
              gridTemplateColumns: partielle
                ? `repeat(${shown.length}, calc((100% - ${(colonnes - 1) * gouttiere}mm) / ${colonnes}))`
                : `repeat(${colonnes}, 1fr)`,
              justifyContent: partielle ? "center" : undefined,
              columnGap: mm(gouttiere),
              rowGap: mm(rowGap ?? 10),
              fontSize: `${size ?? 8}pt`,
            }}
          >
            {shown.map((card, index) => {
              const features = Array.isArray(card.features) ? card.features : [];

              return (
                /**
                 * TROIS RANGEES PARTAGEES quand le nom coiffe l'image.
                 *
                 * « Serrure à code électronique » tient sur deux lignes la ou
                 * « Clés » en tient une : l'image de la premiere descendait donc
                 * d'une ligne, et la rangee paraissait bancale. Chaque fiche
                 * empruntait sa propre hauteur de titre.
                 *
                 * `subgrid` fait partager aux fiches les MEMES rangees — titre,
                 * image, puis tout le reste — de sorte que la plus haute impose
                 * la ligne de base a toutes. Le gouttiere propre a la fiche
                 * l'emporte sur celle de la grille : 2 mm entre les rangees
                 * d'une fiche, l'ecart de la grille entre deux fiches.
                 *
                 * Chromium 151 rend ces documents et connait subgrid depuis la
                 * 117. La position « nom dessous » garde l'empilement simple :
                 * son image ouvre la fiche, rien ne la decale.
                 */
                <div
                  key={index}
                  style={
                    titlePosition === "above"
                      ? {
                          display: "grid",
                          gridTemplateRows: "subgrid",
                          gridRow: "span 3",
                          rowGap: mm(2),
                          breakInside: "avoid",
                        }
                      : beside
                        ? {
                            // La photo prend sa largeur naturelle a la hauteur
                            // reglee, le texte le reste ; centres l'un sur
                            // l'autre, comme sur la fiche de reference.
                            display: "grid",
                            gridTemplateColumns: "auto minmax(0, 1fr)",
                            columnGap: mm(3),
                            alignItems: "center",
                            breakInside: "avoid",
                          }
                        : { ...stack(2), breakInside: "avoid" }
                  }
                >
                  {titlePosition === "above" ? title(card) : null}

                  {hasSrc(card.image ?? undefined) ? (
                    // LE CADRE EPOUSE L'IMAGE, il ne remplit pas la cellule.
                    // Une largeur de 100 % avec `object-fit: contain` laissait
                    // deux bandes vides de part et d'autre d'une photo dont le
                    // rapport differe de celui de la colonne — un cadre qui
                    // entoure du blanc, ce que ne fait aucune fiche de
                    // reference. La hauteur pilote, la largeur suit.
                    <div style={{ textAlign: beside ? "left" : "center" }}>
                      <img
                        src={card.image as string}
                        alt=""
                        style={{
                          height: mm(imageHeight ?? 26),
                          width: "auto",
                          maxWidth: "100%",
                          objectFit: "contain",
                          border: border ? `${borderWidth ?? 0.5}pt solid ${borderColor || "#d9d9d9"}` : undefined,
                          // Marge et arrondi n'existent qu'avec le cadre, et ne
                          // s'ecrivent que s'ils sont regles : le HTML des fiches
                          // publiees reste celui d'avant.
                          padding: border && padding ? mm(padding) : undefined,
                          borderRadius: border && radius ? mm(radius) : undefined,
                          // Avec une marge, la hauteur reglee devient celle du
                          // cadre : sinon une image deja a 100 % de la colonne
                          // deborderait de deux marges.
                          boxSizing: border && padding ? "border-box" : "content-box",
                        }}
                      />
                    </div>
                  ) : titlePosition === "above" || beside ? (
                    // La rangee de l'image doit exister meme vide : sans elle,
                    // une fiche sans photo remonterait son texte d'un cran et
                    // casserait l'alignement qu'on vient d'obtenir. A cote de
                    // l'image, c'est la COLONNE qui doit exister : sans elle le
                    // texte prendrait la place de la photo.
                    <div />
                  ) : null}

                  {/* TROISIEME ET DERNIERE RANGEE : tout ce qui suit l'image
                      tient dans un seul enfant, sinon la fiche deborderait des
                      trois rangees qu'elle partage avec ses voisines. En mode
                      « nom dessous », le meme groupe s'empile simplement. */}
                  <div style={stack(2)}>
                    {titlePosition === "above" ? null : title(card)}

                    {showDescription && card.description ? (
                      <div style={{ textAlign: justify ? "justify" : "left" }}>{card.description}</div>
                    ) : null}

                    {showFeatures && features.length > 0 ? (
                      <div>
                        {featuresHeading ? (
                          <div style={{ fontWeight: 700, marginBottom: mm(1) }}>{featuresHeading}</div>
                        ) : null}
                        {/* Marge de liste posee ici et non heritee : le registry
                            ne pose que des styles en ligne, et la feuille du
                            document ne vise pas les listes. */}
                        <ul style={{ margin: 0, paddingLeft: mm(4) }}>
                          {features.map((feature, featureIndex) => (
                            <li key={featureIndex}>
                              {feature.name ? `${feature.name} : ` : ""}
                              {feature.value}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        );

        // SANS TITRE, LE RENDU EST INCHANGE — pas de conteneur supplementaire,
        // donc aucune retouche des templates deja publies qui n'en demandent pas.
        if (!heading) return grille;

        return (
          <>
            <div
              style={{
                fontSize: `${headingSize ?? 14}pt`,
                fontWeight: 700,
                textAlign: headingAlign ?? "center",
                color: headingColor || undefined,
                marginBottom: mm(2),
              }}
            >
              {heading}
            </div>
            {grille}
          </>
        );
      },
    },

    QrCode: {
      label: "QR code",
      fields: {
        content: {
          type: "text",
          label: "Contenu à encoder",
          placeholder: "{{product.url}}",
        },
        source: {
          type: "text",
          label: "Image déjà prête (rarement utile)",
          placeholder: "laisser vide : le QR est généré",
        },
        size: { type: "number", label: "Taille (mm)", min: 10, max: 60 },
        caption: { type: "text", label: "Légende", placeholder: "Scanner pour la fiche en ligne" },
        align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
        dark: { type: "text", label: "Couleur des modules" },
        light: { type: "text", label: "Couleur de fond (vide = transparent)" },
        margin: { type: "number", label: "Marge (modules)", min: 0, max: 8 },
      },
      defaultProps: {
        content: "{{product.url}}",
        source: "",
        size: 22,
        caption: "",
        align: "center",
        dark: "#000000",
        light: "",
        margin: 2,
      },
      render: ({ content, source, size, caption, align, dark, light, margin }) => {
        // Le QR est genere ICI, de facon synchrone : il apparait donc a
        // l'identique dans l'apercu de l'editeur et dans le PDF, sans que la
        // boutique ait a fournir d'image. Une source explicite reste prioritaire
        // pour le cas ou une boutique produirait deja son propre visuel.
        const src = hasSrc(source) ? source : qrSvgDataUri(content ?? "", { dark, light, margin });
        if (!src) return <></>;

        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: justifyFor(align) }}>
            <img src={src} alt="" style={{ width: mm(size ?? 22), height: mm(size ?? 22) }} />
            {caption ? <div style={{ fontSize: "7pt", marginTop: "1mm" }}>{caption}</div> : null}
          </div>
        );
      },
    },

    // ---------------------------------------------------------------- Bandeaux

    PageHeader: {
      label: "Bandeau d'en-tête",
      fields: {
        title: { type: "text", label: "Titre", placeholder: "{{product.name}}" },
        subtitle: { type: "text", label: "Sous-titre", placeholder: "{{product.sku}}" },
        logoUrl: { type: "text", label: "Logo", placeholder: "{{shop.logo}}" },
        logoHeight: { type: "number", label: "Hauteur du logo (mm)", min: 4, max: 40 },
        backgroundUrl: { type: "text", label: "Image de fond", placeholder: "/assets/shared/bandeau" },
        backgroundColor: { type: "text", label: "Couleur de fond", placeholder: "var(--color-primary)" },
        textColor: { type: "text", label: "Couleur du texte", placeholder: "#ffffff" },
        height: { type: "number", label: "Hauteur (mm)", min: 10, max: 60 },
      },
      defaultProps: {
        title: "{{product.name}}",
        subtitle: "{{product.sku}}",
        logoUrl: "{{shop.logo}}",
        logoHeight: 12,
        backgroundUrl: "",
        backgroundColor: "var(--color-primary)",
        textColor: "#ffffff",
        height: 26,
      },
      render: ({ title, subtitle, logoUrl, logoHeight, backgroundUrl, backgroundColor, textColor, height }) => (
        <div
          style={{
            // width: 100% indispensable : dans les zones repetees, Chromium
            // fait de ce div un item flex, qui sinon epouse son contenu au lieu
            // de la largeur de page. Voir buildMarginBoxDocument().
            width: "100%",
            boxSizing: "border-box",
            height: mm(height ?? 26),
            backgroundColor: backgroundColor || "var(--color-primary)",
            backgroundImage: hasSrc(backgroundUrl) ? `url("${backgroundUrl}")` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: textColor || "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8mm",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "13pt", fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
            {subtitle ? <div style={{ fontSize: "8pt", opacity: 0.9 }}>{subtitle}</div> : null}
          </div>
          {hasSrc(logoUrl) ? <img src={logoUrl} alt="" style={{ height: mm(logoHeight ?? 12), width: "auto" }} /> : null}
        </div>
      ),
    },

    PageFooter: {
      label: "Bandeau de pied de page",
      fields: {
        left: { type: "text", label: "Zone gauche", placeholder: "{{shop.company.address}}" },
        center: { type: "text", label: "Zone centrale", placeholder: "{{shop.company.phone}}" },
        backgroundColor: { type: "text", label: "Couleur de fond", placeholder: "var(--color-primary)" },
        backgroundUrl: { type: "text", label: "Image de fond", placeholder: "/assets/shared/bandeau-bas" },
        textColor: { type: "text", label: "Couleur du texte", placeholder: "#ffffff" },
        height: { type: "number", label: "Hauteur (mm)", min: 8, max: 40 },
        showPageNumbers: { type: "radio", label: "Numérotation", options: YES_NO },
      },
      defaultProps: {
        left: "{{shop.company.address}}",
        center: "{{shop.company.phone}} - {{shop.company.email}}",
        backgroundColor: "var(--color-secondary)",
        backgroundUrl: "",
        textColor: "#ffffff",
        height: 16,
        showPageNumbers: true,
      },
      render: ({ left, center, backgroundColor, backgroundUrl, textColor, height, showPageNumbers }) => (
        <div
          style={{
            // Voir PageHeader : sans width 100%, le bandeau ne couvre pas la page.
            width: "100%",
            boxSizing: "border-box",
            height: mm(height ?? 16),
            backgroundColor: backgroundColor || "var(--color-secondary)",
            backgroundImage: hasSrc(backgroundUrl) ? `url("${backgroundUrl}")` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            color: textColor || "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "4mm",
            padding: "0 8mm",
            fontSize: "7.5pt",
          }}
        >
          <span>{left}</span>
          <span>{center}</span>
          {/* Chromium remplace le contenu textuel des elements portant les
              classes pageNumber / totalPages. Ces spans DOIVENT rester vides.
              Ne fonctionne que dans footer.html, pas dans le corps. */}
          {showPageNumbers ? (
            <span>
              <span className="pageNumber" /> / <span className="totalPages" />
            </span>
          ) : (
            <span />
          )}
        </div>
      ),
    },

    PageNumber: {
      label: "Numérotation",
      fields: {
        format: {
          type: "select",
          label: "Format",
          options: [
            { label: "1 / 3", value: "n/total" },
            { label: "Page 1 sur 3", value: "long" },
            { label: "1", value: "n" },
          ],
        },
        size: { type: "number", label: "Corps (pt)", min: 5, max: 16 },
        align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
        color: { type: "text", label: "Couleur", placeholder: "var(--color-primary)" },
      },
      defaultProps: { format: "n/total", size: 7.5, align: "right", color: "" },
      render: ({ format, size, align, color }) => {
        // Chromium remplace le CONTENU TEXTUEL des elements portant les classes
        // pageNumber et totalPages. Ces spans doivent donc rester vides, et cela
        // ne fonctionne QUE dans les zones repetees (en-tete / pied de page).
        const current = <span className="pageNumber" />;
        const total = <span className="totalPages" />;

        return (
          <div
            style={{
              fontSize: `${size ?? 7.5}pt`,
              textAlign: align ?? "right",
              color: color || undefined,
            }}
          >
            {format === "n" ? (
              current
            ) : format === "long" ? (
              <>
                Page {current} sur {total}
              </>
            ) : (
              <>
                {current} / {total}
              </>
            )}
          </div>
        );
      },
    },
  },
};

export const componentNames = Object.keys(datasheetConfig.components);
