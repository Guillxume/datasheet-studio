import { z } from "zod";
import { safeFilename, type Asset, type AssetBag } from "@/lib/assets";
import { env } from "@/lib/env";
import { GotenbergError } from "@/lib/gotenberg";
import { requireApi } from "@/lib/guard";
import { warningsHeaders } from "@/lib/renderWarnings";
import { renderDataSchema } from "@/lib/payload";
import { getDraft, getPublished, getTemplateBySlug } from "@/lib/repository";
import { expandTreesForShop, shopIdOf } from "@/lib/componentStore";
import { renderToPdf, type TemplateTrees } from "@/lib/render";
import { renderLimiter } from "@/lib/renderQueue";
import { logRender } from "@/lib/templates";

/**
 * POST /api/editor/render — une fiche, avec des donnees fournies a la main.
 *
 * C'est la brique de la page d'import (src/app/import) : le navigateur rend le
 * lot fiche par fiche et assemble le ZIP. Une requete = une fiche, donc jamais
 * de requete longue a faire traverser le reverse proxy, une progression reelle
 * a l'ecran, et une annulation qui prend effet tout de suite.
 *
 * TROIS ROUTES DE RENDU, ET ELLES NE SE RECOUVRENT PAS :
 *
 *   /api/v1/render        production. Authentifiee par cle de boutique, template
 *                         resolu par slug avec masquage bibliotheque/boutique,
 *                         version publiee. C'est le contrat public.
 *   /api/editor/preview   reglage d'un template. Arbre pris A L'ECRAN, donnees
 *                         d'exemple, aucune restriction de portee d'assets.
 *   celle-ci              lot pilote depuis le Studio. Template deja choisi dans
 *                         une liste, donnees reelles, portee d'assets celle de la
 *                         boutique retenue.
 *
 * SOUS /api/editor ET NON /api/v1, pour la meme raison que les autres : le
 * middleware laisse passer /api/v1/* sans session, parce que ces routes portent
 * leur propre cle de boutique. Une route qui rend n'importe quelles donnees avec
 * n'importe quel template placee la serait publique.
 *
 * PERMISSION import:run — c'est bien l'import qui l'appelle, fiche par fiche.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ASSET_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const ASSET_FIELD = /^asset\[(.+)\]$/;

const bodySchema = z.object({
  /** "shared" ou le slug de la boutique proprietaire du template. */
  scope: z.string().min(1).default("shared"),
  slug: z.string().min(1),
  /**
   * Deux valeurs, pas une de plus. Un numero de version fige un rendu ancien —
   * c'est le besoin de /api/v1/render, qui rejoue une fiche archivee ; un lot
   * qu'on lance maintenant part de ce qui est publie, ou de ce qu'on vient de
   * composer sans l'avoir encore publie.
   */
  version: z.union([z.literal("published"), z.literal("draft")]).default("published"),
  locale: z.string().min(2).default("fr"),
  /**
   * Boutique dont la bibliotheque d'images est lisible par ce rendu. Absente,
   * seule la bibliotheque commune l'est — la meme regle qu'en production, et
   * pas celle de l'apercu, qui ne restreint rien.
   */
  shopScope: z.string().optional(),
  data: renderDataSchema,
});

function fail(status: number, error: string, detail?: unknown) {
  return Response.json({ ok: false, error, detail }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();

  // La garde AVANT le sas de rendu : une requete non autorisee ne doit pas
  // occuper une place dans la file, encore moins attendre qu'une se libere.
  const auth = await requireApi("import:run");
  if (auth instanceof Response) return auth;

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > env.maxRequestBytes) {
    return fail(413, `Requete trop volumineuse (${declared} octets)`);
  }

  // Le sas AVANT la lecture du corps : une requete en attente n'a encore rien
  // mis en memoire. Voir src/lib/renderQueue.ts.
  const acquired = await renderLimiter.acquire();
  if (acquired === null) {
    const { active, waiting } = renderLimiter.stats;
    return Response.json(
      {
        ok: false,
        error: "Moteur de rendu sature, reessayer",
        detail: `${active} rendu(s) en cours, ${waiting} en attente`,
      },
      // 429 et non 503 : la page d'import sait attendre et rejouer, comme les
      // collecteurs en ligne de commande.
      { status: 429, headers: { "retry-after": "5" } }
    );
  }

  try {
    return await handle(request, started, acquired.queuedMs);
  } finally {
    acquired.slot.release();
  }
}

