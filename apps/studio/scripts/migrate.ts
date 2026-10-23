import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { connect } from "./_env";

/**
 * Migrations SQL numerotees, appliquees dans l'ordre lexicographique et
 * enregistrees dans schema_migrations. Idempotent : relancer ne rejoue rien.
 */

const DIR = join(process.cwd(), "db", "migrations");

async function main() {
  const sql = connect();

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((row) => row.name)
  );

  const files = readdirSync(DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const statements = readFileSync(join(DIR, file), "utf8");
    // Une transaction par fichier : une migration echouee ne laisse pas de
    // schema a moitie applique.
    await sql.begin(async (tx) => {
      await tx.unsafe(statements);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });

    console.log(`applique  ${file}`);
    count += 1;
  }

  console.log(count === 0 ? "schema deja a jour" : `${count} migration(s) appliquee(s)`);
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
