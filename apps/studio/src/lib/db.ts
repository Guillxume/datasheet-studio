import postgres from "postgres";
import { env } from "./env";

/**
 * postgres.js plutot qu'un ORM : 5 tables pour un outil interne ne justifient
 * pas une etape de generation de client dans le build Docker. Les requetes sont
 * parametrees par defaut via les litteraux tagges.
 */

declare global {
  // `var` et non `let` : dans un bloc `declare global`, seul `var` declare une
  // propriete sur globalThis — ce qui est le but, garder une seule connexion
  // entre deux rechargements a chaud. La directive `eslint-disable no-var` qui
  // vivait ici ne servait plus : la regle ne s'applique pas aux declarations
  // ambiantes, elle etait donc signalee comme inutile.
  var __studioSql: ReturnType<typeof postgres> | undefined;
}

function create() {
  return postgres(env.databaseUrl, {
    max: Number(process.env.DB_POOL_MAX ?? 8),
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// Reutilise la connexion entre les rechargements a chaud en developpement,
// sinon chaque edition de fichier laisse un pool orphelin.
export const sql = global.__studioSql ?? create();
if (process.env.NODE_ENV !== "production") {
  global.__studioSql = sql;
}
