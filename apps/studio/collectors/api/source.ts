import { attachUrl } from "../core/assets";
import {
  applyTransforms,
  compactArrays,
  getPath,
  getPathMulti,
  isFilled,
  parseExpression,
  setPath,
} from "@/lib/mapping";
import type { CollectedAsset, CollectedProduct, Source } from "../core/types";
import { readSecret, type ApiConfig } from "./config";

/**
 * Collecteur d'API JSON, pilote par un fichier de configuration.
 *
 * C'est le collecteur « pour tout le reste » : un PIM, un ERP, un back-office
 * maison. Il ne connait aucune API en particulier — il sait paginer, lire un
 * champ par son chemin, et le poser au bon endroit du payload.
 *
 * La table `map` se lit dans le sens CIBLE <- SOURCE, comme une affectation :
 *
 *   "product.name":         "libelle",
 *   "product.price.amount": "tarifs.public | minor",
 *   "product.category_path":"familles[].libelle",
 *   "images[].src":         "medias[].url",
 *   "images[].legend":      "medias[].titre",
 *   "features[].name":      "specs[].label",
 *   "features[].value":     "specs[].valeur | string"
 *
 * Les cibles a "[]" sont appariees PAR INDICE : `images[0].legend` recoit le
 * titre du premier media. C'est la seule regle d'appariement qui n'exige rien
 * de la source, et elle correspond a ce que fait n'importe quelle API qui sert
 * des listes paralleles.
 */

type Json = Record<string, unknown>;

export class ApiSource implements Source {
  readonly name: string;
  private readonly config: ApiConfig;
  private readonly fetchImpl: typeof fetch;
  private lastRequestAt = 0;

  constructor(config: ApiConfig, fetchImpl: typeof fetch = globalThis.fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.name = `${config.name} (${config.base_url})`;
  }

  async *list(): AsyncIterable<CollectedProduct> {
    for await (const item of this.items()) {
      const full = this.config.detail ? await this.withDetail(item) : item;
      yield await this.toProduct(full);
    }
  }

  /** Les elements, page apres page, sans jamais materialiser le catalogue. */
  private async *items(): AsyncGenerator<Json> {
    const { pagination } = this.config.list;
    let page = pagination.type === "page" ? pagination.start : 0;
    let offset = 0;
    let cursor: string | null = null;
    let seen = 0;

    for (;;) {
      const query: Record<string, string> = { ...this.config.list.query };
      if (pagination.type === "page") {
        query[pagination.param] = String(page);
        query[pagination.size_param] = String(pagination.size);
      } else if (pagination.type === "offset") {
        query[pagination.param] = String(offset);
        query[pagination.size_param] = String(pagination.size);
      } else if (pagination.type === "cursor") {
        query[pagination.size_param] = String(pagination.size);
        if (cursor !== null) query[pagination.param] = cursor;
      }

      const body = await this.request(this.config.list.path, query);
      const items = this.extractItems(body);
      for (const item of items) yield item;

      seen += items.length;
      if (items.length === 0) return;

      if (pagination.type === "none") return;
      if (pagination.type === "cursor") {
        const next = getPath(body, pagination.next);
        if (next === null || next === undefined || next === "") return;
        cursor = String(next);
        continue;
      }

      const total = pagination.total ? Number(getPath(body, pagination.total)) : NaN;
      if (Number.isFinite(total) && seen >= total) return;
      // Sans total annonce, une page plus courte que demandee marque la fin.
      // C'est aussi le seul garde-fou contre une API qui ignorerait la
      // pagination et resservirait indefiniment la premiere page.
      if (items.length < pagination.size) return;

      if (pagination.type === "page") page += 1;
      else offset += items.length;
    }
  }

  private extractItems(body: unknown): Json[] {
    const raw = this.config.list.items === "" ? body : getPath(body, this.config.list.items);
    if (!Array.isArray(raw)) {
      throw new Error(
        `list.items ("${this.config.list.items}") ne designe pas un tableau dans la reponse de ${this.config.list.path}`
      );
    }
    return raw.filter((item): item is Json => item !== null && typeof item === "object");
  }

  private async withDetail(item: Json): Promise<Json> {
    const detail = this.config.detail!;
    const id = this.read(item, detail.id);
    if (id === undefined || id === null) return item;

    const body = await this.request(detail.path.replace("{id}", encodeURIComponent(String(id))), {});
    const resolved = detail.item === "" ? body : getPath(body, detail.item);
    if (resolved === null || typeof resolved !== "object") return item;

    // La liste reste lisible : certaines API ne servent la categorie ou le
    // prix que dans la liste, et le detail seul perdrait l'information.
    return { ...(resolved as Json), _list: item };
  }

