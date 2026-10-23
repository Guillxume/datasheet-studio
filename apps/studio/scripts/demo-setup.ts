import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./_env";

/**
 * Amorce de la DEMONSTRATION locale (docker-compose.yml a la racine du depot).
 *
 * Passe APRES scripts/migrate.ts et scripts/seed.ts, et pose ce qui manque
 * pour qu'une instance neuve se visite sans rien faire a la main :
 *
 *   1. un compte de demonstration, mot de passe CONNU (DEMO_EMAIL /
 *      DEMO_PASSWORD) — le seul ecart a la regle « le mot de passe est choisi
 *      dans le navigateur » (scripts/create-admin.ts), et c'est pour cela que
 *      ce script est a part : il ne sert qu'a une instance locale ;
 *   2. la fiche produit simple et la fiche paysage, dans la bibliotheque, avec
 *      la typographie du Studio — par les scripts d'installation eux-memes,
 *      pour ne rien dupliquer ;
 *   3. la PUBLICATION de ces templates : un template sans version publiee
 *      n'est pas selectionnable par l'API, qui repondrait 404 ;
 *   4. les illustrations de demonstration (scripts/demo/images) dans la
 *      bibliotheque d'images de la boutique, pour que l'editeur les propose.
 *
 * IDEMPOTENT. Un compte existant n'est pas touche (son mot de passe a pu etre
 * change dans le Studio), un template existant n'est pas reinstalle, un
 * template deja publie n'est pas republie.
 */

const STARTER_SLUG = "fiche-paysage";
const SHOP_SLUG = "contoso-equipment";
const DEFAULT_PASSWORD = "studio-demo-2026";

function run(script: string, ...args: string[]): void {
  const result = spawnSync("tsx", [script, ...args], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Echec de ${script} ${args.join(" ")} (code ${result.status ?? result.signal}).`);
  }
}

async function main(): Promise<void> {
  loadEnv();

  const email = (process.env.DEMO_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const password = process.env.DEMO_PASSWORD ?? "";
  if (password.length < 12) {
    throw new Error("DEMO_PASSWORD absent ou trop court (12 caracteres au moins, comme dans le Studio).");
  }

  // Imports dynamiques : src/lib/db.ts lit DATABASE_URL a l'import.
  const { sql } = await import("../src/lib/db");
  const { hashPassword } = await import("../src/lib/password");
  const { getTemplateBySlug, publishDraft } = await import("../src/lib/repository");
  const { putAsset } = await import("../src/lib/assetStore");
  const { SLUG: DEFAULT_SLUG } = await import("./default-template");

  // --- 1. Compte de demonstration -----------------------------------------

  const existing = await sql<{ id: string }[]>`SELECT id FROM users WHERE lower(email) = ${email}`;
  if (existing[0]) {
    console.log(`compte existant     ${email}`);
  } else {
    // Super-administrateur s'il n'y en a pas encore : la demonstration montre
    // alors toute l'administration. Sinon, administrateur.
    const superadmins = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM users WHERE role = 'superadmin'
    `;
    const role = superadmins[0].n === 0 ? "superadmin" : "admin";
    await sql`
      INSERT INTO users (email, name, role, password_hash)
      VALUES (${email}, ${"Compte de démonstration"}, ${role}, ${await hashPassword(password)})
    `;
    console.log(`compte cree         ${email} (${role})`);
  }

  // --- 2. Templates de bibliotheque ---------------------------------------

  if (!(await getTemplateBySlug(DEFAULT_SLUG, null))) {
    run("scripts/install-default-template.ts", "--bibliotheque");
  }
  if (!(await getTemplateBySlug(STARTER_SLUG, null))) {
    run("scripts/install-starter-template.ts", "--slug", STARTER_SLUG);
    run("scripts/install-typography.ts", "--template", STARTER_SLUG);
  }

  // --- 3. Publication -------------------------------------------------------

  for (const slug of [DEFAULT_SLUG, STARTER_SLUG]) {
    const template = await getTemplateBySlug(slug, null);
    if (!template) throw new Error(`Template introuvable apres installation : ${slug}`);
    const rows = await sql<{ published_version_id: string | null }[]>`
      SELECT published_version_id FROM templates WHERE id = ${template.id}
    `;
    if (rows[0]?.published_version_id) {
      console.log(`template publie     ${slug}`);
      continue;
    }
    const version = await publishDraft(template.id);
    console.log(`template publie     ${slug} (v${version})`);
  }

  // --- 4. Bibliotheque d'images de la boutique -----------------------------
  //
  // putAsset fait un upsert : relancer reecrit les memes octets.

  const images = join(process.cwd(), "scripts", "demo", "images");
  const files = readdirSync(images).filter((file) => file.endsWith(".svg"));
  for (const file of files) {
    const key = `contoso-${file.replace(/\.svg$/, "")}`;
    const result = await putAsset(SHOP_SLUG, key, "image/svg+xml", readFileSync(join(images, file)), file);
    if (!result.ok) throw new Error(`Televersement de ${file} refuse : ${result.error}`);
  }
  console.log(`images              ${files.length} illustrations dans la bibliotheque de ${SHOP_SLUG}`);

  const base = (process.env.STUDIO_PUBLIC_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  console.log("");
  console.log("  DEMONSTRATION PRETE");
  console.log(`  Studio        ${base}`);
  // Le mot de passe par defaut est public (docker-compose.yml) : l'afficher ne
  // revele rien. Un mot de passe choisi, lui, ne s'ecrit pas dans les journaux.
  console.log(`  Connexion     ${email} / ${password === DEFAULT_PASSWORD ? password : "(DEMO_PASSWORD)"}`);
  console.log("  Boutique      contoso-equipment, cle API = DEMO_API_KEY");
  console.log("");

  await sql.end();
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
