import { createHash, randomBytes } from "node:crypto";
import { connect } from "./_env";

/**
 * Emet (ou fait tourner) la cle API d'une boutique.
 *
 *   pnpm issue-key <slug-boutique> ["Nom affiche"]
 *
 * La cle n'est affichee qu'ici : seul son sha256 est conserve en base. Faire
 * tourner une cle invalide immediatement l'ancienne.
 */

async function main() {
  const [slug, name] = process.argv.slice(2);
  if (!slug) {
    console.error('Usage : pnpm issue-key <slug-boutique> ["Nom affiche"]');
    process.exit(1);
  }

  const sql = connect();

  const prefix = randomBytes(6).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const key = `sk_${prefix}_${secret}`;
  const hash = createHash("sha256").update(key, "utf8").digest("hex");

  const rows = await sql<{ id: string }[]>`
    INSERT INTO shops (slug, name, api_key_prefix, api_key_hash, webhook_secret)
    VALUES (${slug}, ${name ?? slug}, ${prefix}, ${hash}, ${randomBytes(24).toString("hex")})
    ON CONFLICT (slug) DO UPDATE
      SET api_key_prefix = EXCLUDED.api_key_prefix,
          api_key_hash   = EXCLUDED.api_key_hash,
          name           = COALESCE(NULLIF(EXCLUDED.name, ''), shops.name)
    RETURNING id
  `;

  if (!rows[0]) {
    console.error(`Echec sur la boutique ${slug}`);
    process.exit(1);
  }

  console.log(`boutique ${slug}`);
  console.log("");
  console.log("  CLE API (affichee une seule fois) :");
  console.log(`  ${key}`);
  console.log("");
  console.log("  A reporter dans la configuration du module acmedatasheet.");

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
