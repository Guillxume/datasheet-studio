import { sql } from "@/lib/db";

/**
 * GET /api/health — l'etat du service, en une requete sans authentification.
 *
 * A QUOI CA SERT, PRECISEMENT. Le deploiement (voir .github/workflows/deploy.yml)
 * a besoin de savoir si la version qu'il vient de mettre en ligne repond, et
 * `docker compose ps` ne le dit pas : un conteneur « running » dont l'URL de base
 * est fausse reste running. Cette route est le seul controle qui traverse
 * reellement l'application ET la base.
 *
 * CE QU'ELLE NE DIT PAS, deliberement : ni version, ni nom d'hote, ni detail
 * d'erreur. Elle est ouverte a tous — c'est necessaire pour qu'une sonde
 * externe l'atteigne — donc elle ne doit rien apprendre a personne. Le
 * diagnostic se lit dans les journaux du conteneur, pas ici.
 *
 * GOTENBERG N'EST PAS TESTE ICI. Le joindre demanderait une conversion, donc un
 * Chromium, a chaque appel de sonde : une sonde toutes les trente secondes
 * consommerait une place du sas de rendu en permanence. Une panne de Gotenberg
 * se voit dans /journal, ou elle est deja comptee.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await sql`SELECT 1`;
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
