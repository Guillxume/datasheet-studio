import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "../src/lib/db";
import { generateApiKey } from "../src/lib/auth";
import {
  createRule,
  defaultTemplateSlug,
  deleteRule,
  listRules,
  resolveForProduct,
  setDefaultTemplate,
} from "../src/lib/templateRulesStore";

/**
 * Les regles de template, sur une VRAIE base.
 *
 * La CORRESPONDANCE est testee sans base (src/lib/templateRules.test.ts et
 * collectors/core/templateRules.test.ts). Ce fichier eprouve ce que seule une
 * base peut casser : la contrainte « au moins un critere », l'isolement entre
 * boutiques, et le fait que la provenance rendue distingue bien une regle d'un
 * defaut — c'est cette distinction que /journal affiche comme alarme.
 *
 * IL NE TRONQUE QUE template_rules, ET CREE SES BOUTIQUES SOUS UN PREFIXE
 * PROPRE. La premiere version tronquait `shops` et `templates` — que
 * multisite.integration.test.ts possede — et `node --test` executant les
 * fichiers EN PARALLELE, elle effacait ses fixtures en pleine course : sept
 * tests d'un autre fichier echouaient, sans rapport apparent avec ce
 * changement. Meme discipline que comptes.integration.test.ts : chaque fichier
 * ne touche qu'a ce qui lui appartient.
 */

/** Prefixe propre a ce fichier : aucune collision avec les autres suites. */
const P = "regles-essai-";

const boutique = new Map<string, string>();

async function creerBoutique(nom: string): Promise<string> {
  const { prefix, hash } = generateApiKey();
  const slug = `${P}${nom}`;
  const rows = await sql<{ id: string }[]>`
    INSERT INTO shops (slug, name, api_key_prefix, api_key_hash)
    VALUES (${slug}, ${slug}, ${prefix}, ${hash})
    RETURNING id
  `;
  boutique.set(nom, rows[0].id);
  return rows[0].id;
}

before(async () => {
  // Les boutiques d'un passage precedent, s'il s'est interrompu. Le CASCADE
  // emporte leurs regles.
  await sql`DELETE FROM shops WHERE slug LIKE ${`${P}%`}`;
  await creerBoutique("boutique-a");
  await creerBoutique("boutique-b");
});

after(async () => {
  await sql`DELETE FROM shops WHERE slug LIKE ${`${P}%`}`;
  await sql.end({ timeout: 5 });
});

/* --------------------------------------------------------------------- */

test("une regle sans aucun critere est refusee", async () => {
  // Elle s'appliquerait a tout, ce qui est le role du template par defaut.
  const resultat = await createRule(boutique.get("boutique-a")!, { template_slug: "fiche-01" });
  assert.ok("error" in resultat);
  assert.match((resultat as { error: string }).error, /sans critere/);
});

test("un tableau vide ne compte pas comme un critere", async () => {
  // `category: []` arrive facilement d'un champ de formulaire laisse vide.
  const resultat = await createRule(boutique.get("boutique-a")!, {
    category: [],
    category_any: [],
    template_slug: "fiche-01",
  });
  assert.ok("error" in resultat);
});

test("une expression reguliere fautive est refusee A LA SAISIE", async () => {
  /*
   * Et non au rendu : compilee dans le moteur, elle ferait echouer chaque fiche
   * du lot avec un message qui ne designe pas la regle coupable.
   */
  const resultat = await createRule(boutique.get("boutique-a")!, {
    ref_pattern: "^RAY-[",
    template_slug: "fiche-01",
  });
  assert.ok("error" in resultat);
  assert.match((resultat as { error: string }).error, /reguliere invalide/);
});

test("la base refuse aussi une regle sans critere, si le code l'oubliait", async () => {
  // La contrainte CHECK de la migration 006 est la ceinture ; createRule est la
  // bretelle. Les deux doivent tenir : une insertion directe doit echouer.
  await assert.rejects(
    () => sql`
      INSERT INTO template_rules (shop_id, template_slug)
      VALUES (${boutique.get("boutique-a")!}, 'fiche-01')
    `,
    /template_rules_au_moins_un_critere/
  );
});

