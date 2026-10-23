import { requireApi } from "@/lib/guard";
import { env } from "@/lib/env";
import { ErpQuoteError, fetchErpQuote, normalizeQuoteReference } from "@/lib/erpQuote";
import { shopErpEntities } from "@/lib/shopsAdmin";
import { audit } from "@/lib/users";

/**
 * POST /api/book/devis — le PDF d'un devis de l'ERP, par sa reference.
 *
 * Corps JSON : { boutique, reference }. Reponse : le PDF lui-meme, avec sa
 * reference, sa date, son statut et l'entite ou il a ete trouve en en-tetes. La page du book en fait un
 * fichier, exactement comme s'il avait ete choisi sur le disque : il est
 * controle et place par la composition (src/app/api/book/route.ts), sans
 * chemin particulier.
 *
 * PASSER PAR LA PAGE plutot que laisser la composition aller chercher le devis
 * elle-meme : on VOIT ce qu'on a recupere — reference, date, brouillon ou non —
 * avant de lancer un book de deux cents fiches, et une reference fausse
 * echoue en une seconde au lieu d'apres la composition.
 *
 * MEME DROIT QUE LE BOOK (datasheets:read). La cle du Studio ouvre tous les
 * devis de l'entite : chaque recuperation est donc journalisee — qui, quelle
 * boutique, quel devis.
 */

export const dynamic = "force-dynamic";

function fail(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("datasheets:read");
  if (actor instanceof Response) return actor;

  let body: { boutique?: unknown; reference?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Corps JSON illisible.");
  }
  const shop = typeof body.boutique === "string" ? body.boutique.trim() : "";
  const reference = typeof body.reference === "string" ? normalizeQuoteReference(body.reference) : null;
  if (shop === "" || reference === null) return fail(422, "Boutique et référence de devis valide requises.");

  const erp = env.erp;
  if (!erp) return fail(503, "La récupération des devis depuis l'ERP n'est pas configurée sur ce Studio.");
  const entities = await shopErpEntities(shop);
  if (entities.length === 0) {
    return fail(409, "Entités ERP non renseignées pour cette boutique : à compléter dans Administration › Boutiques.");
  }

  try {
    const quote = await fetchErpQuote({ ...erp, entities }, reference);
    await audit(actor, "book.devis-erp", shop, { reference: quote.ref, entite: quote.entity });
    return new Response(Buffer.from(quote.pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${quote.filename}"`,
        "cache-control": "no-store",
        "x-devis-ref": encodeURIComponent(quote.ref),
        "x-devis-date": quote.date ?? "",
        "x-devis-statut": quote.status === null ? "" : String(quote.status),
        "x-devis-entite": quote.entity,
      },
    });
  } catch (cause) {
    if (cause instanceof ErpQuoteError) return fail(cause.status, cause.message);
    console.error("devis ERP : recuperation impossible", cause);
    return fail(500, "Récupération du devis impossible.");
  }
}
