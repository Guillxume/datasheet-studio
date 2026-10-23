/**
 * Le contrat d'une source de donnees produit.
 *
 * Un « collecteur » est un client du Studio : il lit une source (CSV, Medusa,
 * API), en tire des fiches, et POSTe /api/v1/render. Le Studio ne connait rien
 * de la source — voir docs/integrer-un-connecteur.md.
 *
 * Une source n'a qu'un devoir : produire des CollectedProduct. Tout le reste —
 * cache de fraicheur, reprise, retentatives, choix du template — est tenu par
 * le noyau et n'a donc pas a etre reecrit trois fois.
 */

/**
 * MIROIR MANUEL de src/lib/payload.ts, et c'est assume.
 *
 * `z.input<typeof renderDataSchema>` serait la source unique ideale, mais les
 * champs passes par `z.preprocess` (la tolerance PHP `[]` -> `{}`) y ont pour
 * type d'entree `unknown`, donc REQUIS au sens de TypeScript : `{ name: "X" }`
 * ne compilerait pas comme boutique valide. Le type deduit rendrait l'ecriture
 * d'une source penible pour un gain nul.
 *
 * La verite reste zod : `assemblePayload` passe TOUJOURS le resultat dans
 * `renderRequestSchema` avant l'envoi, et `types.test.ts` verifie qu'un
 * CollectedData complet y est accepte. Ces types-la ne servent qu'a ecrire une
 * source sans se tromper de nom de champ ; ils ne valident rien.
 */

export type ImageInput = {
  src: string;
  legend?: string;
  width?: number;
  height?: number;
};

export type FeatureInput = {
  name: string;
  value: string;
  /** Lettre de renvoi vers le schema cote. */
  abbreviation?: string | null;
  group?: string | null;
};

/** Une valeur proposee au client. Couleur et picto sont facultatifs : voir payload.ts. */
export type FinishOptionInput = {
  label: string;
  color?: string | null;
  /** Picto ou texture. Prioritaire sur `color`. */
  image?: string | null;
  note?: string | null;
};

export type FinishGroupInput = {
  label?: string | null;
  options?: FinishOptionInput[];
  note?: string | null;
};

/** Accessoire ou fermeture, dans sa forme detaillee. */
export type DetailCardInput = {
  name: string;
  subtitle?: string | null;
  image?: string | null;
  icon?: string | null;
  description?: string | null;
  features?: FeatureInput[];
};

export type ShopInput = {
  name?: string;
  url?: string;
  logo?: string;
  colors?: { primary?: string; secondary?: string };
  company?: { address?: string; phone?: string; email?: string; legal?: string };
};

export type ProductInput = {
  id?: string | number;
  name: string;
  sku?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  /** Index de /consultation seulement, comme dans src/lib/payload.ts : absent, le Studio garde les siennes. */
  variant_skus?: string[] | null;
  supplier_skus?: string[] | null;
  url?: string | null;
  brand?: string | null;
  category_path?: string[];
  price?: {
    /** Chaine, separateur POINT, NON formatee : "349.00". Le Studio formate. */
    amount?: string;
    currency?: string;
    tax_included?: boolean;
  };
  description_html?: string | null;
  description_short?: string | null;
};

export type CollectedData = {
  /** Absent le plus souvent : la boutique vient de --shop, commune a toutes les fiches. */
  shop?: ShopInput;
  product: ProductInput;
  features?: FeatureInput[];
  images?: ImageInput[];
  schema_image?: ImageInput | null;
  badges?: string[];
  qr_code?: ImageInput | null;
  finishes?: FinishGroupInput[];
  accessories?: DetailCardInput[];
  /** Visuel des details, legendes INCRUSTEES. Voir src/lib/payload.ts. */
  detail_image?: ImageInput | null;
  custom?: Record<string, unknown>;
};

/**
 * Une piece jointe du multipart, referencee par `asset://<key>` dans les
 * donnees.
 *
 * `fingerprint` est decide par la source et n'entre PAS dans le payload : il
 * n'existe que pour la cle de fraicheur. Un fichier local donne « taille+mtime »
 * (une lecture complete a chaque comparaison couterait trop cher sur un
 * catalogue), une image distante donne son ETag ou son updated_at. Sans ce
 * champ, retoucher une image sans toucher au produit laisserait la fiche en
 * cache indefiniment — le defaut nomme au §5 de docs/integrer-un-connecteur.md.
 */
export type CollectedAsset = {
  key: string;
  mime: string;
  bytes: Buffer;
  fingerprint: string;
};

export type CollectedProduct = {
  /**
   * Identifiant STABLE dans la source. C'est la cle du journal : s'il change
   * d'un passage a l'autre, toutes les fiches sont regenerees a chaque fois.
   * Une reference produit, pas un numero de ligne.
   */
  ref: string;
  data: CollectedData;
  assets?: CollectedAsset[];
  /** Impose le template pour CETTE fiche. Sinon : les regles, puis --template. */
  template?: string;
  locale?: string;
  /**
   * Empreinte fournie par la source quand elle en connait une meilleure que le
   * hachage du payload — un `updated_at` d'API, par exemple. Optionnel :
   * l'empreinte du payload suffit et ne se trompe jamais dans le sens dangereux
   * (elle peut regenerer pour rien, jamais laisser passer une modification).
   */
  fingerprint?: string;
  /** Ce que la source n'a pas su faire sans pour autant perdre la fiche. */
  warnings?: string[];
};

export type Source = {
  readonly name: string;
  /**
   * Paresseux, et c'est le point : un catalogue de plusieurs milliers de
   * references ne tient pas en memoire, et une generation bornee par un budget
   * de temps ne doit pas payer la pagination complete avant de rendre la
   * premiere fiche.
   */
  list(): AsyncIterable<CollectedProduct>;
  close?(): Promise<void>;
};
