import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "../src/lib/db";
import { generateApiKey } from "../src/lib/auth";
import {
  bookPageImage,
  createDivider,
  deleteBookPage,
  listBookPages,
  addCover,
  movePage,
  updatePage,
} from "../src/lib/bookPagesStore";

/**
 * Les pages fixes du book (migration 012), sur une VRAIE base : l'unicite des
 * couvertures (index partiel), le transfert d'une categorie d'un intercalaire a
 * l'autre, l'ordre, et l'isolement entre boutiques — un identifiant de page ne
 * doit jamais suffire a lire ou supprimer la page d'une autre boutique.
 */

const P = "book-essai-";
const png = (marker: string) => ({ mime: "image/png", data: Buffer.from(`\x89PNG\r\n\x1a\n${marker}`, "binary") });

async function boutique(nom: string): Promise<void> {
  const { prefix, hash } = generateApiKey();
  await sql`INSERT INTO shops (slug, name, api_key_prefix, api_key_hash) VALUES (${P + nom}, ${P + nom}, ${prefix}, ${hash})`;
}

before(async () => {
  await sql`DELETE FROM shops WHERE slug LIKE ${P + "%"}`;
  await boutique("a");
  await boutique("b");
});

after(async () => {
  await sql`DELETE FROM shops WHERE slug LIKE ${P + "%"}`;
  await sql.end({ timeout: 5 });
});

test("une boutique garde plusieurs couvertures, nommees et rangees (migration 016)", async () => {
  const salon = await addCover(P + "a", "couverture", { title: "Salon", image: png("v1") });
  const compte = await addCover(P + "a", "couverture", { title: null, image: png("v2") });
  assert.notEqual(salon, compte);
  const covers = (await listBookPages(P + "a")).filter((page) => page.kind === "couverture");
  assert.deepEqual(covers.map((page) => page.id), [salon, compte]);
  assert.match((await bookPageImage(compte!, P + "a"))!.image.toString("binary"), /v2$/);

  // La premiere de la liste est le choix par defaut : on la change en rangeant.
  await movePage(P + "a", compte!, -1);
  const apres = (await listBookPages(P + "a")).filter((page) => page.kind === "couverture");
  assert.deepEqual(apres.map((page) => page.id), [compte, salon]);

  // Nommer une couverture, remplacer son image ; on n'y range aucune categorie.
  assert.ok(await updatePage(P + "a", compte!, { title: "Grand compte", categories: ["Bureaux"], image: png("v3") }));
  const renommee = (await listBookPages(P + "a")).find((page) => page.id === compte)!;
  assert.equal(renommee.title, "Grand compte");
  assert.deepEqual(renommee.categories, []);
  assert.match((await bookPageImage(compte!, P + "a"))!.image.toString("binary"), /v3$/);

  // Retirer la seconde : la suite des tests n'en attend qu'une.
  await deleteBookPage(P + "a", salon!);
});

test("une categorie n'a qu'un intercalaire : l'associer ailleurs la retire de l'ancien", async () => {
  const bureaux = await createDivider(P + "a", { title: "Bureaux", categories: ["Bureaux d'entreprise", "Tables professionnelles"], image: png("b") });
  const tables = await createDivider(P + "a", { title: "Tables", categories: ["Tables professionnelles"], image: png("t") });
  const pages = await listBookPages(P + "a");
  assert.deepEqual(pages.find((page) => page.id === bureaux)!.categories, ["Bureaux d'entreprise"]);
  assert.deepEqual(pages.find((page) => page.id === tables)!.categories, ["Tables professionnelles"]);

  await updatePage(P + "a", bureaux!, { categories: ["Bureaux d'entreprise", "Tables professionnelles"] });
  const apres = await listBookPages(P + "a");
  assert.deepEqual(apres.find((page) => page.id === tables)!.categories, []);
});

test("les intercalaires se reordonnent, les couvertures restent aux extremites", async () => {
  const acoustique = await createDivider(P + "a", { title: "Acoustique", categories: [], image: png("ac") });
  await movePage(P + "a", acoustique!, -1);
  await addCover(P + "a", "quatrieme", { title: null, image: png("q") });
  const order = (await listBookPages(P + "a")).map((page) => page.title ?? page.kind);
  assert.deepEqual(order, ["Grand compte", "Bureaux", "Acoustique", "Tables", "quatrieme"]);
});

test("un intercalaire sans titre est refuse par la base", async () => {
  await assert.rejects(createDivider(P + "a", { title: " ", categories: [], image: png("x") }));
});

test("l'identifiant d'une page ne suffit pas a la lire ou la supprimer depuis une autre boutique", async () => {
  const page = (await listBookPages(P + "a")).find((item) => item.kind === "intercalaire")!;
  assert.equal(await bookPageImage(page.id, P + "b"), null);
  assert.equal(await deleteBookPage(P + "b", page.id), false);
  assert.equal(await updatePage(P + "b", page.id, { title: "Pirate" }), false);
  assert.ok(await bookPageImage(page.id, P + "a"));
});
