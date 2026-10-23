import { attachUrl } from "../core/assets";
import { textToHtml, toAmount } from "@/lib/mapping";
import type {
  CollectedAsset,
  CollectedData,
  CollectedProduct,
  FeatureInput,
  ImageInput,
  Source,
} from "../core/types";

/**
 * Collecteur Medusa v2.
 *
 * Le contrat du Studio a ete ecrit en pensant a ce cas — c'est meme la
 * correspondance citee en tete de src/lib/payload.ts :
 *
 *   Medusa  variant.sku -> sku     variant.barcode -> gtin
 *
 * Rien n'est donc a changer cote Studio ; tout ce qui suit est du mapping.
 *
 * DEUX APIS, et le choix n'est pas cosmetique :
 *
 *   admin  (defaut)  voit les brouillons, les prix par devise, toutes les
 *                    metadonnees. C'est l'API d'un travail de fond.
 *   store            voit ce que voit un client : le prix CALCULE pour une
 *                    region, taxes comprises ou non selon la configuration.
 *                    C'est la bonne API si la fiche doit afficher le prix que
 *                    le client verra.
 *
 * ETAT DES LIEUX SUR L'AUTHENTIFICATION (verifie sur docs.medusajs.com en
 * aout 2026) : `x-medusa-access-token` n'existe plus en v2. Une cle secrete
 * d'administration se passe en `Authorization: Basic <cle>`, non encodee ; le
 * base64 reste accepte par compatibilite. Le collecteur envoie la forme non
 * encodee et, sur un 401, retente UNE fois en base64 — un serveur plus ancien
 * repond alors correctement, et la ligne de journal dit laquelle a marche.
 */

export type MedusaSourceOptions = {
  url: string;
  mode: "admin" | "store";
  /** Cle secrete d'administration (sk_...), en Basic. */
  secretKey?: string;
  /** Jeton JWT deja obtenu, en Bearer. */
  jwt?: string;
  email?: string;
  password?: string;
  /** Cle publiable (pk_...), obligatoire en mode store. */
  publishableKey?: string;
  regionId?: string;
  currency: string;
  variants: "first" | "all";
  /**
   * Medusa v2 stocke des montants en unites (349 = 349,00 EUR). Une base
   * migree depuis la v1, ou un module de prix maison, peut encore compter en
   * centimes : --price-scale minor divise alors par 100.
   */
  priceScale: "decimal" | "minor";
  /** Declare si le montant servi est TTC. Absent = le template ne dit rien. */
  taxIncluded?: boolean;
  storeUrl?: string;
  brandFrom: "collection" | "type" | "metadata" | "none";
  brandMetadataKey: string;
  featuresFrom: Array<"options" | "metadata">;
  badgesFromTags: boolean;
  /** Rapatrie les images pour les joindre, au lieu de laisser Chromium les charger. */
  downloadImages: boolean;
  status?: string;
  updatedSince?: string;
  handles?: string[];
  ids?: string[];
  pageSize: number;
  fetchImpl?: typeof fetch;
};

type MedusaImage = { id?: string; url?: string; rank?: number };
type MedusaOptionValue = { value?: string; option_id?: string; option?: { title?: string } };
type MedusaPrice = { amount?: number | string; currency_code?: string };
type MedusaVariant = {
  id: string;
  title?: string;
  sku?: string | null;
  barcode?: string | null;
  ean?: string | null;
  upc?: string | null;
  updated_at?: string;
  metadata?: Record<string, unknown> | null;
  options?: MedusaOptionValue[];
  prices?: MedusaPrice[];
  calculated_price?: {
    calculated_amount?: number;
    currency_code?: string;
    is_calculated_price_tax_inclusive?: boolean;
  };
};
type MedusaProduct = {
  id: string;
  title?: string;
  subtitle?: string | null;
  handle?: string;
  description?: string | null;
  thumbnail?: string | null;
  status?: string;
  updated_at?: string;
  metadata?: Record<string, unknown> | null;
  images?: MedusaImage[];
  options?: Array<{ id: string; title?: string }>;
  variants?: MedusaVariant[];
  categories?: Array<{ id: string; name?: string }>;
  collection?: { title?: string } | null;
  type?: { value?: string } | null;
  tags?: Array<{ value?: string }>;
};

