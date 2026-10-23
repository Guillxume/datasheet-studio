import { cpSync, existsSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";

/**
 * Lance le build `output: standalone` en local.
 *
 * RAISON D'ETRE : la sortie standalone de Next n'embarque PAS .next/static.
 * Lancer `node .next/standalone/server.js` directement donne une application qui
 * repond 200 sur toutes les pages mais 404 sur chaque feuille de style et chaque
 * chunk JavaScript — l'interface s'affiche sans aucun style et l'editeur est
 * inutilisable, sans le moindre message d'erreur.
 *
 * Le Dockerfile fait cette copie (voir infra/config/app/Dockerfile). Ce script
 * l'automatise pour les lancements a la main, afin que l'oubli ne soit plus
 * possible.
 */

// Dans le workspace pnpm, Next trace depuis la racine du depot : le serveur
// atterrit sous .next/standalone/apps/studio, et non a la racine du dossier.
const STANDALONE = [".next/standalone", ".next/standalone/apps/studio"].find((dir) =>
  existsSync(`${dir}/server.js`),
);

if (!STANDALONE) {
  console.error("Aucun build standalone. Lancer d'abord : pnpm build");
  process.exit(1);
}

for (const [from, to] of [
  [".next/static", `${STANDALONE}/.next/static`],
  ["public", `${STANDALONE}/public`],
]) {
  if (!existsSync(from)) continue;
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`copie  ${from} -> ${to}`);
}

// Les variables d'environnement du .env racine sont deja chargees par Next en
// developpement, mais pas par le serveur standalone : on les transmet ici.
if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const child = spawn(process.execPath, ["server.js"], {
  cwd: STANDALONE,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
