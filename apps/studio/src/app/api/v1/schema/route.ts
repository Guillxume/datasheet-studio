import { authenticate } from "@/lib/auth";
import { VARIABLES, VARIABLE_NOTES } from "@/lib/variables";

/**
 * GET /api/v1/schema
 *
 * Arbre des variables disponibles dans les templates, pour l'aide du
 * back-office PrestaShop.
 *
 * La liste vient de src/lib/variables.ts, partagee avec le panneau « Variables »
 * de l'editeur : les deux doivent decrire exactement le meme contrat.
 */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const shop = await authenticate(request);
  if (!shop) {
    return Response.json({ error: "Cle API absente ou invalide" }, { status: 401 });
  }

  return Response.json({
    variables: VARIABLES.map(({ token, label, kind }) => ({ token, label, kind })),
    notes: VARIABLE_NOTES,
  });
}
