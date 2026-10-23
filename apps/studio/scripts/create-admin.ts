import { createHash, randomBytes } from "node:crypto";
import { connect } from "./_env";

/**
 * Cree — ou promeut — un compte administrateur, et affiche son lien d'activation.
 *
 *     pnpm admin prenom.nom@exemple.fr "Prenom Nom"
 *
 * L'AMORCAGE, ET RIEN D'AUTRE. Une instance neuve n'a aucun compte : personne ne
 * peut se connecter, donc personne ne peut inviter. Ce script casse cette
 * boucle, une fois. Ensuite, tout passe par /admin/comptes.
 *
 * IL N'ECRIT PAS DE MOT DE PASSE. Il emet un jeton d'invitation et imprime le
 * lien : le mot de passe est choisi par la personne, dans le navigateur, et ne
 * transite jamais par un terminal ni par l'historique du shell. C'est la meme
 * regle que pour les cles API — rien de reversible ne sort d'ici.
 *
 * Relancer le script sur une adresse existante emet un NOUVEAU lien et invalide
 * le precedent : c'est le depannage prevu quand plus personne n'a la main.
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email) {
    console.error('Usage : pnpm admin <courriel> ["Nom affiche"]');
    process.exit(1);
  }

  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
    console.error(`Adresse invalide : ${email}`);
    process.exit(1);
  }

  const sql = connect();

  const users = await sql<{ id: string; role: string }[]>`
    INSERT INTO users (email, name, role)
    VALUES (${normalized}, ${name ?? normalized}, 'admin')
    ON CONFLICT (lower(email)) DO UPDATE
      SET role = 'admin',
          active = true,
          name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
          updated_at = now()
    RETURNING id, role
  `;

  const user = users[0];
  if (!user) {
    console.error("Echec de la creation du compte.");
    process.exit(1);
  }

  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token, "utf8").digest("hex");

  await sql.begin(async (tx) => {
    await tx`UPDATE user_tokens SET used_at = now() WHERE user_id = ${user.id} AND used_at IS NULL`;
    await tx`
      INSERT INTO user_tokens (user_id, kind, token_hash, expires_at)
      VALUES (${user.id}, 'invitation', ${hash}, ${new Date(Date.now() + TTL_MS)})
    `;
  });

  const base = (process.env.STUDIO_PUBLIC_URL ?? process.env.STUDIO_URL ?? "http://localhost:3000")
    .replace(/\/+$/, "");

  console.log(`administrateur ${normalized}`);
  console.log("");
  console.log("  LIEN D'ACTIVATION (valable 7 jours, a usage unique) :");
  console.log(`  ${base}/activation?jeton=${encodeURIComponent(token)}`);
  console.log("");
  console.log("  Emettre a nouveau ce lien invalide le precedent.");

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
