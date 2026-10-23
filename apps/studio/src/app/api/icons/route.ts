import { requireApi } from "@/lib/guard";
import { lucideSvg, searchIcons } from "@/lib/icons";

/**
 * GET /api/icons?q=chaise — recherche dans le jeu d'icones integre.
 *
 * Les icones sont dessinees ICI et non dans le navigateur : le jeu complet pese
 * pres d'un megaoctet et n'a pas a partir dans le JavaScript des pages. Le
 * selecteur n'en recoit que la soixantaine qu'il affiche.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireApi("datasheets:read");
  if (auth instanceof Response) return auth;

  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 60);
  const icons = searchIcons(query, 60).map((name) => ({
    ref: `lucide:${name}`,
    name,
    svg: lucideSvg(name, { size: 24 }),
  }));

  return Response.json({ ok: true, icons });
}
