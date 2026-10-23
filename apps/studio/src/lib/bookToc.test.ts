import { test } from "node:test";
import assert from "node:assert/strict";
import { TOC_LINK, UNTITLED_SECTION, tocHtml, tocLinkTarget, tocLines, tocPage, tocPatch } from "./bookToc";

const SECTIONS = [
  { title: "Bureaux", dividerPages: 1, fiches: [{ title: "Bureau droit", pages: 2 }, { title: "Bureau bench", pages: 1 }] },
  // Intercalaire non imprime : la section commence a sa premiere fiche.
  { title: "Vestiaires", dividerPages: 0, fiches: [{ title: "Vestiaire 2 portes", pages: 1 }] },
  { title: "Vide", dividerPages: 1, fiches: [] },
  { title: null, dividerPages: 0, fiches: [{ title: "Poteau", pages: 3 }] },
];

test("chaque section, chaque fiche et le devis, a leur premiere page — les sections vides n'y sont pas", () => {
  const lines = tocLines(SECTIONS, true);
  assert.deepEqual(
    lines.map((line) => [line.level, line.title, line.offset]),
    [
      [0, "Bureaux", 0],
      [1, "Bureau droit", 1],
      [1, "Bureau bench", 3],
      [0, "Vestiaires", 4],
      [1, "Vestiaire 2 portes", 4],
      [0, UNTITLED_SECTION, 5],
      [1, "Poteau", 5],
      [0, "Devis", 8],
    ]
  );
  // Couverture (1) et sommaire (1) avant le corps : la premiere section est en page 3.
  assert.equal(tocPage(lines[0], 2), 3);
  assert.equal(tocPage(lines[7], 2), 11);
});

test("sans intercalaire, les fiches sont au premier niveau, sans titre de section", () => {
  const lines = tocLines([{ title: null, dividerPages: 0, fiches: [{ title: "A", pages: 1 }, { title: "B", pages: 2 }] }], false);
  assert.deepEqual(
    lines.map((line) => [line.level, line.title, line.offset]),
    [
      [0, "A", 0],
      [0, "B", 1],
    ]
  );
});