  private async toProduct(item: Json): Promise<CollectedProduct> {
    const data: Json = {};
    const assets: CollectedAsset[] = [];
    const warnings: string[] = [];

    for (const [target, expression] of Object.entries(this.config.map)) {
      // C'est l'EXPRESSION qui dit s'il y a plusieurs valeurs, et la CIBLE qui
      // dit ou les poser. Les quatre combinaisons ont un sens :
      //
      //   familles[].libelle  -> product.category_path   la liste entiere
      //   medias[].url        -> images[].src            un element par indice
      //   marque.nom          -> product.brand           une valeur
      //   schema.url          -> images[].src            le premier element
      const many = expression.includes("[]");
      const spread = target.includes("[]");

      if (many) {
        const values = this.readMany(item, expression);
        if (!spread) {
          const filled = values.filter(isFilled);
          if (filled.length > 0) setPath(data, target, filled);
          continue;
        }
        // On saute les valeurs absentes SANS refermer les trous : les indices
        // font l'appariement entre "medias[].url" et "medias[].legende".
        for (const [index, value] of values.entries()) {
          if (!isFilled(value)) continue;
          setPath(data, target.replace("[]", `.${index}`), value);
        }
        continue;
      }

      const value = this.read(item, expression);
      if (!isFilled(value)) continue;
      setPath(data, spread ? target.replace("[]", ".0") : target, value);
    }

    dropEmptyImages(data);
    compactArrays(data);
    if (this.config.download_images) await this.downloadImages(data, assets, warnings);

    const ref = this.read(item, this.config.ref);
    if (!isFilled(ref)) {
      throw new Error(
        `expression ref ("${this.config.ref}") vide sur un element — le journal ne saurait pas l'identifier`
      );
    }

    const template = this.config.template_from
      ? this.read(item, this.config.template_from)
      : this.config.template;
    const locale = this.config.locale_from
      ? this.read(item, this.config.locale_from)
      : this.config.locale;
    const fingerprint = this.config.fingerprint
      ? this.read(item, this.config.fingerprint)
      : undefined;

    return {
      ref: String(ref),
      data: data as CollectedProduct["data"],
      assets,
      ...(isFilled(template) ? { template: String(template) } : {}),
      ...(isFilled(locale) ? { locale: String(locale) } : {}),
      ...(isFilled(fingerprint) ? { fingerprint: String(fingerprint) } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  private read(item: Json, expression: string): unknown {
    const { path, transforms } = parseExpression(expression);
    return applyTransforms(getPath(item, path), transforms);
  }

  private readMany(item: Json, expression: string): unknown[] {
    const { path, transforms } = parseExpression(expression);
    return getPathMulti(item, path).map((value) => applyTransforms(value, transforms));
  }

  /**
   * Rapatrie les images referencees par URL pour les joindre au multipart.
   * A n'activer que si le Studio ne peut PAS les charger lui-meme : sinon on
   * fait transiter des octets pour rien.
   */
  private async downloadImages(data: Json, assets: CollectedAsset[], warnings: string[]): Promise<void> {
    const targets: Array<{ container: Json; key: string; label: string }> = [];
    const images = data.images;
    if (Array.isArray(images)) {
      images.forEach((image, index) => {
        if (image !== null && typeof image === "object") {
          targets.push({ container: image as Json, key: "src", label: `img-${index}` });
        }
      });
    }
    for (const field of ["schema_image", "qr_code"] as const) {
      const value = data[field];
      if (value !== null && typeof value === "object") {
        targets.push({ container: value as Json, key: "src", label: field.replace("_image", "") });
      }
    }

    for (const target of targets) {
      const url = target.container[target.key];
      if (typeof url !== "string" || !/^https?:/i.test(url)) continue;
      try {
        const asset = await attachUrl(url, target.label, this.fetchImpl);
        assets.push(asset);
        target.container[target.key] = `asset://${asset.key}`;
      } catch (cause) {
        warnings.push(cause instanceof Error ? cause.message : String(cause));
      }
    }
  }

  // --- Transport ------------------------------------------------------------

  private async request(path: string, query: Record<string, string>): Promise<unknown> {
    await this.throttle();

    const url = new URL(path.replace(/^\//, ""), `${this.config.base_url.replace(/\/+$/, "")}/`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    const headers: Record<string, string> = { accept: "application/json", ...this.config.headers };
    const auth = this.config.auth;
    if (auth.type === "bearer") {
      headers.authorization = `Bearer ${readSecret(auth.token_env)}`;
    } else if (auth.type === "basic") {
      const pair = `${readSecret(auth.user_env)}:${readSecret(auth.password_env)}`;
      headers.authorization = `Basic ${Buffer.from(pair, "utf8").toString("base64")}`;
    } else if (auth.type === "header") {
      headers[auth.name] = readSecret(auth.value_env);
    } else if (auth.type === "query") {
      url.searchParams.set(auth.param, readSecret(auth.value_env));
    }

    const response = await this.fetchImpl(url, { headers, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `${this.config.name} ${response.status} sur ${url.pathname} — ${body.slice(0, 300) || response.statusText}`
      );
    }
    return response.json();
  }

  /** Espace les requetes quand l'API limite le debit (rate_limit_ms). */
  private async throttle(): Promise<void> {
    if (this.config.rate_limit_ms === 0) return;
    const wait = this.lastRequestAt + this.config.rate_limit_ms - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
  }
}

/**
 * Une image sans `src` est refusee par le schema. Le cas arrive des qu'une
 * legende est mappee alors que l'URL correspondante manque — et perdre la fiche
 * entiere pour une legende orpheline serait disproportionne.
 */
function dropEmptyImages(data: Json): void {
  if (Array.isArray(data.images)) {
    data.images = data.images.filter(
      (image) => image !== null && typeof image === "object" && isFilled((image as Json).src)
    );
  }
  for (const field of ["schema_image", "qr_code"] as const) {
    const value = data[field];
    if (value !== undefined && (value === null || typeof value !== "object" || !isFilled((value as Json).src))) {
      delete data[field];
    }
  }
}
