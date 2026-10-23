import { requireApi } from "@/lib/guard";
import { bookPageImage } from "@/lib/bookPagesStore";

/**
 * GET /api/book/pages/image?boutique=…&id=… — l'image d'une page fixe du book,
 * pour les vignettes du generateur et des reglages.
 *
 * Lecture ouverte a qui consulte les fiches ; l'identifiant ne suffit pas, la
 * page doit appartenir a la boutique nommee.
 *
 * PAS DE CSP PROPRE ICI : Next l'ecraserait par la regle generale de
 * next.config.ts (constate pour /assets). Elle n'est pas necessaire : seules des
 * images matricielles, verifiees par leur signature a l'enregistrement (PNG,
 * JPEG, WebP), entrent dans book_pages — jamais un SVG, qui serait un document.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireApi("datasheets:read");
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const page = await bookPageImage(params.get("id") ?? "", params.get("boutique") ?? "");
  if (!page) return new Response("Image introuvable.", { status: 404, headers: { "content-type": "text/plain" } });

  return new Response(new Uint8Array(page.image), {
    headers: {
      "content-type": page.mime,
      "content-length": String(page.image.length),
      "cache-control": "private, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}
