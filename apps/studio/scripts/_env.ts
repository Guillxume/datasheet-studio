import { existsSync } from "node:fs";
import postgres from "postgres";

/**
 * Les scripts sont lances hors du runtime Next, qui charge .env tout seul.
 * process.loadEnvFile est disponible a partir de Node 20.12 / 21.7.
 */
export function loadEnv(): void {
  // UNIQUEMENT le .env racine. un .env de docker compose et pointe sur
  // les noms de service Docker ("db", "gotenberg"), qui ne resolvent pas depuis
  // l'hote. loadEnvFile n'ecrasant pas une variable deja definie, charger les
  // deux ferait silencieusement gagner la configuration Docker.
  if (existsSync(".env") && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env");
  }
}

export function connect() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL absent. Copier .env.dist vers .env.");
    process.exit(1);
  }
  return postgres(url, { max: 2, onnotice: () => {} });
}