async function handle(request: Request, started: number, queuedMs: number): Promise<Response> {
  let raw: unknown;
  const bag: AssetBag = new Map<string, Asset>();
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const payloadField = form.get("payload");
      if (payloadField === null) {
        return fail(400, 'Champ "payload" manquant dans le multipart.');
      }
      raw = JSON.parse(
        typeof payloadField === "string" ? payloadField : await payloadField.text()
      );

      for (const [field, value] of form.entries()) {
        const match = field.match(ASSET_FIELD);
        if (!match || typeof value === "string") continue;

        const key = match[1];
        const mime = value.type || "application/octet-stream";
        if (!ALLOWED_ASSET_MIMES.has(mime)) {
          return fail(415, `Type d'asset refuse pour "${key}" : ${mime}`);
        }
        bag.set(key, {
          key,
          filename: safeFilename(key, mime),
          mime,
          bytes: Buffer.from(await value.arrayBuffer()),
        });
      }
    } else if (contentType.includes("application/json")) {
      raw = await request.json();
    } else {
      return fail(415, `Content-Type non supporte : ${contentType || "absent"}`);
    }
  } catch (cause) {
    return fail(400, "Corps de requete illisible.", cause instanceof Error ? cause.message : String(cause));
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    // Le meme schema que la route de production : un mapping fautif echoue ici
    // exactement comme il echouerait en production, avec le chemin du champ.
    return fail(422, "Payload invalide.", parsed.error.issues);
  }
  const body = parsed.data;

  const template = await getTemplateBySlug(body.slug, body.scope === "shared" ? null : body.scope);
  if (!template) {
    return fail(404, `Template introuvable : ${body.slug} (${body.scope}).`);
  }

  const trees =
    body.version === "draft" ? await getDraft(template.id) : await getPublished(template.id);
  if (trees === null) {
    return fail(409, `Le template ${body.slug} n'a aucune version publiee.`);
  }
  const versionNumber =
    body.version === "draft" ? template.draft_version : template.published_version;

  const productRef = body.data.product.sku ?? String(body.data.product.id ?? "");
  const shopScope = body.shopScope ?? (body.scope === "shared" ? "shared" : body.scope);

  try {
    // Composants deplies pour la boutique dont on rend les fiches : c'est elle
    // qui decide quel pied de page un template commun recoit.
    const expanded = await expandTreesForShop(
      {
        body: trees.body,
        header: trees.header,
        footer: trees.footer,
        css: trees.css,
        geometry: (trees.settings.geometry ?? null) as TemplateTrees["geometry"],
      } as TemplateTrees,
      await shopIdOf(shopScope === "shared" ? null : shopScope)
    );
    const result = await renderToPdf({
      trees: expanded,
      data: body.data,
      bag,
      locale: body.locale,
      title: body.data.product.name,
      gotenbergUrl: env.gotenbergUrl,
      shopScope,
    });

    // Journalise comme un rendu de production, et c'en est un : ces PDF partent
    // dans un catalogue. Le journal repond ensuite aux memes questions — ce qui
    // a rale, ce qui a echoue — sans qu'on ait a garder le ZIP sous la main.
    await logRender({
      shopId: template.shop_id,
      templateId: template.id,
      version: versionNumber,
      productRef,
      locale: body.locale,
      status: result.warnings.length > 0 ? "ok_with_warnings" : "ok",
      durationMs: Date.now() - started,
      queuedMs,
      bytes: result.pdf.length,
      warnings: result.warnings,
      error: null,
    });

    return new Response(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": String(result.pdf.length),
        "cache-control": "no-store",
        ...(versionNumber === null ? {} : { "x-template-version": String(versionNumber) }),
        ...warningsHeaders(result.warnings),
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const detail = cause instanceof GotenbergError ? cause.detail : undefined;

    await logRender({
      shopId: template.shop_id,
      templateId: template.id,
      version: versionNumber,
      productRef,
      locale: body.locale,
      status: "error",
      durationMs: Date.now() - started,
      queuedMs,
      bytes: null,
      warnings: [],
      error: detail ? `${message} :: ${detail}` : message,
    });

    // 502 quand c'est Chromium qui a lache : la page d'import rejoue une panne
    // d'infrastructure, jamais un template casse.
    return fail(cause instanceof GotenbergError ? 502 : 500, message, detail);
  }
}
