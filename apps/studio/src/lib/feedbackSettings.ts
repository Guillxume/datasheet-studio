import { sql } from "./db";

/**
 * Le reglage qui active ou desactive la page /retours, a l'echelle de
 * l'instance. Ligne unique, voir migration 008.
 *
 * SEPARE DE src/lib/roles.ts. La capacite `feedback:send` dit QUI peut
 * envoyer un retour si la fonctionnalite est ouverte ; ce module dit si elle
 * l'est. Les deux se verifient independamment — voir requireApi("feedback:send")
 * puis isFeedbackActive() dans src/app/api/retours/route.ts.
 */

export async function isFeedbackActive(): Promise<boolean> {
  const rows = await sql<{ active: boolean }[]>`
    SELECT active FROM feedback_settings WHERE id
  `;
  return rows[0]?.active ?? false;
}

/**
 * UPSERT, ET NON UN SIMPLE UPDATE. La ligne unique est posée par la migration
 * 008, mais `TRUNCATE users CASCADE` (voir tests/comptes.integration.test.ts)
 * l'emporte avec elle — `feedback_settings.updated_by` référence `users`. Un
 * UPDATE contre une table vide ne toucherait aucune ligne et rendrait « ok »
 * sans que rien n'ait changé ; l'upsert reste correct dans les deux cas.
 */
export async function setFeedbackActive(active: boolean, actorId: string): Promise<void> {
  await sql`
    INSERT INTO feedback_settings (id, active, updated_at, updated_by)
    VALUES (true, ${active}, now(), ${actorId})
    ON CONFLICT (id) DO UPDATE
    SET active = excluded.active, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `;
}
