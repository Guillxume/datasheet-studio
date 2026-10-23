import { connect } from "./_env";

/**
 * Designe le super-administrateur, en ligne de commande.
 *
 *     pnpm superadmin prenom.nom@exemple.fr
 *
 * A QUOI CA SERT, PUISQUE LE ROLE SE TRANSMET DEPUIS L'INTERFACE. A deux cas,
 * et ils arrivent tous les deux :
 *
 *   1. le super-administrateur a quitte l'entreprise, perdu son acces, ou n'est
 *      pas joignable. Sans cette commande, plus personne ne peut designer un
 *      remplacant : le role ne se supprime pas et ne se prend pas, il se donne.
 *   2. une instance neuve dont aucun administrateur n'a active son compte : la
 *      migration 007 ne promeut alors personne, deliberement.
 *
 * ELLE EXIGE UN ACCES SSH, et c'est la garantie : le seul moyen de s'attribuer
 * le role le plus puissant du Studio est d'avoir la main sur le serveur. Aucune
 * page, aucun jeton, rien de joignable depuis Internet.
 *
 * Le compte doit EXISTER et avoir ete ACTIVE. Cette commande ne cree rien —
 * `pnpm admin` le fait, et separer les deux gestes evite de donner ce role a
 * une adresse de courriel plutot qu'a une personne.
 */

async function main() {
  const [email] = process.argv.slice(2);
  if (!email) {
    console.error("Usage : pnpm superadmin <courriel>");
    console.error("");
    console.error("Le compte doit exister et avoir active son acces.");
    console.error("Pour creer un compte : pnpm admin <courriel> \"Nom\"");
    process.exit(1);
  }

  const normalized = email.trim().toLowerCase();
  const sql = connect();

  const cibles = await sql<{ id: string; email: string; active: boolean; a_mdp: boolean }[]>`
    SELECT id, email, active, (password_hash IS NOT NULL) AS a_mdp
    FROM users WHERE lower(email) = ${normalized}
  `;

  const cible = cibles[0];
  if (!cible) {
    console.error(`Aucun compte pour ${normalized}.`);
    console.error(`Le creer d'abord : pnpm admin ${normalized} "Nom"`);
    await sql.end();
    process.exit(1);
  }
  if (!cible.active) {
    console.error(`${cible.email} est desactive : le reactiver avant.`);
    await sql.end();
    process.exit(1);
  }
  if (!cible.a_mdp) {
    console.error(`${cible.email} n'a jamais active son acces.`);
    console.error("Confier ce role a une adresse de courriel plutot qu'a une personne");
    console.error("reviendrait a le confier a qui intercepte le lien d'activation.");
    await sql.end();
    process.exit(1);
  }

  const sortants = await sql<{ email: string }[]>`
    SELECT email FROM users WHERE role = 'superadmin'
  `;
  const sortant = sortants[0]?.email ?? null;

  if (sortant === cible.email) {
    console.log(`${cible.email} est deja super-administrateur.`);
    await sql.end();
    return;
  }

  // Retrograder D'ABORD : l'index unique partiel est controle ligne par ligne,
  // pas en fin d'instruction. Voir transferSuperadmin dans src/lib/users.ts.
  await sql.begin(async (tx) => {
    await tx`UPDATE users SET role = 'admin', updated_at = now() WHERE role = 'superadmin'`;
    await tx`UPDATE users SET role = 'superadmin', updated_at = now() WHERE id = ${cible.id}`;
    await tx`
      INSERT INTO audit_log (actor_id, actor_email, action, target, detail)
      VALUES (NULL, 'ligne de commande', 'super.transfere', ${cible.email},
              ${tx.json({ depuis: sortant ?? "personne", par: "npm run superadmin" } as never)})
    `;
  });

  console.log(`super-administrateur : ${cible.email}`);
  if (sortant) {
    console.log(`  ${sortant} redevient administrateur.`);
  }
  console.log("");
  console.log("  Trace ecrite dans le journal des actions, avec la mention");
  console.log("  « ligne de commande » comme auteur — personne ne s'est authentifie.");

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
