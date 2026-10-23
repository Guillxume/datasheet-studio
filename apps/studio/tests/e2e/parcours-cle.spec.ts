import { test, expect, type Page } from "@playwright/test";
import { MOT_DE_PASSE_E2E } from "./comptes";

/**
 * LE PARCOURS QUE L'EQUIPE MARKETING PRENDRA EN PREMIER, contre une VRAIE
 * instance (base migree, Gotenberg joignable) — pas une doublure. Trois roles,
 * parce que ce sont les trois paliers de permissions reellement distincts
 * (voir src/lib/sections.ts, verrouille par sections.test.ts) :
 *
 *   importateur   le plus restreint : bibliotheque, apercu, journal.
 *   editeur       compose les templates : ouvre l'editeur.
 *   administrateur  voit aussi l'administration.
 *
 * CE QUE CE FICHIER AURAIT ATTRAPE. En verifiant manuellement cette session,
 * le formulaire de connexion contre un serveur de developpement (webpack en
 * tache de fond) laissait son bouton desactive au-dela du delai raisonnable —
 * un defaut de connexion invisible a `npm test` (aucune infrastructure) et
 * aux tests unitaires (aucun navigateur). Aucun test ne le protegeait avant
 * celui-ci.
 *
 * CE QU'IL N'ATTRAPE PAS : la composition dans l'editeur (glisser-deposer sur
 * le canevas Puck). Automatiser cette interaction est un chantier a part,
 * plus fragile qu'utile pour un PREMIER filet — ce fichier confirme que
 * l'editeur S'OUVRE, pas qu'on peut y composer une fiche.
 */

async function connecter(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.waitForLoadState("networkidle");

  // Le formulaire est un composant client : le bouton reste desactive jusqu'a
  // l'hydratation. Une seule attente suffit d'ordinaire ; ce court sondage
  // absorbe le cas ou elle prend plus longtemps (machine chargee, CI lente).
  for (let essai = 0; essai < 20; essai += 1) {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', MOT_DE_PASSE_E2E);
    if (await page.isEnabled('button[type="submit"]')) break;
    await page.waitForTimeout(250);
  }

  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"), { timeout: 15_000 });
}

async function sortir(page: Page): Promise<void> {
  // « Sortir » est dans le menu utilisateur du cadre (UserMenu du design
  // system partage) : on l'ouvre, puis on choisit l'entree.
  await page.getByRole("button", { name: "Menu utilisateur" }).click();
  await page.getByRole("menuitem", { name: "Sortir" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/connexion"), { timeout: 15_000 });
}

// La barre laterale du cadre (AppSidebar du design system partage).
const sections = (page: Page) => page.locator('[data-slot="sidebar-content"]');

test("importateur : bibliotheque, apercu d'un rendu, journal", async ({ page }) => {
  await connecter(page, "e2e.importateur@exemple.test");

  await expect(page.locator("h1")).toHaveText("Bibliothèque de templates");
  // Le menu ne doit jamais mener a un refus : voir src/lib/sections.test.ts.
  await expect(sections(page)).not.toContainText("Règles");
  await expect(sections(page)).not.toContainText("Administration");

  /*
   * L'apercu declenche un VRAI rendu Gotenberg — le chemin de bout en bout,
   * pas une simulation. On verifie la REPONSE RESEAU et non l'onglet que le
   * bouton ouvre : Chromium affiche un blob: PDF avec son lecteur natif, dont
   * Playwright ne peut pas lire l'URL (page.url() reste vide indefiniment,
   * meme le rendu reussi — limitation connue, pas un defaut de l'application).
   * La reponse HTTP est le signal exact de ce qui compte : Gotenberg a-t-il
   * produit un PDF.
   */
  const [reponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/editor/preview") && res.request().method() === "POST"),
    page.getByRole("button", { name: "Aperçu" }).first().click(),
  ]);
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()["content-type"]).toBe("application/pdf");
  // Le poids plutot que le corps : la page consomme deja la reponse par
  // `fetch().then((r) => r.blob())` (voir TemplateRowActions.tsx), et
  // reponse.body() la relit vide une fois consommee cote client. L'en-tete
  // content-length, lui, vient du reseau et ne depend pas de cette course.
  expect(Number(reponse.headers()["content-length"])).toBeGreaterThan(1000);

  await sections(page).getByRole("link", { name: "Journal" }).click();
  await expect(page.locator("h1")).toHaveText("Journal des rendus");

  await sortir(page);
});

test("editeur : voit les regles, ouvre l'editeur d'un template", async ({ page }) => {
  await connecter(page, "e2e.editeur@exemple.test");

  await expect(sections(page)).toContainText("Règles");
  await expect(sections(page)).not.toContainText("Administration");

  await page.getByRole("link", { name: "Éditer" }).first().click();
  // La barre de l'editeur affiche l'identifiant complet du template ouvert.
  await expect(page.locator("body")).toContainText("fiche-technique-01", { timeout: 15_000 });

  /*
   * PAS DE "Sortir" ICI : l'editeur n'a pas le cadre du Studio, par
   * conception — il occupe tout l'ecran avec sa propre barre (src/app/editor
   * est hors du groupe (studio)). On revient a l'accueil, qui en a une, pour eprouver aussi le
   * chemin de retour et la deconnexion depuis la ou elles existent vraiment.
   */
  await page.goto("/");
  await sortir(page);
});

test("commercial : arrive sur la consultation, n'a que les retours en plus", async ({ page }) => {
  // La suite par defaut apres connexion est l'accueil, qui exige templates:read :
  // sans sa redirection (src/app/(studio)/page.tsx), le commercial tomberait sur
  // /acces-refuse des sa premiere connexion.
  await connecter(page, "e2e.commercial@exemple.test");
  await expect(page).toHaveURL(/\/consultation/);

  // « Retours » n'apparait que si la page est activee pour l'instance — elle ne
  // l'est pas ici (reglage par defaut) : seule la consultation est listee.
  await expect(sections(page).getByRole("link")).toHaveText(["Consultation"]);

  // La page des retours lui est ouverte (feedback:send), meme desactivee : elle
  // le dit au lieu de renvoyer vers « acces refuse ».
  await page.goto("/retours");
  await expect(page).toHaveURL(/\/retours/);

  await page.goto("/consultation/book");
  await expect(page).toHaveURL(/\/consultation\/book/);

  // Le menu le masque ; la garde le refuse quand meme.
  await page.goto("/import");
  await expect(page).toHaveURL(/\/acces-refuse/);
  await page.goto("/consultation/book/reglages");
  await expect(page).toHaveURL(/\/acces-refuse/);

  await page.goto("/consultation");
  await sortir(page);
});

test("administrateur : voit et ouvre l'administration", async ({ page }) => {
  await connecter(page, "e2e.admin@exemple.test");

  await expect(sections(page)).toContainText("Administration");

  await sections(page).getByRole("link", { name: "Administration" }).click();
  await expect(page.locator("h1")).toHaveText("Administration");

  await sortir(page);
});