type Category = { id: string; name: string; parent: string | null };

export class MedusaSource implements Source {
  readonly name: string;
  private readonly options: MedusaSourceOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly base: string;
  private basicBase64 = false;
  private bearer: string | null = null;
  private categories = new Map<string, Category>();
  /** Ce qui a ete constate a l'execution et merite d'apparaitre au compte rendu. */
  private notes: string[] = [];

  constructor(options: MedusaSourceOptions) {
    this.options = options;
    this.base = options.url.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.name = `medusa ${this.base} (${options.mode})`;
    this.bearer = options.jwt ?? null;
  }

  async *list(): AsyncIterable<CollectedProduct> {
    await this.loadCategories();

    const prefix = this.options.mode === "admin" ? "/admin" : "/store";
    let offset = 0;

    for (;;) {
      const page = await this.request<{ products?: MedusaProduct[]; count?: number }>(
        `${prefix}/products`,
        {
          limit: String(this.options.pageSize),
          offset: String(offset),
          fields: this.fields(),
          ...(this.options.mode === "admin" && this.options.status
            ? { status: this.options.status }
            : {}),
          ...(this.options.mode === "store" && this.options.regionId
            ? { region_id: this.options.regionId }
            : {}),
          ...(this.options.updatedSince ? { "updated_at[$gte]": this.options.updatedSince } : {}),
          ...(this.options.handles?.length ? { handle: this.options.handles } : {}),
          ...(this.options.ids?.length ? { id: this.options.ids } : {}),
        }
      );

      const products = page.products ?? [];
      if (products.length === 0) return;

      for (const product of products) {
        for (const collected of await this.toProducts(product)) yield collected;
      }

      offset += products.length;
      if (page.count !== undefined && offset >= page.count) return;
      // Un serveur qui ignorerait `offset` renverrait indefiniment la meme page :
      // la borne sur `count` est la seule sortie de boucle fiable, mais elle
      // n'existe pas partout. Une page plus courte que demandee vaut fin.
      if (products.length < this.options.pageSize) return;
    }
  }

  private fields(): string {
    const common = [
      "id",
      "title",
      "subtitle",
      "handle",
      "description",
      "thumbnail",
      "updated_at",
      "metadata",
      "*images",
      "*options",
      "*options.values",
      "*variants",
      "*variants.options",
      "*categories",
      "*collection",
      "*tags",
      "*type",
    ];
    // Les prix ne se demandent pas de la meme facon : l'admin sert les prix
    // bruts par devise, la boutique le prix calcule pour une region.
    return this.options.mode === "admin"
      ? [...common, "status", "*variants.prices"].join(",")
      : [...common, "*variants.calculated_price"].join(",");
  }

  /**
   * Le fil d'ariane, reconstruit a partir de l'arbre des categories charge une
   * fois. Les produits ne portent que des categories a plat : sans cet arbre,
   * `category_path` vaudrait ["Transpalettes"] au lieu de
   * ["Manutention", "Transpalettes"], et les regles de template par prefixe ne
   * pourraient pas fonctionner.
   */
  private async loadCategories(): Promise<void> {
    const prefix = this.options.mode === "admin" ? "/admin" : "/store";
    try {
      const page = await this.request<{
        product_categories?: Array<{ id: string; name?: string; parent_category_id?: string | null }>;
      }>(`${prefix}/product-categories`, {
        limit: "1000",
        fields: "id,name,parent_category_id",
      });
      for (const category of page.product_categories ?? []) {
        this.categories.set(category.id, {
          id: category.id,
          name: category.name ?? "",
          parent: category.parent_category_id ?? null,
        });
      }
    } catch (cause) {
      // Une instance sans categories, ou une permission manquante, ne doit pas
      // empecher de rendre les fiches : on perd le fil d'ariane, pas le PDF.
      this.notes.push(
        `arbre des categories indisponible (${cause instanceof Error ? cause.message : String(cause)})`
      );
    }
  }

