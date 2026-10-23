import { requireApi } from "@/lib/guard";
import { MAX_SELECTION, selectionValue, topCategory, usableUrl } from "@/lib/datasheets";
import { indexLocales, supplierRefMatches } from "@/lib/datasheetsStore";
import { MAX_IMPORT_CHARS, importLines, resolveImport, type RefMatch } from "@/lib/bookImport";

/**
 * POST /api/consultation/import — retrouve les fiches d'un texte colle par leurs
 * references fournisseur, pour composer un book sans rien cocher.
 *
 * Corps JSON : { boutique, texte, langue? }. Reponse : le rapport de
 * resolveImport (src/lib/bookImport.ts) — fiches trouvees, references ambigues,
 * fiches sans adresse, lignes sans reference reconnue.
 *
 * LECTURE SEULE, MEME DROIT QUE LA CONSULTATION (datasheets:read) : la route ne
 * rend que ce que la liste montrerait deja, masquages compris.
 *
 * LA LANGUE : a defaut, celle de l'index la plus fournie — une boutique
 * monolingue n'a rien a choisir.
 */

export const dynamic = "force-dynamic";

/** Morceaux cherches en base, au plus : bien au-dela de deux mille lignes de devis. */
const MAX_CANDIDATES = 50_000;

function fail(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApi("datasheets:read");
  if (auth instanceof Response) return auth;

  let body: { boutique?: unknown; texte?: unknown; langue?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Corps JSON illisible.");
  }

  const shop = typeof body.boutique === "string" ? body.boutique.trim() : "";
  const text = typeof body.texte === "string" ? body.texte : "";
  if (shop === "" || text.trim() === "") return fail(422, "boutique et texte sont requis.");
  if (text.length > MAX_IMPORT_CHARS) {
    return fail(413, `Texte trop long : au plus ${MAX_IMPORT_CHARS.toLocaleString("fr-FR")} caractères.`);
  }

  const locales = await indexLocales(shop);
  const wanted = typeof body.langue === "string" ? body.langue.trim() : "";
  const locale = locales.find((item) => item.locale === wanted) ?? locales[0];
  if (!locale) return fail(404, "Aucune fiche connue pour cette boutique.");

  const lines = importLines(text);
  const candidates = [...new Set(lines.flatMap((line) => line.candidates))].slice(0, MAX_CANDIDATES);
  const rows = await supplierRefMatches(shop, locale.locale, candidates);

  const matches: RefMatch[] = rows.map((row) => ({
    ref: row.ref,
    value: selectionValue(row.locale, row.product_key),
    name: row.product_name,
    productId: row.product_id ?? row.product_key,
    category: topCategory(row.category_path),
    locale: row.locale,
    url: usableUrl(row.datasheet_url),
  }));

  return Response.json({
    ok: true,
    locale: locale.locale,
    // Zero : rien a trouver dans cet index, quel que soit le collage.
    indexedWithSupplierRefs: locale.withSupplierRefs,
    max: MAX_SELECTION,
    ...resolveImport(lines, matches),
  });
}
