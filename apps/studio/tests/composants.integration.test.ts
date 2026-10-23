import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "../src/lib/db";
import { generateApiKey } from "../src/lib/auth";
import { createTemplate, getDraft, publishDraft, saveDraft } from "../src/lib/repository";
import { listTemplates, resolveTemplate } from "../src/lib/templates";
import {
  applicationTargets,
  applyComponentToZone,
  dependentsOf,
  republishDependents,
  templatesCiting,
} from "../src/lib/componentStore";

/**
 * Les composants reutilisables, sur une VRAIE base.
 *
 * Le depliage est teste sans base (src/lib/components.test.ts). Ce fichier
 * eprouve ce que porte le SQL : la portee (le composant d'une boutique masque
 * celui de la bibliotheque), le filtre qui empeche un composant d'etre servi
 * comme template, la recherche des templates qui citent un composant
 * (jsonb_path_exists), et la republication qui doit garder un brouillon en cours.
 *
 * Templates et composants de BIBLIOTHEQUE sont crees sous un prefixe propre et
 * supprimes a la fin ; rien d'autre n'est touche.
 */

const P = "composants-essai-";
let shopA = "";
let shopB = "";

const page = (content: unknown[]) => ({ content: [{ type: "Page", props: { id: "p", content } }] });
const text = (id: string, content: string) => ({ type: "Text", props: { id, content } });
const ref = (id: string, component: string) => ({ type: "Composant", props: { id, component } });
const trees = (body: unknown, footer: unknown = null) => ({ body, header: null, footer, css: null, settings: {} });

