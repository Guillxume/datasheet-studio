import { z } from "zod";

/**
 * Schema du payload de rendu.
 *
 * CONTRAT PUBLIC — c'est la seule chose que le Studio connaisse de la boutique
 * appelante. Aucun champ ne doit porter de vocabulaire specifique a une
 * plateforme : les noms sont choisis pour se mapper aussi bien depuis
 * PrestaShop que depuis Medusa, Shopify ou un ERP.
 *
 *   PrestaShop  reference -> sku      ean13 -> gtin
 *   Medusa      variant.sku -> sku    variant.barcode -> gtin
 *
 * Toute rupture de ce schema casse les templates deja publies : preferer
 * l'ajout de champs optionnels a la modification de champs existants.
 */

/**
 * Reference vers une image. Deux transports acceptes :
 *   - "asset://<cle>"  : fichier joint dans le multipart de la requete.
 *                        Indispensable quand la boutique n'est pas joignable
 *                        depuis le Studio (chemins filesystem locaux, Docker,
 *                        domaines *.localhost).
 *   - "https://..."    : URL publique, telechargee par Chromium au rendu.
 *                        Plus economique quand les medias sont sur un CDN.
 *   - "data:..."       : deja inline.
 */
const imageRef = z.string().min(1);

/**
 * PHP ne distingue pas les tableaux des dictionnaires : json_encode([]) produit
 * "[]" et non "{}". Un client PHP qui envoie un `custom` ou un `company` vide
 * fait donc echouer la validation sur un "expected object, received array"
 * incomprehensible du point de vue de l'appelant.
 *
 * Le contrat etant public, la tolerance appartient au serveur : c'est lui qui
 * connait l'intention, et tout client PHP tomberait sinon dans le meme piege.
 */
const fromPhpEmptyArray = <T extends z.ZodTypeAny>(schema: T, fallback: unknown = {}) =>
  z.preprocess((value) => (Array.isArray(value) && value.length === 0 ? fallback : value), schema);

export const imageSchema = z.object({
  src: imageRef,
  legend: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const featureSchema = z.object({
  name: z.string(),
  value: z.string(),
  /** Lettre de renvoi vers le schema cote (module acmefeatureabbreviation). */
  abbreviation: z.string().nullish(),
  group: z.string().nullish(),
});

/**
 * Une valeur proposee au client : un coloris, une fermeture, un piètement.
 *
 * NI la couleur NI le picto ne sont obligatoires, et c'est le point important
 * de ce schema. Ce sont de la PRESENTATION : le meme « Bleu » vaut #2b4ea2 sur
 * les dix-sept fiches de vestiaires, et le picto d'une serrure a code ne change
 * pas d'un produit a l'autre. Les faire voyager dans chaque payload obligerait
 * chaque plateforme a les connaitre — or PrestaShop a un champ couleur natif
 * sur ses attributs, Medusa n'en a pas sur ses valeurs d'option.
 *
 * Ils sont donc facultatifs ici et retombent sur la correspondance portee par
 * le bloc `SwatchGroups`, qui rapproche par LIBELLE. Une plateforme qui sait
 * gagne ; une plateforme qui ne sait pas n'empeche rien.
 */
export const finishOptionSchema = z.object({
  /** Ce qui est imprime sous la pastille : "Bleu", "Clés", "Serrure à code". */
  label: z.string(),
  /** Aplat de couleur. Toute valeur CSS valide : "#2b4ea2", "rgb(...)". */
  color: z.string().nullish(),
  /**
   * Contenu de la pastille quand un aplat ne suffit pas, et PRIORITAIRE sur
   * `color`. Deux usages constates, d'ou un nom neutre plutot que `icon` :
   * un picto au trait pour une fermeture, une texture pour un decor bois
   * ("Chêne clair", "Hêtre" sur les fiches de bureaux).
   */
  image: imageRef.nullish(),
  /** Precision sous le libelle : "RAL 5010". */
  note: z.string().nullish(),
});

/**
 * Un groupe de valeurs : « Coloris des portes », « Fermeture », « Dossier ».
 *
 * La forme est celle des deux plateformes visees, sans traduction :
 *   PrestaShop  groupe d'attributs -> label, ses valeurs -> options
 *   Medusa      product.options[]  -> label, .values[]   -> options
 */
export const finishGroupSchema = z.object({
  /** Vide pour un groupe unique sans titre — le cas des chaises coque. */
  label: z.string().nullish(),
  options: z.array(finishOptionSchema).default([]),
  /** Reserve affichee sous le groupe : "Pour vestiaire 2 portes uniquement". */
  note: z.string().nullish(),
});

/**
 * Une fiche detaillee : un accessoire en option, une fermeture.
 *
 * UN SEUL schema pour deux collections, parce que les fiches de reference les
 * composent a l'identique — photo encadree, nom, description justifiee, puces
 * « Caractéristiques ». Deux schemas identiques diraient qu'ils peuvent
 * diverger, ce qui n'a aucune raison d'arriver.
 *
 * `features` reutilise featureSchema : les puces observees sont toutes des
 * paires ("Largeur : 80 cm", "Matériau : tôle d'acier 8/10ème"), pas du texte
 * libre. Un type de plus n'apporterait rien et ferait diverger le regroupement
 * des doublons, deja ecrit et teste pour les caracteristiques.
 */
export const detailCardSchema = z.object({
  name: z.string(),
  /** Ligne courte sous le nom : "2 clés fournies", "(en option)". */
  subtitle: z.string().nullish(),
  /** La photo de la fiche detaillee. */
  image: imageRef.nullish(),
  /**
   * Picto compact, pour la rangee de choix — distinct de la photo.
   * Une fermeture se montre en dessin au trait page 1, en photo page 3.
   */
  icon: imageRef.nullish(),
  description: z.string().nullish(),
  features: z.array(featureSchema).default([]),
});

export const shopSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  logo: imageRef.optional(),
  colors: fromPhpEmptyArray(
    z
      .object({
        primary: z.string().optional(),
        secondary: z.string().optional(),
      })
      .default({})
  ),
  company: fromPhpEmptyArray(
    z
      .object({
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        legal: z.string().optional(),
      })
      .default({})
  ),
});

