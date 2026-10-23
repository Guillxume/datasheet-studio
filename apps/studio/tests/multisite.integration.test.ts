import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "../src/lib/db";
import { resolveTemplate, listTemplates } from "../src/lib/templates";
import { authenticate, generateApiKey } from "../src/lib/auth";

/**
 * Regles multi-sites, sur une VRAIE base : les migrations du depot, appliquees
 * telles quelles.
 *
 *     npm run test:integration
 *
 * Ce fichier vit dans tests/ et NON dans src/lib/ pour une raison precise :
 * `npm test` ne doit dependre d'aucune infrastructure. Ici il faut un Postgres
 * joignable via DATABASE_URL, et le fichier TRONQUE les tables — donc jamais
 * contre une base qui contient quoi que ce soit d'utile.
 *
 *     DATABASE_URL=postgres://user:pass@127.0.0.1:5433/recette npm run test:integration
 *
 * Pourquoi une base reelle et pas des doublures : tout ce qui est verifie ici
 * est porte par du SQL — l'ordre de masquage, les index partiels, le
 * comportement de NULL. Une doublure reproduirait mon interpretation du SQL,
 * pas le SQL.
 */

const cle = new Map<string, string>();
const boutique = new Map<string, string>();

async function creerBoutique(slug: string, actif = true): Promise<void> {
  const { key, prefix, hash } = generateApiKey();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO shops (slug, name, api_key_prefix, api_key_hash, active)
    VALUES (${slug}, ${slug}, ${prefix}, ${hash}, ${actif})
    RETURNING id
  `;
  boutique.set(slug, rows[0].id);
  cle.set(slug, key);
}

/** Cree un template et ses versions. `publiee` designe le numero a publier. */
async function creerTemplate(
  slug: string,
  shopSlug: string | null,
  versions: number[],
  publiee: number | null,
  marqueur: string,
): Promise<void> {
  const shopId = shopSlug === null ? null : boutique.get(shopSlug)!;
  const t = await sql<{ id: string }[]>`
    INSERT INTO templates (shop_id, slug, name) VALUES (${shopId}, ${slug}, ${slug}) RETURNING id
  `;
  const templateId = t[0].id;

  for (const numero of versions) {
    // Le marqueur voyage dans le corps : il dit quelle portee a repondu.
    const corps = sql.json({ marqueur: `${marqueur}-v${numero}` } as never);
    const v = await sql<{ id: string }[]>`
      INSERT INTO template_versions (template_id, number, body) VALUES (${templateId}, ${numero}, ${corps})
      RETURNING id
    `;
    if (numero === publiee) {
      await sql`UPDATE templates SET published_version_id = ${v[0].id} WHERE id = ${templateId}`;
    }
  }
}

const marqueurDe = (r: Awaited<ReturnType<typeof resolveTemplate>>) =>
  r === null ? null : (r.trees.body as { marqueur: string }).marqueur;

const requete = (clef: string | null) =>
  new Request("https://studio.test/api/v1/render", {
    headers: clef === null ? {} : { authorization: `Bearer ${clef}` },
  });

before(async () => {
  for (const table of ["render_logs", "assets", "template_versions", "templates", "shops"]) {
    await sql.unsafe(`TRUNCATE ${table} CASCADE`);
  }

  await creerBoutique("boutique-a");
  await creerBoutique("boutique-b");
  await creerBoutique("boutique-fermee", false);

  // « fiche » : bibliotheque publiee, et A la surcharge.
  await creerTemplate("fiche", null, [1, 2, 3, 4, 5], 5, "BIBLIO");
  await creerTemplate("fiche", "boutique-a", [1, 2], 2, "A");

  // « brouillon » : bibliotheque publiee, B a une surcharge JAMAIS publiee.
  await creerTemplate("brouillon", null, [1], 1, "BIBLIO");
  await creerTemplate("brouillon", "boutique-b", [1, 2], null, "B");

  // « propre-a-b » : n'existe QUE chez B.
  await creerTemplate("propre-a-b", "boutique-b", [1], 1, "B");

  // « jamais-publie » : existe en bibliotheque, sans version publiee.
  await creerTemplate("jamais-publie", null, [1, 2], null, "BIBLIO");
});

after(async () => {
  await sql.end({ timeout: 5 });
});

/* --------------------------------------------------------------------- */
/* Masquage : la regle centrale du multi-sites                            */
/* --------------------------------------------------------------------- */

test("une surcharge publiee masque la bibliotheque", async () => {
  const r = await resolveTemplate(boutique.get("boutique-a")!, "fiche", "published");
  assert.equal(marqueurDe(r), "A-v2");
});

test("une boutique sans surcharge recoit la bibliotheque", async () => {
  const r = await resolveTemplate(boutique.get("boutique-b")!, "fiche", "published");
  assert.equal(marqueurDe(r), "BIBLIO-v5");
});

test("une surcharge NON publiee ne masque pas : la bibliotheque continue d'etre servie", async () => {
  // Consequence a connaitre : creer une surcharge ne change rien tant qu'elle
  // n'est pas publiee. C'est voulu, mais cela signifie qu'une boutique peut
  // croire avoir bascule alors qu'elle sert encore le modele commun.
  const r = await resolveTemplate(boutique.get("boutique-b")!, "brouillon", "published");
  assert.equal(marqueurDe(r), "BIBLIO-v1");
});

test("un template sans aucune version publiee n'est pas servi", async () => {
  const r = await resolveTemplate(boutique.get("boutique-a")!, "jamais-publie", "published");
  assert.equal(r, null);
});

test("un slug inconnu renvoie null et non une erreur", async () => {
  assert.equal(await resolveTemplate(boutique.get("boutique-a")!, "inexistant", "published"), null);
});

/* --------------------------------------------------------------------- */
/* ISOLATION — ce qu'une boutique ne doit jamais obtenir                   */
/* --------------------------------------------------------------------- */

test("ISOLATION : le template propre a B est invisible depuis A", async () => {
  const r = await resolveTemplate(boutique.get("boutique-a")!, "propre-a-b", "published");
  assert.equal(r, null, "A ne doit pas pouvoir rendre un template appartenant a B");
});

test("ISOLATION : B ne recoit pas la surcharge de A sous le meme slug", async () => {
  const r = await resolveTemplate(boutique.get("boutique-b")!, "fiche", "published");
  assert.notEqual(marqueurDe(r), "A-v2");
});

test("ISOLATION : le listing d'une boutique ne montre que sa portee et la bibliotheque", async () => {
  const vus = (await listTemplates(boutique.get("boutique-a")!)).map((t) => `${t.slug}${t.shared ? "" : "*"}`);
  assert.equal(vus.includes("propre-a-b"), false, "un template de B ne doit pas apparaitre chez A");
});

/* --------------------------------------------------------------------- */
/* Version epinglee — la zone la plus piegeuse                            */
/* --------------------------------------------------------------------- */

test("une version epinglee existant dans la surcharge sert la surcharge", async () => {
  const r = await resolveTemplate(boutique.get("boutique-a")!, "fiche", 2);
  assert.equal(marqueurDe(r), "A-v2");
});

test("une version epinglee absente de la surcharge sert la BIBLIOTHEQUE — decide", async () => {
  // A a surcharge « fiche » (v1, v2) ; la bibliotheque va jusqu'a v5. Demander
  // la v5 depuis A renvoie le contenu de la bibliotheque, et non « introuvable ».
  //
  // ARBITRE LE 14/08/2026 : on sert. Une boutique qui epingle un numero demande
  // une version precise du parc, pas de sa surcharge. Ce test n'est donc plus un
  // constat mais une specification : le changer suppose de changer la decision.
  const r = await resolveTemplate(boutique.get("boutique-a")!, "fiche", 5);
  assert.equal(marqueurDe(r), "BIBLIO-v5");
});

test("une version epinglee NON publiee est servie — decide : c'est le rejeu", async () => {
  // La v2 de la surcharge de B n'a jamais ete publiee. `published` ne la sert
  // pas ; un numero explicite, si.
  //
  // ARBITRE LE 14/08/2026 : fonctionnalite de rejeu. Reimprimer une fiche a
  // l'identique suppose de pouvoir redemander la version exacte qui avait servi,
  // publiee ou non. Conséquence assumee : un numero de version devine donne
  // acces a un brouillon. Acceptable parce que l'appelant est deja authentifie
  // par sa cle et n'obtient que des versions de SA portee ou de la bibliotheque.
  const r = await resolveTemplate(boutique.get("boutique-b")!, "brouillon", 2);
  assert.equal(marqueurDe(r), "B-v2");
});

test("une version inexistante renvoie null", async () => {
  assert.equal(await resolveTemplate(boutique.get("boutique-a")!, "fiche", 99), null);
});

/* --------------------------------------------------------------------- */
/* Authentification par boutique                                          */
/* --------------------------------------------------------------------- */

test("chaque cle resout SA boutique et aucune autre", async () => {
  for (const slug of ["boutique-a", "boutique-b"]) {
    const shop = await authenticate(requete(cle.get(slug)!));
    assert.equal(shop?.slug, slug);
  }
});

test("une boutique desactivee est refusee meme avec une cle valide", async () => {
  assert.equal(await authenticate(requete(cle.get("boutique-fermee")!)), null);
});

test("une cle absente, malformee ou inconnue est refusee", async () => {
  assert.equal(await authenticate(requete(null)), null);
  assert.equal(await authenticate(requete("nimporte-quoi")), null);
  assert.equal(await authenticate(requete(generateApiKey().key)), null, "cle bien formee mais jamais emise");
});

test("la cle n'est pas stockee en clair", async () => {
  const clef = cle.get("boutique-a")!;
  const lignes = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM shops WHERE api_key_hash = ${clef}`;
  assert.equal(lignes[0].n, "0");
});

