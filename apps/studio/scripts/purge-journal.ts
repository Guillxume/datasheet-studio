import { loadEnv } from "./_env";

/**
 * Supprime les lignes perimees des deux tables de telemetrie, jusqu'a epuisement :
 * le journal de rendus (90 jours) et les tentatives de connexion (30 jours).
 *
 *     pnpm purge
 *     RENDER_LOG_RETENTION_DAYS=30 pnpm purge
 *
 * A QUOI IL SERT, PUISQUE LA PAGE PURGE DEJA. La page /journal declenche une
 * purge opportuniste, au plus une fois par heure, et d'un lot a la fois. C'est
 * suffisant en regime etabli. Ca ne l'est pas dans deux cas :
 *
 *   - le PREMIER passage sur une base laissee grossir : il y a des millions de
 *     lignes a retirer, et personne n'ouvrira le journal cinquante fois ;
 *   - une instance dont plus personne ne regarde le journal, ou la purge ne se
 *     declenche donc jamais.
 *
 * D'ou cette commande, a passer en cron sur les grosses installations :
 *
 *     0 4 * * *  cd /chemin/du/depot && docker compose run --rm setup \
 *                  tsx scripts/purge-journal.ts
 */

async function main() {
  loadEnv();

  // Import differe : `src/lib/journal.ts` importe `db.ts`, qui lit DATABASE_URL
  // a l'evaluation du module. Charger l'environnement d'abord, importer ensuite.
  const { purgeRenderLogs, retentionDays } = await import("../src/lib/journal");
  const { purgeLoginAttempts } = await import("../src/lib/users");
  const { sql } = await import("../src/lib/db");

  /** Vide une table par lots, jusqu'a ce qu'elle ne rende plus rien. */
  async function vider(nom: string, lot: () => Promise<number>): Promise<void> {
    let total = 0;
    for (;;) {
      const supprimees = await lot();
      if (supprimees === 0) break;
      total += supprimees;
      console.log(`  ${nom} : ${total} ligne(s)`);
    }
    console.log(total === 0 ? `  ${nom} : rien a purger` : `  ${nom} : ${total} ligne(s) supprimee(s)`);
  }

  const jours = retentionDays();
  console.log(jours === 0 ? "journal de rendus : retention desactivee" : `journal de rendus : ${jours} jours`);
  await vider("render_logs", () => purgeRenderLogs());

  await vider("login_attempts", () => purgeLoginAttempts());

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