export const productSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string(),
  /** PrestaShop: reference — Medusa: variant.sku */
  sku: z.string().nullish(),
  /** PrestaShop: ean13 — Medusa: variant.barcode */
  gtin: z.string().nullish(),
  mpn: z.string().nullish(),
  /**
   * Les references des DECLINAISONS du produit, et ses references FOURNISSEUR
   * (produit et declinaisons, tous fournisseurs confondus).
   *
   * N'entrent pas dans le rendu, comme `datasheet_url` : le Studio les range dans
   * son index, pour que /consultation retrouve une fiche a partir de la
   * reference qu'on a sous les yeux — celle d'un devis ou d'un bon fournisseur,
   * qui est rarement celle du produit parent.
   *
   * ABSENT ET VIDE NE DISENT PAS LA MEME CHOSE : absent, l'index garde ce qu'un
   * rendu precedent y avait mis ; `[]`, le produit n'en a plus.
   *
   *   PrestaShop  product_attribute.reference          product_supplier.product_supplier_reference
   *   Medusa      variants[].sku                       AUCUN EQUIVALENT NATIF — une cle de metadata
   */
  variant_skus: z.array(z.string()).nullish(),
  supplier_skus: z.array(z.string()).nullish(),
  url: z.string().nullish(),
  /**
   * Adresse PUBLIQUE de la fiche technique, telle que la boutique la sert.
   *
   * N'entre pas dans le rendu : le Studio la range dans son index (table
   * datasheets) pour /consultation, qui liste les fiches d'une boutique et les
   * telecharge en lot. Facultative — un module qui ne l'envoie pas voit ses
   * produits listes, sans lien.
   *
   *   PrestaShop  route du module acmedatasheet (/fiche-technique/{slug}-{id}.pdf)
   *   Medusa      route de la vitrine qui sert la fiche
   */
  datasheet_url: z.string().nullish(),
  brand: z.string().nullish(),
  category_path: z.array(z.string()).default([]),
  price: fromPhpEmptyArray(
    z
      .object({
        /** Montant brut, separateur point : "349.00". Le formatage est fait au rendu. */
        amount: z.string().optional(),
        currency: z.string().optional(),
        tax_included: z.boolean().optional(),
        /**
         * Rempli par le Studio (prepare.ts), pas par l'appelant : c'est ce qui
         * garantit un rendu identique depuis le web et depuis un cron.
         * Les templates utilisent {{product.price.formatted}}.
         */
        formatted: z.string().optional(),
      })
      .optional(),
    undefined
  ),
  /** HTML issu d'un editeur WYSIWYG. TOUJOURS sanitise avant rendu. */
  description_html: z.string().nullish(),
  description_short: z.string().nullish(),
});