  private categoryPath(product: MedusaProduct): string[] {
    let best: string[] = [];
    for (const assigned of product.categories ?? []) {
      const path: string[] = [];
      let current = this.categories.get(assigned.id);
      const guard = new Set<string>();
      while (current && !guard.has(current.id)) {
        guard.add(current.id);
        if (current.name !== "") path.unshift(current.name);
        current = current.parent ? this.categories.get(current.parent) : undefined;
      }
      if (path.length === 0 && assigned.name) path.push(assigned.name);
      // Le produit peut appartenir a plusieurs categories : la plus profonde
      // est la plus specifique, donc celle qui decrit le mieux le produit et
      // qui fera gagner la regle de template la plus precise.
      if (path.length > best.length) best = path;
    }
    return best;
  }

  private async toProducts(product: MedusaProduct): Promise<CollectedProduct[]> {
    const variants = product.variants ?? [];
    const selected =
      this.options.variants === "all" ? variants : variants.slice(0, 1);
    if (selected.length === 0) {
      // Un produit sans variante n'a ni SKU ni prix : la fiche existe quand meme.
      return [await this.toProduct(product, null)];
    }
    const collected: CollectedProduct[] = [];
    for (const variant of selected) {
      collected.push(await this.toProduct(product, variant));
    }
    return collected;
  }