/* --------------------------------------------------------------------- */
/* Contraintes de portee en base                                          */
/* --------------------------------------------------------------------- */

test("deux templates de bibliotheque ne peuvent pas partager un slug", async () => {
  // NULL n'etant jamais egal a NULL, un UNIQUE(shop_id, slug) laisserait passer
  // le doublon. Ce test verrouille l'index partiel de 001.
  await assert.rejects(() => creerTemplate("fiche", null, [1], 1, "DOUBLON"));
});

test("une boutique ne peut pas avoir deux templates de meme slug", async () => {
  await assert.rejects(() => creerTemplate("fiche", "boutique-a", [1], 1, "DOUBLON"));
});

test("deux boutiques PEUVENT avoir le meme slug, c'est le principe", async () => {
  await creerTemplate("fiche", "boutique-b", [1], 1, "B");
  const r = await resolveTemplate(boutique.get("boutique-b")!, "fiche", "published");
  assert.equal(marqueurDe(r), "B-v1");
});

test("deux assets de bibliotheque ne peuvent pas partager une cle", async () => {
  const inserer = () => sql`
    INSERT INTO assets (shop_id, key, filename, mime, bytes, sha256, data)
    VALUES (NULL, 'logo', 'logo.png', 'image/png', 1, 'x', '\\x00'::bytea)
  `;
  await inserer();
  await assert.rejects(inserer, "l'index partiel de 002 doit rejeter le doublon");
});

test("deux boutiques peuvent avoir un asset de meme cle, isole", async () => {
  for (const slug of ["boutique-a", "boutique-b"]) {
    await sql`
      INSERT INTO assets (shop_id, key, filename, mime, bytes, sha256, data)
      VALUES (${boutique.get(slug)!}, 'logo', 'logo.png', 'image/png', 1, ${slug}, '\\x00'::bytea)
    `;
  }
  const rows = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM assets WHERE key = 'logo'`;
  assert.equal(rows[0].n, "3", "un logo de bibliotheque + un par boutique");
});
