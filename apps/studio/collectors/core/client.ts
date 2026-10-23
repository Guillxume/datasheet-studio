import type { RenderRequest } from "@/lib/payload";
import type { CollectedAsset } from "./types";
import { decodeWarningsHeader } from "@/lib/renderWarnings";

/**
 * Client HTTP du Studio.
 *
 * Il porte tout ce que le §3 de docs/integrer-un-connecteur.md decrit comme
 * indispensable et qu'aucune source n'a envie de reecrire : l'authentification,
 * le choix JSON/multipart, la lecture des deux en-tetes de reponse, et surtout
 * la distinction entre une erreur a retenter (429, 502) et une erreur a
 * corriger (401, 415, 422, 404, 413).
 *
 * Cette distinction est le coeur d'une generation en masse correcte : sans
 * elle, une saturation passagere du moteur se confond avec un template casse,
 * et l'une se rejoue quand l'autre demande une correction.
 */

export type TemplateInfo = {
  slug: string;
  name: string;
  shared: boolean;
  published_version: number | null;
  selectable: boolean;
  updated_at?: string;
};

export type RenderResult = {
  pdf: Buffer;
  /**
   * Version REELLEMENT utilisee. A stocker : comparee plus tard au
   * `published_version` de GET /api/v1/templates, c'est la seule chose qui
   * revele qu'un template a ete republie et que la fiche est perimee.
   */
  templateVersion: number;
  /** Assets introuvables, notamment. Le rendu a reussi malgre tout. */
  warnings: string[];
  bytes: number;
  durationMs: number;
};

export class StudioError extends Error {
  readonly status: number;
  readonly detail: unknown;
  /** 429 et 502 : l'infrastructure, pas le payload. Tout le reste se corrige. */
  readonly retryable: boolean;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "StudioError";
    this.status = status;
    this.detail = detail;
    this.retryable = status === 429 || status === 502 || status === 0;
  }

  /** Ce qu'on ecrit dans le journal : lisible sans deplier un arbre zod. */
  describe(): string {
    if (this.status === 422 && Array.isArray(this.detail)) {
      const issues = (this.detail as Array<{ path?: unknown[]; message?: string }>)
        .slice(0, 5)
        .map((issue) => `${(issue.path ?? []).join(".") || "(racine)"} : ${issue.message ?? "?"}`);
      return `422 payload invalide — ${issues.join(" ; ")}`;
    }
    const detail = typeof this.detail === "string" && this.detail !== "" ? ` — ${this.detail}` : "";
    return `${this.status || "reseau"} ${this.message}${detail}`;
  }
}

export type StudioClientOptions = {
  url: string;
  key: string;
  /** Retentatives sur 429/502/panne reseau. 0 desactive. */
  retries?: number;
  timeoutMs?: number;
  /** Garde-fou local, miroir de MAX_REQUEST_BYTES cote Studio. */
  maxRequestBytes?: number;
  /** Injectes par les tests : sans eux, eprouver un retry couterait son attente. */
  fetchImpl?: typeof fetch;
  waitImpl?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, waitMs: number, error: StudioError) => void;
};

const DEFAULT_MAX_REQUEST_BYTES = 32 * 1024 * 1024;

export class StudioClient {
  private readonly url: string;
  private readonly key: string;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly maxRequestBytes: number;
  private readonly fetchImpl: typeof fetch;
  private readonly waitImpl: (ms: number) => Promise<void>;
  private readonly onRetry: ((attempt: number, waitMs: number, error: StudioError) => void) | undefined;

  constructor(options: StudioClientOptions) {
    this.url = options.url.replace(/\/+$/, "");
    this.key = options.key;
    this.retries = options.retries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.waitImpl = options.waitImpl ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.onRetry = options.onRetry;
  }

  /**
   * Les templates de la boutique ET ceux de la bibliotheque commune.
   * Appele une fois par passage : c'est la reference de fraicheur des versions.
   */
  async templates(): Promise<TemplateInfo[]> {
    const response = await this.send("/api/v1/templates", { method: "GET" });
    if (!response.ok) {
      throw await this.toError(response);
    }
    const body = (await response.json()) as { templates?: TemplateInfo[] };
    return body.templates ?? [];
  }

  /** L'arbre des variables utilisables dans les templates. Aide au diagnostic. */
  async schema(): Promise<unknown> {
    const response = await this.send("/api/v1/schema", { method: "GET" });
    if (!response.ok) {
      throw await this.toError(response);
    }
    return response.json();
  }

