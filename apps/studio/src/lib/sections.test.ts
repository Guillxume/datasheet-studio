import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROLES, capabilitiesOf } from "./roles";
import { SECTIONS, sectionsFor } from "./sections";

/**
 * LA NAVIGATION NE DOIT JAMAIS MENER A UN REFUS.
 *
 * Ce n'est pas un test de securite — les gardes de src/lib/guard.ts revalident
 * chaque page. C'est un test de LOYAUTE de l'interface : un lien affiche qui
 * renvoie sur /acces-refuse apprend a la personne qu'il ne faut pas se fier au
 * menu, et elle ne s'y fiera plus pour rien.
 *
 * Le defaut est facile a livrer et invisible a la relecture : il suffit qu'on
 * ajoute une capacite a une section sans la retirer d'un role, ou qu'on retire
 * une capacite d'un role sans regarder le menu.
 */

const app = join(dirname(fileURLToPath(import.meta.url)), "..", "app");

test("chaque lien affiche est atteignable par le role qui le voit", () => {
  for (const role of ROLES) {
    const accordees = capabilitiesOf(role);
    for (const section of sectionsFor(role)) {
      assert.ok(
        section.needs.some((capability) => accordees.includes(capability)),
        `${role} voit « ${section.label} » sans aucune des capacites ${section.needs.join(", ")}`,
      );
    }
  }
});

test("l'importateur ne voit ni les regles ni l'administration", () => {
  const vues = sectionsFor("importer").map((section) => section.key);
  assert.deepEqual(vues, ["templates", "import", "images", "consultation", "journal", "documentation", "retours"]);
});

test("le commercial ne voit que la consultation et les retours", () => {
  // « Retours » disparait en plus quand la page est desactivee pour l'instance :
  // c'est un etat en base, que ce module pur ne voit pas (voir sections.ts).
  assert.deepEqual(sectionsFor("commercial").map((section) => section.key), ["consultation", "retours"]);
});

test("le super-administrateur voit tout ce qui existe", () => {
  assert.deepEqual(
    sectionsFor("superadmin").map((section) => section.key),
    SECTIONS.map((section) => section.key),
  );
});

/**
 * TOUTE PAGE POSE SON TITRE. Le cadre vient du layout du groupe ; le <h1>,
 * lui, est pose par chaque page. Sans ce test, une page ajoutee plus tard
 * sortirait sans titre — et rien ne le dirait, car elle s'afficherait tres bien.
 */
test("chaque page pose un StudioHead", () => {
  const manquantes: string[] = [];
  const parcourir = (repertoire: string) => {
    for (const entree of readdirSync(repertoire, { withFileTypes: true })) {
      const chemin = join(repertoire, entree.name);
      if (entree.isDirectory()) parcourir(chemin);
      else if (entree.name === "page.tsx") {
        const source = readFileSync(chemin, "utf8");
        /*
         * L'EDITEUR EST LA SEULE EXCEPTION, et elle est voulue : il occupe tout
         * l'ecran avec sa propre barre, et un en-tete impose lui prendrait de la
         * hauteur de canvas sans rien apporter. Voir StudioHead.tsx.
         */
        if (chemin.includes("editor")) continue;
        if (!source.includes("<StudioHead")) manquantes.push(chemin);
      }
    }
  };
  parcourir(app);
  assert.deepEqual(manquantes, []);
});