async function boutique(nom: string): Promise<string> {
  const { prefix, hash } = generateApiKey();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO shops (slug, name, api_key_prefix, api_key_hash) VALUES (${P + nom}, ${P + nom}, ${prefix}, ${hash}) RETURNING id
  `;
  return rows[0].id;
}

async function cree(slug: string, shop: string | null, kind: "template" | "component", body: unknown, footer: unknown = null) {
  const created = await createTemplate(P + slug, slug, shop === null ? null : P + shop, kind);
  assert.ok("id" in created, JSON.stringify(created));
  await saveDraft(created.id, trees(body, footer));
  await publishDraft(created.id);
  return created.id;
}

const footerText = async (shopId: string, slug: string) => {
  const resolved = await resolveTemplate(shopId, P + slug, "published");
  const footer = resolved?.trees.footer as { content: { props: { content?: string } }[] } | null;
  return (footer?.content ?? []).map((node) => node.props.content ?? "").join(" | ");
};

let piedCommun = "";
let piedBoutiqueA = "";
let fiche = "";

before(async () => {
  await sql`DELETE FROM templates WHERE slug LIKE ${P + "%"}`;
  await sql`DELETE FROM shops WHERE slug LIKE ${P + "%"}`;
  shopA = await boutique("a");
  shopB = await boutique("b");

  piedCommun = await cree("pied", null, "component", page([text("t", "Pied commun")]));
  piedBoutiqueA = await cree("pied", "a", "component", page([text("t", "Pied de la boutique A")]));
  fiche = await cree("fiche", null, "template", page([text("c", "Corps")]), { content: [ref("r", P + "pied")] });
});

after(async () => {
  await sql`DELETE FROM templates WHERE slug LIKE ${P + "%"}`;
  await sql`DELETE FROM shops WHERE slug LIKE ${P + "%"}`;
  await sql.end({ timeout: 5 });
});

test("au rendu, le bloc Composant est deplie, et le composant de la boutique masque celui de la bibliotheque", async () => {
  assert.equal(await footerText(shopA, "fiche"), "Pied de la boutique A");
  assert.equal(await footerText(shopB, "fiche"), "Pied commun");
});

test("un composant n'est jamais servi comme template a une boutique", async () => {
  assert.equal(await resolveTemplate(shopB, P + "pied", "published"), null);
  const slugs = (await listTemplates(shopB)).map((row) => row.slug);
  assert.ok(slugs.includes(P + "fiche"));
  assert.ok(!slugs.includes(P + "pied"));
});

test("les dependants d'un composant sont les templates dont la version publiee le cite", async () => {
  assert.deepEqual((await dependentsOf(piedCommun)).map((row) => row.slug), [P + "fiche"]);
  // Le composant de la boutique A est deplie dans le template commun pour A :
  // le publier change aussi ses fiches.
  assert.deepEqual((await dependentsOf(piedBoutiqueA)).map((row) => row.slug), [P + "fiche"]);
});

test("republier les dependants bouge leur version publiee et garde le brouillon en cours", async () => {
  // Un brouillon non publie sur le template : une modification en cours.
  await saveDraft(fiche, trees(page([text("c", "Corps modifie, pas encore publie")]), { content: [ref("r", P + "pied")] }));
  const avant = await sql<{ published: number; latest: number }[]>`
    SELECT (SELECT number FROM template_versions WHERE id = t.published_version_id) AS published,
           (SELECT max(number) FROM template_versions WHERE template_id = t.id) AS latest
    FROM templates t WHERE t.id = ${fiche}
  `;

  const republished = await republishDependents(piedCommun, "Pied");
  assert.deepEqual(republished.map((row) => row.slug), [P + "fiche"]);

  const apres = await sql<{ published: number; note: string | null; latest: number }[]>`
    SELECT pv.number AS published, pv.note,
           (SELECT max(number) FROM template_versions WHERE template_id = t.id) AS latest
    FROM templates t JOIN template_versions pv ON pv.id = t.published_version_id
    WHERE t.id = ${fiche}
  `;
  // La version publiee a change : les boutiques regenereront.
  assert.ok(apres[0].published > avant[0].published);
  assert.match(apres[0].note ?? "", /composant « Pied »/);

  // Le brouillon en cours est toujours le brouillon, et toujours le meme contenu.
  assert.ok(apres[0].latest > apres[0].published);
  const draft = await getDraft(fiche);
  assert.match(JSON.stringify(draft.body), /pas encore publie/);

  // La version republiee porte le contenu PUBLIE, pas le brouillon.
  assert.doesNotMatch(await footerText(shopB, "fiche"), /modifie/);
  const publie = await resolveTemplate(shopB, P + "fiche", "published");
  assert.doesNotMatch(JSON.stringify(publie?.trees.body), /pas encore publie/);
});

test("un composant cite par un template (publie ou brouillon) ne peut pas etre supprime", async () => {
  assert.deepEqual((await templatesCiting(piedCommun)).map((row) => row.slug), [P + "fiche"]);
  const orphelin = await cree("orphelin", null, "component", page([text("o", "Personne ne me cite")]));
  assert.deepEqual(await templatesCiting(orphelin), []);
});

test("un composant d'une boutique n'est pas vu par les templates d'une autre", async () => {
  const ficheB = await cree("fiche-b", "b", "template", page([text("c", "B")]), { content: [ref("r", P + "pied")] });
  // Le composant de A ne concerne pas un template propre a B.
  assert.ok(!(await dependentsOf(piedBoutiqueA)).some((row) => row.id === ficheB));
  assert.equal(await footerText(shopB, "fiche-b"), "Pied commun");
});

/*
 * « Appliquer… » : remplacer l'en-tete ou le pied de plusieurs templates par un
 * composant. Ce qui est verrouille : la portee des cibles, et SURTOUT que la
 * publication demandee ne livre jamais un brouillon qui attendait.
 */
const nosCibles = async (componentId: string) =>
  (await applicationTargets(componentId)).map((row) => row.slug).filter((slug) => slug.startsWith(P));

test("appliquer : un composant de bibliotheque vise tous les templates, un composant de boutique les siens", async () => {
  await cree("fiche-a", "a", "template", page([text("c", "A")]), { content: [text("f", "Pied fait main")] });
  const communs = await nosCibles(piedCommun);
  assert.ok(communs.includes(P + "fiche") && communs.includes(P + "fiche-a"), communs.join(", "));
  assert.deepEqual(await nosCibles(piedBoutiqueA), [P + "fiche-a"]);
});

test("appliquer : zone remplacee en brouillon, publiee seulement si le template etait a jour", async () => {
  const piedFaitMain = { content: [text("f", "Pied fait main")] };
  const aJour = await cree("a-jour", null, "template", page([text("c", "x")]), piedFaitMain);
  const enCours = await cree("en-cours", null, "template", page([text("c", "x")]), piedFaitMain);
  await saveDraft(enCours, trees(page([text("c", "modif en cours")]), piedFaitMain));

  const outcomes = await applyComponentToZone(piedCommun, "footer", [aJour, enCours], true);
  assert.deepEqual(
    outcomes.map((item) => [item.slug, item.outcome]).sort(),
    [
      [P + "a-jour", "publish"],
      [P + "en-cours", "pending-draft"],
    ]
  );

  // A jour : publie, et le pied deplie est desormais le composant.
  assert.equal(await footerText(shopB, "a-jour"), "Pied commun");

  // Brouillon en cours : la version publiee n'a pas bouge ; le brouillon cite le
  // composant ET garde la modification qui attendait.
  assert.equal(await footerText(shopB, "en-cours"), "Pied fait main");
  const draft = await getDraft(enCours);
  assert.match(JSON.stringify(draft.body), /modif en cours/);
  assert.match(JSON.stringify(draft.footer), new RegExp(`"component":"${P}pied"`));

  // Reappliquer ne fait rien ; un template hors de portee est ignore.
  assert.equal((await applyComponentToZone(piedCommun, "footer", [aJour], true))[0].outcome, "unchanged");
  assert.deepEqual(await applyComponentToZone(piedBoutiqueA, "footer", [aJour], false), []);
});
