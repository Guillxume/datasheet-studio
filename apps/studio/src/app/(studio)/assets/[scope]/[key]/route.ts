import { readAsset } from "@/lib/assetStore";
import { requireApi } from "@/lib/guard";

/**
 * GET /assets/{scope}/{key}
 *
 * Sert les pictos et logos de la bibliotheque du Studio.
 *
 * UN SEUL CLIENT : le navigateur, dans l'editeur et le gestionnaire d'images.
 *
 * Le commentaire precedent annoncait un second appelant — Chromium, au moment du
 * rendu — et en tirait l'absence d'authentification. Ce n'est plus vrai, et
 * src/lib/env.ts le dit depuis : les pictos sont lus en base et inlines en data
 * URI par src/lib/render.tsx, si bien que Gotenberg n'a jamais besoin de joindre
 * cette application. Il n'y a donc plus aucune raison de laisser la route
 * ouverte, et elle demande desormais une session en lecture d'images.
 */

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ scope: string; key: string }> }
): Promise<Response> {
  const auth = await requireApi("assets:read");
  if (auth instanceof Response) return auth;

  const { scope, key } = await context.params;

  const asset = await readAsset(decodeURIComponent(scope), decodeURIComponent(key));
  if (!asset) {
    return new Response("Asset introuvable.", { status: 404, headers: { "content-type": "text/plain" } });
  }

  // ETag sur le sha256 du contenu : re-televerser sous la meme cle change donc
  // l'ETag, et le picto perime n'est jamais resservi.
  const etag = `"${asset.sha256}"`;
  // `private` ET NON `public` : la reponse exige une session. `public`
  // autorisait un cache partage (proxy d'entreprise, CDN place un jour devant
  // le Studio) a la garder et a la resservir a qui n'est pas connecte (audit du
  // 16/10/2026). Le navigateur, lui, garde son cache : rien ne change pour
  // l'editeur.
  const cacheControl = "private, max-age=300, must-revalidate";

  // Next ne repond PAS 304 tout seul pour une Response construite a la main :
  // sans cette comparaison, Chromium retelecharge chaque picto a chaque rendu
  // des que le max-age est depasse.
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, "cache-control": cacheControl } });
  }

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "content-type": asset.mime,
      "content-length": String(asset.data.length),
      etag,
      "cache-control": cacheControl,
    },
  });
}
