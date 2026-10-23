import { defineConfig } from "@playwright/test";

/**
 * Le parcours cle du Studio, contre une VRAIE instance (voir tests/e2e/).
 *
 * L'INSTANCE N'EST PAS DEMARREE ICI. En CI (.github/workflows/ci.yml, job
 * "e2e"), un `npm run build` puis un `npm run start:standalone` la lancent
 * avant que Playwright ne s'execute, exactement comme le fait le Dockerfile en
 * production. En local, faire de meme (ou `npm run dev`) et passer BASE_URL si
 * le port differe de 3000.
 *
 * PAS DE `webServer` ICI : Playwright sait demarrer un serveur lui-meme, mais
 * cette instance a besoin d'une base migree, d'un Gotenberg joignable et de
 * comptes amorces (tests/e2e/comptes.ts) — plus qu'une simple commande de
 * demarrage peut exprimer proprement.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
});