  async render(payload: RenderRequest, assets: readonly CollectedAsset[] = []): Promise<RenderResult> {
    const body = this.buildBody(payload, assets);
    const started = Date.now();

    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.send("/api/v1/render", {
          method: "POST",
          headers: body.headers,
          body: body.make(),
        });
      } catch (cause) {
        // Panne reseau, DNS, timeout : status 0, donc rejouable. Un Studio
        // redemarre pendant une generation de nuit ne doit pas mettre au rebut
        // les milliers de fiches restantes.
        const error = new StudioError(0, cause instanceof Error ? cause.message : String(cause));
        if (attempt >= this.retries) throw error;
        await this.backoff(attempt, error, null);
        continue;
      }

      if (response.ok) {
        const pdf = Buffer.from(await response.arrayBuffer());
        return {
          pdf,
          templateVersion: Number(response.headers.get("x-template-version") ?? 0),
          warnings: decodeWarningsHeader(response.headers.get("x-render-warnings")),
          bytes: pdf.length,
          durationMs: Date.now() - started,
        };
      }

      const error = await this.toError(response);
      if (!error.retryable || attempt >= this.retries) {
        throw error;
      }
      await this.backoff(attempt, error, response.headers.get("retry-after"));
    }
  }

  /**
   * JSON quand tout est sur des URLs publiques, multipart des qu'un fichier est
   * joint. Envoyer un multipart a vide marcherait, mais il est plus couteux et
   * plus difficile a rejouer a la main.
   *
   * Le corps est refabrique a CHAQUE tentative : un FormData consomme n'est pas
   * rejouable, et un retry sur un corps deja lu echouerait d'une facon
   * particulierement obscure.
   */
  private buildBody(payload: RenderRequest, assets: readonly CollectedAsset[]) {
    const json = JSON.stringify(payload);

    if (assets.length === 0) {
      this.guardSize(json.length, assets);
      return {
        headers: { "content-type": "application/json" },
        make: () => json,
      };
    }

    const total = json.length + assets.reduce((sum, asset) => sum + asset.bytes.length, 0);
    this.guardSize(total, assets);

    return {
      headers: {} as Record<string, string>, // fetch pose le boundary lui-meme
      make: () => {
        const form = new FormData();
        form.set("payload", json);
        for (const asset of assets) {
          form.set(
            `asset[${asset.key}]`,
            new Blob([new Uint8Array(asset.bytes)], { type: asset.mime }),
            filenameFor(asset)
          );
        }
        return form;
      },
    };
  }

  /**
   * Refuser ici plutot que d'encaisser un 413, parce qu'un 413 n'est PAS
   * rejouable : la fiche irait en quarantaine avec un message qui ne dit pas
   * quelle image est en cause. Ici, on peut la nommer.
   */
  private guardSize(bytes: number, assets: readonly CollectedAsset[]): void {
    if (bytes <= this.maxRequestBytes) return;

    const heaviest = [...assets].sort((a, b) => b.bytes.length - a.bytes.length)[0];
    const detail = heaviest
      ? `piece la plus lourde : ${heaviest.key} (${Math.round(heaviest.bytes.length / 1024)} Ko)`
      : "payload seul";
    throw new StudioError(
      413,
      `Corps de ${Math.round(bytes / 1024)} Ko au-dela de la limite de ${Math.round(this.maxRequestBytes / 1024)} Ko`,
      detail
    );
  }

  private send(path: string, init: RequestInit): Promise<Response> {
    return this.fetchImpl(`${this.url}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.key}`,
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  private async toError(response: Response): Promise<StudioError> {
    let message = response.statusText || "erreur";
    let detail: unknown;
    try {
      const body = (await response.json()) as { error?: string; detail?: unknown };
      message = body.error ?? message;
      detail = body.detail;
    } catch {
      // Une erreur d'infrastructure (proxy, Traefik) repond en HTML : le statut
      // reste exploitable, le corps non.
    }
    return new StudioError(response.status, message, detail);
  }

  /**
   * `Retry-After` du Studio quand il est la (5 s sur 429), exponentiel sinon.
   * Suivre l'en-tete plutot que sa propre idee du rythme, c'est laisser le
   * serveur regler le debit : lui seul sait ou en est sa file.
   */
  private async backoff(attempt: number, error: StudioError, retryAfter: string | null): Promise<void> {
    const advertised = Number(retryAfter);
    const waitMs = Number.isFinite(advertised) && advertised > 0
      ? advertised * 1000
      : Math.min(30_000, 1000 * 2 ** attempt);
    this.onRetry?.(attempt + 1, waitMs, error);
    await this.waitImpl(waitMs);
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * Le Studio renomme de toute facon la piece jointe (safeFilename) : ce nom-la
 * ne sert qu'a rendre le multipart lisible dans un tcpdump ou un log de proxy.
 */
function filenameFor(asset: CollectedAsset): string {
  const stem = asset.key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "asset";
  return `${stem}.${EXT_BY_MIME[asset.mime] ?? "bin"}`;
}
