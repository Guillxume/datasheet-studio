import { authenticate } from "@/lib/auth";
import { renderLimiter } from "@/lib/renderQueue";
import { env } from "@/lib/env";
import { renderRequestSchema, type RenderRequest } from "@/lib/payload";
import { renderToPdf } from "@/lib/render";
import { logRender, resolveTemplate } from "@/lib/templates";
import { AUTO_TEMPLATE, resolveForProduct, type ResolutionSource } from "@/lib/templateRulesStore";
import { safeFilename, type Asset, type AssetBag } from "@/lib/assets";
import { GotenbergError } from "@/lib/gotenberg";
import { warningsHeaders } from "@/lib/renderWarnings";
import { capRequestBody } from "@/lib/bodyLimit";
import { indexedRefs, productKeyOf, usableUrl } from "@/lib/datasheets";
import { recordDatasheet } from "@/lib/datasheetsStore";

/**
 * POST /api/v1/render
 *
 * Deux formes de corps acceptees :
 *
 *   multipart/form-data  champ "payload" (JSON) + champs "asset[<cle>]"
 *                        Pour les boutiques dont les medias sont des chemins
 *                        locaux, non joignables depuis le Studio.
 *
 *   application/json     payload seul, les images etant des URLs publiques.
 *                        Cas d'une boutique servant ses medias sur un CDN.
 *
 * Repond 200 application/pdf, ou une erreur JSON exploitable cote appelant.
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

function fail(status: number, error: string, detail?: unknown) {
  return Response.json({ error, detail }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();

  const shop = await authenticate(request);
  if (!shop) {
    return fail(401, "Cle API absente ou invalide");
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > env.maxRequestBytes) {
    return fail(413, `Payload trop volumineux (${declared} octets)`);
  }

  // --- Sas de rendu --------------------------------------------------------
  //
  // AVANT de lire le corps, et c'est tout l'interet : une requete en attente n'a
  // encore rien mis en memoire. Lire d'abord puis attendre reviendrait a tenir
  // autant de fois le payload que de requetes en vol — voir src/lib/renderQueue.ts.
  const acquired = await renderLimiter.acquire();
  if (acquired === null) {
    const { active, waiting } = renderLimiter.stats;
    await logRender({
      shopId: shop.id,
      templateId: null,
      version: null,
      productRef: null,
      locale: "fr",
      status: "saturated",
      durationMs: Date.now() - started,
      bytes: null,
      warnings: [],
      error: `file pleine (${active} en cours, ${waiting} en attente)`,
    });

    // 429 et non 503 : la demande est legitime, c'est le rythme qui ne passe pas.
    // La generation en masse cote boutique sait reprendre ou elle s'est arretee.
    return new Response(
      JSON.stringify({
        error: "Moteur de rendu sature, reessayer",
        detail: `${active} rendu(s) en cours, ${waiting} en attente`,
      }),
      {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "5" },
      }
    );
  }

  try {
    return await handle(request, shop, started, acquired.queuedMs);
  } finally {
    acquired.slot.release();
  }
}

async function handle(
  request: Request,
  shop: { id: string; slug: string },
  started: number,
  queuedMs: number
): Promise<Response> {
  // --- Corps de la requete -------------------------------------------------

  let rawPayload: unknown;
  const bag: AssetBag = new Map<string, Asset>();
  const contentType = request.headers.get("content-type") ?? "";
  // Le controle du Content-Length (POST) ne voit pas un envoi « chunked » :
  // celui-ci plafonne la lecture elle-meme. Voir src/lib/bodyLimit.ts.
  const capped = capRequestBody(request, env.maxRequestBytes);

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await capped.request.formData();

      // Tolere les deux formes de part : valeur de champ (ce que produit le
      // module PHP, et `curl -F payload=<fichier.json`) ou fichier joint
      // (`curl -F payload=@fichier.json`). Refuser la seconde ne protegerait
      // de rien et produirait un echec deroutant.
      const payloadField = form.get("payload");
      if (payloadField === null) {
        return fail(400, 'Champ "payload" manquant dans le multipart');
      }
      const payloadText =
        typeof payloadField === "string" ? payloadField : await payloadField.text();
      rawPayload = JSON.parse(payloadText);

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
      rawPayload = await capped.request.json();
    } else {
      return fail(415, `Content-Type non supporte : ${contentType || "absent"}`);
    }
  } catch (cause) {
    if (capped.exceeded()) {
      return fail(413, `Payload trop volumineux (plus de ${env.maxRequestBytes} octets)`);
    }
    return fail(400, "Corps de requete illisible", cause instanceof Error ? cause.message : String(cause));
  }

  const parsed = renderRequestSchema.safeParse(rawPayload);
  if (!parsed.success) {
    // L'arbre d'erreurs zod indique le chemin exact du champ fautif, ce qui
    // rend le diagnostic possible depuis les logs PrestaShop.
    return fail(422, "Payload invalide", parsed.error.issues);
  }
  const payload = parsed.data;
  const productRef = payload.data.product.sku ?? String(payload.data.product.id ?? "");

  // --- Template ------------------------------------------------------------

  /*
   * « template »: "auto" DEMANDE AU STUDIO DE CHOISIR, d'apres les regles de
   * categorie de la boutique (voir src/lib/templateRulesStore.ts).
   *
   * POURQUOI UNE VALEUR RESERVEE ET NON UN CHAMP FACULTATIF. Rendre `template`
   * optionnel aurait ete plus simple pour l'appelant — et c'est precisement le
   * probleme : un module qui OUBLIERAIT de l'envoyer par bug recoit aujourd'hui
   * un 422 explicite ; avec un champ facultatif, il recevrait silencieusement le
   * template par defaut et sortirait une fiche fausse que personne ne
   * remarquerait. Sur un contrat consomme par des modules qu'on ne relit pas,
   * une intention ecrite vaut mieux qu'un defaut silencieux.
   *
   * Le contrat n'a donc PAS bouge : "auto" est une chaine, `template` reste
   * obligatoire, et les appelants existants ne voient aucune difference.
   */
  const categoryPath = payload.data.product.category_path;
  let slug = payload.template;
  let resolvedBy: ResolutionSource = "explicite";

  if (payload.template === AUTO_TEMPLATE) {
    const resolution = await resolveForProduct(shop.id, {
      categoryPath,
      brand: payload.data.product.brand ?? null,
      ref: productRef,
    });

    if (!resolution) {
      await logRender({
        shopId: shop.id,
        templateId: null,
        version: null,
        productRef,
        locale: payload.locale,
        status: "error",
        durationMs: Date.now() - started,
        bytes: null,
        warnings: [],
        error: "aucune regle et aucun template par defaut",
        resolvedBy: "defaut",
        categoryPath,
      });

      return fail(
        409,
        `Aucune regle de template ne correspond a ${categoryPath.join(" > ") || "(sans categorie)"}, ` +
          `et la boutique ${shop.slug} n'a pas de template par defaut.`
      );
    }

    slug = resolution.slug;
    resolvedBy = resolution.by;
  }

  const template = await resolveTemplate(shop.id, slug, payload.version);
  if (!template) {
    /*
     * Le message distingue les deux causes, et il le faut : « le slug que
     * j'ai envoye n'existe pas » et « la regle que quelqu'un a ecrite dans le
     * Studio pointe sur un template supprime » ne se corrigent pas au meme
     * endroit, ni par la meme personne.
     */
    return fail(
      404,
      resolvedBy === "explicite"
        ? `Template introuvable ou non publie : ${slug}`
        : `La regle de template de ${shop.slug} designe « ${slug} », qui est introuvable ou non publie.`
    );
  }

  // --- Rendu ---------------------------------------------------------------

  try {
    const result = await renderToPdf({
      trees: template.trees,
      data: payload.data,
      bag,
      locale: payload.locale,
      title: payload.data.product.name,
      gotenbergUrl: env.gotenbergUrl,
      // La boutique authentifiee, et elle seule : un template ne peut lire que
      // la bibliotheque commune et les assets de CETTE boutique. Sans cela, un
      // template de bibliotheque referencant /assets/<autre-boutique>/logo
      // faisait sortir le logo d'un site sur les fiches de tous les autres.
      shopScope: shop.slug,
    });

    await logRender({
      shopId: shop.id,
      templateId: template.templateId,
      version: template.versionNumber,
      productRef,
      locale: payload.locale,
      status: result.warnings.length > 0 ? "ok_with_warnings" : "ok",
      durationMs: Date.now() - started,
      queuedMs,
      bytes: result.pdf.length,
      warnings: result.warnings,
      error: null,
      /*
       * SUR LE CHEMIN DU SUCCES AUSSI, et c'est meme le seul qui compte pour
       * l'alarme des categories sans regle : une fiche rendue avec le template
       * par defaut REUSSIT. C'est tout le probleme — rien ne signale qu'elle
       * porte le mauvais modele. Ne journaliser la provenance que sur les
       * echecs aurait rendu /journal aveugle a exactement ce qu'il doit montrer.
       */
      resolvedBy,
      categoryPath,
    });

    await indexDatasheet(shop.id, payload, slug, template.versionNumber);

    return new Response(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": String(result.pdf.length),
        "x-template-version": String(template.versionNumber),
        /*
         * LE SLUG RETENU, indispensable des que « auto » existe : le module met
         * les PDF en cache et doit savoir sous quelle cle. Sans cet en-tete, une
         * regle modifiee dans le Studio ne se verrait nulle part cote boutique.
         */
        "x-template-slug": slug,
        "x-template-resolved-by": resolvedBy,
        // Un asset manquant ne fait pas echouer le rendu, mais l'appelant doit
        // pouvoir le voir sans consulter la base du Studio.
        ...warningsHeaders(result.warnings),
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const detail = cause instanceof GotenbergError ? cause.detail : undefined;

    await logRender({
      shopId: shop.id,
      templateId: template.templateId,
      version: template.versionNumber,
      productRef,
      locale: payload.locale,
      status: "error",
      resolvedBy,
      categoryPath,
      durationMs: Date.now() - started,
      queuedMs,
      bytes: null,
      warnings: [],
      error: detail ? `${message} :: ${detail}` : message,
    });

    // 502 plutot que 500 quand c'est Chromium qui a lache : le module distingue
    // ainsi une panne d'infrastructure (a retenter) d'un template casse.
    const status = cause instanceof GotenbergError ? 502 : 500;
    return fail(status, message, detail);
  }
}

/**
 * Range la fiche dans l'index de /consultation.
 *
 * UN ECHEC ICI NE FAIT PAS ECHOUER LE RENDU : la boutique attend son PDF, et il
 * est pret. Un index en retard d'un produit se rattrape au rendu suivant ; une
 * fiche refusee pour une raison qui ne la concerne pas, non.
 */
async function indexDatasheet(
  shopId: string,
  payload: RenderRequest,
  templateSlug: string,
  templateVersion: number
): Promise<void> {
  const product = payload.data.product;
  const productKey = productKeyOf(product);
  if (productKey === null) return;

  try {
    await recordDatasheet({
      shopId,
      productKey,
      locale: payload.locale,
      productId: product.id === undefined || product.id === null ? null : String(product.id),
      productRef: product.sku ?? null,
      productName: product.name,
      datasheetUrl: usableUrl(product.datasheet_url),
      templateSlug,
      templateVersion,
      categoryPath: product.category_path,
      variantSkus: indexedRefs(product.variant_skus),
      supplierSkus: indexedRefs(product.supplier_skus),
    });
  } catch (cause) {
    console.error("index des fiches : ecriture impossible", cause);
  }
}