test("la page HTML echappe les titres, et chaque ligne pointe vers l'adresse temoin de sa page", () => {
  const html = tocHtml(tocLines([{ title: "Bureaux <b>", dividerPages: 1, fiches: [{ title: "L'armoire & co", pages: 1 }] }], false), 2, "#a8481a");
  assert.match(html, /Bureaux &lt;b&gt;/);
  assert.match(html, /L&#39;armoire &amp; co/);
  assert.ok(html.includes(`href="${TOC_LINK}3"`));
  assert.ok(html.includes(`href="${TOC_LINK}4"`));
  // Une couleur invalide n'entre pas dans le CSS.
  assert.doesNotMatch(tocHtml([], 1, "red;}body{display:none"), /display:none/);
});

test("un lien temoin se reconnait, au format de qpdf ou brut ; le reste non", () => {
  assert.equal(tocLinkTarget(`u:${TOC_LINK}12`), 12);
  assert.equal(tocLinkTarget(`${TOC_LINK}3`), 3);
  assert.equal(tocLinkTarget("u:https://www.acme.example/"), null);
  assert.equal(tocLinkTarget(`u:${TOC_LINK}0`), null);
  assert.equal(tocLinkTarget(`u:${TOC_LINK}abc`), null);
  assert.equal(tocLinkTarget(undefined), null);
});

const PAGES = ["3 0 R", "4 0 R", "6 0 R", "7 0 R", "9 0 R"];
const link = (ref: string, target: number | string) => ({
  ref,
  value: {
    "/Type": "/Annot",
    "/Subtype": "/Link",
    "/Rect": [85, 658, 527, 682],
    "/A": { "/S": "/URI", "/URI": typeof target === "number" ? `u:${TOC_LINK}${target}` : target },
  },
});

test("chaque lien temoin devient un lien interne vers son objet page ; les autres liens ne bougent pas", () => {
  const { patch, links, broken } = tocPatch({
    maxObjectId: 40,
    pages: PAGES,
    root: { ref: "1 0 R", value: { "/Type": "/Catalog", "/Pages": "2 0 R" } },
    annotations: [link("20 0 R", 2), link("21 0 R", 5), link("22 0 R", "u:https://www.acme.example/"), link("23 0 R", 9)],
    outline: [],
  });
  const objects = (patch as { qpdf: [unknown, Record<string, { value: Record<string, unknown> }>] }).qpdf[1];

  assert.equal(links, 2);
  assert.equal(broken, 1, "page 9 : il n'y en a que 5");
  assert.deepEqual(objects["obj:20 0 R"].value["/Dest"], ["4 0 R", "/Fit"]);
  assert.equal("/A" in objects["obj:20 0 R"].value, false);
  assert.deepEqual(objects["obj:20 0 R"].value["/Rect"], [85, 658, 527, 682]);
  assert.deepEqual(objects["obj:21 0 R"].value["/Dest"], ["9 0 R", "/Fit"]);
  assert.equal("obj:22 0 R" in objects, false);
  assert.equal("obj:23 0 R" in objects, false);
  // Sans signet, le catalogue n'est pas touche.
  assert.equal("obj:1 0 R" in objects, false);
});

test("une action rangee a part (objet indirect) est lue aussi", () => {
  const { links } = tocPatch({
    maxObjectId: 40,
    pages: PAGES,
    root: { ref: "1 0 R", value: {} },
    annotations: [{ ref: "20 0 R", value: { "/Subtype": "/Link", "/A": "30 0 R" } }],
    actions: { "30 0 R": { "/S": "/URI", "/URI": `u:${TOC_LINK}3` } },
    outline: [],
  });
  assert.equal(links, 1);
});

test("les signets : un par ligne, fiches sous leur section repliee, nouveaux objets apres le dernier du fichier", () => {
  const { patch } = tocPatch({
    maxObjectId: 40,
    pages: PAGES,
    root: { ref: "1 0 R", value: { "/Type": "/Catalog", "/Pages": "2 0 R" } },
    annotations: [],
    outline: [
      { title: "Sommaire", page: 1, level: 0 },
      { title: "Bureaux", page: 2, level: 0 },
      { title: "Bureau droit", page: 3, level: 1 },
      { title: "Bureau bench", page: 4, level: 1 },
      { title: "Devis", page: 5, level: 0 },
    ],
  });
  const objects = (patch as { qpdf: [unknown, Record<string, { value: Record<string, unknown> }>] }).qpdf[1];

  assert.deepEqual(objects["obj:41 0 R"].value, { "/Type": "/Outlines", "/First": "42 0 R", "/Last": "46 0 R", "/Count": 3 });
  assert.deepEqual(objects["obj:1 0 R"].value, {
    "/Type": "/Catalog",
    "/Pages": "2 0 R",
    "/Outlines": "41 0 R",
    "/PageMode": "/UseOutlines",
  });
  const bureaux = objects["obj:43 0 R"].value;
  assert.equal(bureaux["/Title"], "u:Bureaux");
  assert.equal(bureaux["/Count"], -2, "repliee : compte negatif");
  assert.equal(bureaux["/First"], "44 0 R");
  assert.equal(bureaux["/Last"], "45 0 R");
  assert.equal(bureaux["/Prev"], "42 0 R");
  assert.equal(bureaux["/Next"], "46 0 R");
  assert.equal(objects["obj:44 0 R"].value["/Parent"], "43 0 R");
  assert.equal(objects["obj:45 0 R"].value["/Prev"], "44 0 R");
  assert.deepEqual(objects["obj:46 0 R"].value["/Dest"], ["9 0 R", "/Fit"]);
});
