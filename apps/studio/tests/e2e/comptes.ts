import { loadEnv } from "../../scripts/_env";

/**
 * Amorce quatre comptes actives pour le parcours de bout en bout — un par
 * palier de permissions reellement distinct (voir src/lib/sections.ts) :
 * importateur (le plus restreint), editeur (compose les templates),
 * administrateur (voit aussi l'administration), et commercial (consultation,
 * book et retours, rien d'autre).
 *
 *     npx tsx tests/e2e/comptes.ts
 *
 * PAR APPEL DIRECT A consumeTokenAndSetPassword, ET NON PAR LE FORMULAIRE
 * D'INVITATION. Le circuit reel (inviter -> courriel -> activer) suppose un
 * relais SMTP ; le reproduire en CI pour de simples comptes de test ajouterait
 * un service et une source de flakiness sans rien prouver que
 * tests/comptes.integration.test.ts ne prouve deja pour ce circuit-la. Ce
 * script n'a qu'un but : des identifiants qui fonctionnent.
 *
 * MOT DE PASSE FIXE ET PARTAGE ENTRE LES COMPTES. Sans consequence : la
 * base est jetable (CI) ou locale, jamais exposee. consumeTokenAndSetPassword
 * ne verifie pas les fuites connues (voir src/lib/pwnedPassword.ts) — ce
 * controle vit dans /api/auth, pas dans la fonction elle-meme.
 */

export const MOT_DE_PASSE_E2E = "essai-e2e-un-mot-de-passe-suffisant";

const COMPTES = [
  { email: "e2e.importateur@exemple.test", name: "E2E Importateur", role: "importer" },
  { email: "e2e.editeur@exemple.test", name: "E2E Editeur", role: "editor" },
  { email: "e2e.admin@exemple.test", name: "E2E Administrateur", role: "admin" },
  { email: "e2e.commercial@exemple.test", name: "E2E Commercial", role: "commercial" },
] as const;

async function main(): Promise<void> {
  loadEnv();

  const { sql } = await import("../../src/lib/db");
  const { createUser, issueToken, consumeTokenAndSetPassword } = await import("../../src/lib/users");

  for (const { email, name, role } of COMPTES) {
    await sql`DELETE FROM users WHERE email = ${email}`;

    const cree = await createUser({ email, name, role, createdBy: null });
    if ("error" in cree) throw new Error(`${email} : ${cree.error}`);

    const jeton = await issueToken(cree.user.id, "invitation");
    const pose = await consumeTokenAndSetPassword(jeton.token, MOT_DE_PASSE_E2E);
    if ("error" in pose) throw new Error(`${email} : ${pose.error}`);

    console.log(`  ${email}  (${role})`);
  }

  await sql.end();
}

// Execute seulement en ligne de commande, pas quand le spec importe MOT_DE_PASSE_E2E.
if (process.argv[1]?.endsWith("comptes.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