/* --------------------------------------------------------------------- */

test("les regles d'une boutique n'atteignent pas l'autre", async () => {
  const a = boutique.get("boutique-a")!;
  const b = boutique.get("boutique-b")!;

  await createRule(a, { category: ["Manutention"], template_slug: "fiche-a" });
  await setDefaultTemplate(a, "defaut-a");
  await setDefaultTemplate(b, "defaut-b");

  assert.equal((await resolveForProduct(a, { categoryPath: ["Manutention"] }))?.slug, "fiche-a");
  // La meme categorie chez B ne connait pas la regle de A : c'est le point de la
  // decision « pas de regles de bibliotheque commune » (voir la migration 006).
  assert.equal((await resolveForProduct(b, { categoryPath: ["Manutention"] }))?.slug, "defaut-b");

  assert.equal((await listRules(a)).length, 1);
  assert.equal((await listRules(b)).length, 0);
});

test("la provenance distingue une regle d'un defaut", async () => {
  const a = boutique.get("boutique-a")!;

  // C'est cette distinction que /journal affiche comme alarme : une fiche
  // rendue par defaut REUSSIT, et rien d'autre ne signale qu'elle porte
  // peut-etre le mauvais modele.
  assert.equal((await resolveForProduct(a, { categoryPath: ["Manutention"] }))?.by, "regle");
  assert.equal((await resolveForProduct(a, { categoryPath: ["Bureautique"] }))?.by, "defaut");
});

test("une regle qui pointe vers le meme slug que le defaut compte comme une regle", async () => {
  // Elle a bien correspondu : la compter comme « defaut » ferait apparaitre une
  // fausse alarme dans /journal pour une categorie qui est couverte.
  const b = boutique.get("boutique-b")!;
  await createRule(b, { category: ["Sieges"], template_slug: "defaut-b" });

  const resolution = await resolveForProduct(b, { categoryPath: ["Sieges"] });
  assert.equal(resolution?.slug, "defaut-b");
  assert.equal(resolution?.by, "regle");
});

test("sans regle ni defaut, la resolution rend null", async () => {
  const c = await creerBoutique("boutique-nue");
  assert.equal(await resolveForProduct(c, { categoryPath: ["Quoi que ce soit"] }), null);
  assert.equal(await defaultTemplateSlug(c), null);
});

test("le defaut se retire", async () => {
  const c = boutique.get("boutique-nue")!;
  await setDefaultTemplate(c, "fiche-01");
  assert.equal(await defaultTemplateSlug(c), "fiche-01");

  await setDefaultTemplate(c, null);
  assert.equal(await defaultTemplateSlug(c), null);
});

test("une regle ne se supprime que depuis sa propre boutique", async () => {
  const a = boutique.get("boutique-a")!;
  const b = boutique.get("boutique-b")!;

  const cree = await createRule(a, { brand: "Liftmax", template_slug: "fiche-levage" });
  assert.ok(!("error" in cree));
  const id = (cree as { id: string }).id;

  // Meme en connaissant l'identifiant, B ne peut pas toucher a une regle de A.
  await deleteRule(b, id);
  assert.ok((await listRules(a)).some((rule) => rule.id === id), "la regle a ete supprimee par B");

  await deleteRule(a, id);
  assert.ok(!(await listRules(a)).some((rule) => rule.id === id));
});

test("la plus profonde gagne, y compris apres un aller-retour en base", async () => {
  // Le score de specificite est calcule par le moteur ; ce test verifie que les
  // tableaux Postgres reviennent dans le bon ordre et la bonne forme.
  const a = boutique.get("boutique-a")!;
  await createRule(a, { category: ["Manutention", "Transpalettes"], template_slug: "fiche-tp" });

  assert.equal(
    (await resolveForProduct(a, { categoryPath: ["Manutention", "Transpalettes", "Peseurs"] }))?.slug,
    "fiche-tp"
  );
  assert.equal((await resolveForProduct(a, { categoryPath: ["Manutention", "Gerbeurs"] }))?.slug, "fiche-a");
});