  private async toProduct(
    product: MedusaProduct,
    variant: MedusaVariant | null
  ): Promise<CollectedProduct> {
    const warnings: string[] = [...this.notes];
    this.notes = [];
    const assets: CollectedAsset[] = [];

    const { images, imageWarnings } = await this.buildImages(product, assets);
    warnings.push(...imageWarnings);

    const price = this.buildPrice(variant, warnings);
    const features = this.buildFeatures(product, variant);
    const path = this.categoryPath(product);

    const data: CollectedData = {
      product: {
        id: product.id,
        // Le titre de la variante n'est ajoute que s'il distingue vraiment
        // quelque chose : "Default variant" sur une fiche serait du bruit.
        name: this.buildName(product, variant),
        sku: variant?.sku ?? null,
        gtin: variant?.barcode ?? variant?.ean ?? variant?.upc ?? null,
        mpn: scalar(variant?.metadata?.mpn ?? product.metadata?.mpn),
        // Une fiche par produit couvre toutes ses variantes : chacune doit la
        // retrouver dans /consultation. Une fiche par variante porte deja la
        // sienne dans `sku`. Pas de reference fournisseur : Medusa n'en a aucune
        // nativement (voir src/lib/payload.ts).
        ...(this.options.variants === "first"
          ? { variant_skus: (product.variants ?? []).flatMap((item) => (item.sku ? [item.sku] : [])) }
          : {}),
        url: this.buildUrl(product),
        brand: this.buildBrand(product),
        category_path: path,
        ...(price ? { price } : {}),
        // `description` est du texte chez Medusa : l'envoyer tel quel dans un
        // champ *_html perdrait tous les sauts de ligne au rendu.
        description_html: product.description ? textToHtml(product.description) : null,
        description_short: product.subtitle ?? null,
      },
      features,
      images,
      badges: this.options.badgesFromTags
        ? (product.tags ?? []).map((tag) => tag.value ?? "").filter((value) => value !== "")
        : [],
      custom: {
        medusa_product_id: product.id,
        ...(variant ? { medusa_variant_id: variant.id } : {}),
        ...(product.handle ? { medusa_handle: product.handle } : {}),
        ...(product.status ? { medusa_status: product.status } : {}),
        ...(product.metadata ?? {}),
      },
    };

    return {
      ref: this.buildRef(product, variant),
      data,
      assets,
      // `updated_at` est l'empreinte que Medusa entretient deja : la demander
      // coute zero requete de plus et attrape ce que le payload ne voit pas,
      // comme une image remplacee derriere une URL inchangee.
      fingerprint: `${product.updated_at ?? ""}|${variant?.updated_at ?? ""}`,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  private buildName(product: MedusaProduct, variant: MedusaVariant | null): string {
    const title = product.title ?? product.handle ?? product.id;
    if (this.options.variants !== "all" || !variant?.title) return title;
    if (/^default variant$/i.test(variant.title) || variant.title === title) return title;
    return `${title} — ${variant.title}`;
  }

  private buildRef(product: MedusaProduct, variant: MedusaVariant | null): string {
    if (variant?.sku) return variant.sku;
    const base = product.handle ?? product.id;
    return this.options.variants === "all" && variant ? `${base}--${variant.id}` : base;
  }

  private buildUrl(product: MedusaProduct): string | null {
    if (!this.options.storeUrl || !product.handle) return null;
    return `${this.options.storeUrl.replace(/\/+$/, "")}/products/${product.handle}`;
  }

  private buildBrand(product: MedusaProduct): string | null {
    switch (this.options.brandFrom) {
      case "collection":
        return product.collection?.title ?? null;
      case "type":
        return product.type?.value ?? null;
      case "metadata":
        return scalar(product.metadata?.[this.options.brandMetadataKey]);
      default:
        return null;
    }
  }

  /**
   * Le prix, et la seule chose qui compte ici : sortir une CHAINE a separateur
   * point, non formatee. Le Studio formate lui-meme avec Intl d'apres la locale,
   * ce qui garantit le meme rendu depuis le web et depuis un cron.
   */
  private buildPrice(
    variant: MedusaVariant | null,
    warnings: string[]
  ): CollectedData["product"]["price"] | null {
    if (!variant) return null;
    const currency = this.options.currency.toLowerCase();

    if (this.options.mode === "store") {
      const calculated = variant.calculated_price;
      if (calculated?.calculated_amount === undefined) {
        warnings.push("prix calcule absent — verifier --region-id");
        return null;
      }
      return {
        amount: this.scale(calculated.calculated_amount),
        currency: (calculated.currency_code ?? currency).toUpperCase(),
        ...(calculated.is_calculated_price_tax_inclusive !== undefined
          ? { tax_included: calculated.is_calculated_price_tax_inclusive }
          : {}),
      };
    }

    const match = (variant.prices ?? []).find(
      (price) => (price.currency_code ?? "").toLowerCase() === currency
    );
    const amount = match === undefined ? undefined : this.scale(match.amount);
    if (amount === undefined) {
      warnings.push(`aucun prix en ${currency.toUpperCase()} sur la variante ${variant.id}`);
      return null;
    }
    return {
      amount,
      currency: currency.toUpperCase(),
      // Rien n'est affirme par defaut. Un prix d'administration est HT ou TTC
      // selon la configuration de la region, et ecrire `false` au hasard ferait
      // afficher « HT » sur une fiche dont le prix est TTC. Le champ absent
      // laisse le template ne rien dire ; --tax-included le declare.
      ...(this.options.taxIncluded !== undefined ? { tax_included: this.options.taxIncluded } : {}),
    };
  }

  private scale(amount: number | string | undefined): string | undefined {
    const normalized = toAmount(amount);
    if (normalized === undefined) return undefined;
    return this.options.priceScale === "minor"
      ? (Number(normalized) / 100).toFixed(2)
      : normalized;
  }

  private buildFeatures(product: MedusaProduct, variant: MedusaVariant | null): FeatureInput[] {
    const features: FeatureInput[] = [];
    const titles = new Map((product.options ?? []).map((option) => [option.id, option.title ?? ""]));

    if (this.options.featuresFrom.includes("options")) {
      for (const value of variant?.options ?? []) {
        const name = value.option?.title ?? titles.get(value.option_id ?? "") ?? "";
        if (name === "" || !value.value) continue;
        features.push({ name, value: String(value.value) });
      }
    }

    if (this.options.featuresFrom.includes("metadata")) {
      // Les metadonnees Medusa sont libres : seules les valeurs scalaires ont
      // un sens dans un tableau de caracteristiques. Un objet imbrique y
      // sortirait en "[object Object]".
      for (const [key, value] of Object.entries(product.metadata ?? {})) {
        const text = scalar(value);
        if (text === null || key.startsWith("_")) continue;
        features.push({ name: key, value: text });
      }
    }
    return features;
  }

  private async buildImages(
    product: MedusaProduct,
    assets: CollectedAsset[]
  ): Promise<{ images: ImageInput[]; imageWarnings: string[] }> {
    const imageWarnings: string[] = [];
    const urls = [...(product.images ?? [])]
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .map((image) => image.url)
      .filter((url): url is string => typeof url === "string" && url !== "");

    // La vignette n'est pas toujours dans `images` : sans ce rattrapage, une
    // fiche peut sortir sans sa photo principale alors qu'elle existe.
    if (product.thumbnail && !urls.includes(product.thumbnail)) urls.unshift(product.thumbnail);

    if (!this.options.downloadImages) {
      return { images: urls.map((url) => ({ src: url })), imageWarnings };
    }

    const images: ImageInput[] = [];
    for (const [index, url] of urls.entries()) {
      try {
        const asset = await attachUrl(url, `img-${index}`, this.fetchImpl);
        assets.push(asset);
        images.push({ src: `asset://${asset.key}` });
      } catch (cause) {
        imageWarnings.push(cause instanceof Error ? cause.message : String(cause));
      }
    }
    return { images, imageWarnings };
  }

  // --- Transport ------------------------------------------------------------

  private async request<T>(path: string, query: Record<string, string | string[]>): Promise<T> {
    const url = new URL(`${this.base}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        // Medusa attend la forme repetee pour un filtre multi-valeurs.
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, value);
      }
    }

    let response = await this.fetchImpl(url, {
      headers: await this.headers(),
      signal: AbortSignal.timeout(60_000),
    });

    if (response.status === 401 && this.usesBasic() && !this.basicBase64) {
      // Bascule vers la forme historique. Documentee, mesurable, et dite au
      // compte rendu : mieux vaut un collecteur qui marche et le signale qu'un
      // 401 que l'integrateur devra deviner.
      this.basicBase64 = true;
      this.notes.push("cle d'administration acceptee seulement en base64 (serveur anterieur a v2 ?)");
      response = await this.fetchImpl(url, {
        headers: await this.headers(),
        signal: AbortSignal.timeout(60_000),
      });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Medusa ${response.status} sur ${path} — ${body.slice(0, 300) || response.statusText}`
      );
    }
    return (await response.json()) as T;
  }

  private usesBasic(): boolean {
    return this.options.mode === "admin" && !this.bearer && Boolean(this.options.secretKey);
  }

  private async headers(): Promise<Record<string, string>> {
    if (this.options.mode === "store") {
      return {
        accept: "application/json",
        ...(this.options.publishableKey
          ? { "x-publishable-api-key": this.options.publishableKey }
          : {}),
      };
    }

    if (!this.bearer && this.options.email && this.options.password) {
      this.bearer = await this.login(this.options.email, this.options.password);
    }
    if (this.bearer) {
      return { accept: "application/json", authorization: `Bearer ${this.bearer}` };
    }
    if (this.options.secretKey) {
      const token = this.basicBase64
        ? Buffer.from(this.options.secretKey, "utf8").toString("base64")
        : this.options.secretKey;
      return { accept: "application/json", authorization: `Basic ${token}` };
    }
    throw new Error(
      "authentification Medusa absente : --medusa-key (sk_...), --medusa-jwt, ou --medusa-email et --medusa-password"
    );
  }

  private async login(email: string, password: string): Promise<string> {
    const response = await this.fetchImpl(`${this.base}/auth/user/emailpass`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`authentification Medusa refusee (${response.status}) pour ${email}`);
    }
    const body = (await response.json()) as { token?: string };
    if (!body.token) throw new Error("authentification Medusa : reponse sans jeton");
    return body.token;
  }
}

/** Une metadonnee libre n'est exploitable que si elle est scalaire. */
function scalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}