export const renderDataSchema = z.object({
  shop: shopSchema,
  product: productSchema,
  features: z.array(featureSchema).default([]),
  images: z.array(imageSchema).default([]),
  // Un objet absent arrive parfois en tableau vide depuis PHP : il vaut null,
  // pas un objet vide, qui echouerait sur le champ src obligatoire.
  schema_image: fromPhpEmptyArray(imageSchema.nullish(), null),
  /**
   * Badges normalises, resolus en pictos par le template.
   * Remplace le matching par nom de caracteristique traduit de l'ancien
   * module (ProductInfosService::$specialFeatureMap), qui cassait
   * silencieusement des qu'une caracteristique etait renommee en BO.
   * Forme libre, avec convention "cle:valeur" : "ce", "garantie:3ans", "tuv".
   */
  badges: z.array(z.string()).default([]),
  qr_code: fromPhpEmptyArray(imageSchema.nullish(), null),
  /**
   * Les choix laisses au client, par groupe : coloris, fermeture, piètement.
   *
   * Un TABLEAU DE GROUPES et non un dictionnaire : le nombre de groupes varie
   * d'une fiche a l'autre (deux sur un vestiaire, trois sur un fauteuil, un
   * seul et sans titre sur une chaise coque), et leur ORDRE est celui de la
   * mise en page. Un dictionnaire perdrait l'ordre et forcerait le template a
   * nommer les groupes qu'il attend — donc un template par famille de produit.
   */
  finishes: z.array(finishGroupSchema).default([]),
  /**
   * Accessoires en option, montres en rangee puis detailles.
   *
   * UNE COLLECTION ET NON DEUX. Un champ `closures` a existe a cote, pour les
   * fermetures detaillees des fiches de vestiaires. Il a ete retire avant
   * d'avoir servi : les fermetures sont des DECLINAISONS du vestiaire, pas des
   * produits qui lui seraient rattaches. Elles arrivent donc deja par
   * `finishes`, et leur documentation — photo, description, caracteristiques —
   * est la meme sur toutes les fiches de la famille. Elle appartient au
   * template, pas au payload : la faire voyager reviendrait a envoyer le meme
   * texte avec chacune des fiches du catalogue.
   */
  accessories: z.array(detailCardSchema).default([]),
  /**
   * Visuel des details de la page 1, distinct du schema cote de la page 2.
   *
   * LES LEGENDES SONT DANS L'IMAGE, et non dans le payload. Elles l'ont ete un
   * temps — un tableau `callouts` portant un texte, un cote et une hauteur en
   * pourcentage, que le Studio reliait a l'image par des traits de rappel. Ce
   * modele a ete retire avant d'avoir servi, pour une raison qui ne se voit
   * qu'en cherchant qui remplirait ces champs : une legende n'est derivable
   * d'AUCUNE donnee produit. « Tringle avec crochets », a 8 % de la hauteur, a
   * gauche, est une affirmation sur UNE photo precise. Aucun attribut, aucune
   * caracteristique ne la produit — quelqu'un l'ecrit, produit par produit.
   *
   * Incruster les legendes dans le visuel deplace ce travail la ou il est deja
   * fait, dans l'outil de dessin, et supprime un modele de donnees entier.
   *
   * CE QU'ON PERD, et qu'il faut savoir : le texte devient de l'image. Il n'est
   * plus selectionnable dans le PDF, et il est fige dans une langue — un site
   * espagnol ou portugais demande donc son propre visuel.
   */
  detail_image: fromPhpEmptyArray(imageSchema.nullish(), null),
  /** Champs propres a un site, sans faire diverger le schema commun. */
  custom: fromPhpEmptyArray(z.record(z.string(), z.unknown()).default({})),
});

export const renderRequestSchema = z.object({
  /** Slug du template. */
  template: z.string().min(1),
  /** "published" (defaut) ou un numero de version pour figer un rendu. */
  version: z.union([z.literal("published"), z.number().int().positive()]).default("published"),
  locale: z.string().min(2).default("fr"),
  data: renderDataSchema,
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;
export type RenderData = z.infer<typeof renderDataSchema>;
export type Feature = z.infer<typeof featureSchema>;
export type ImageValue = z.infer<typeof imageSchema>;
export type FinishOption = z.infer<typeof finishOptionSchema>;
export type FinishGroup = z.infer<typeof finishGroupSchema>;
export type DetailCard = z.infer<typeof detailCardSchema>;
