import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { TOC_LINK } from "../src/lib/bookToc";
import { qpdfApplyToc, qpdfAvailable, qpdfMerge, qpdfPageCount } from "../src/lib/qpdf";

/**
 * Le sommaire cliquable, avec le VRAI qpdf (src/lib/qpdf.ts) : ce que seule
 * l'execution peut casser — la fusion qui garde ou jette les liens, la lecture
 * ciblee du JSON, la reecriture acceptee ou non par --update-from-json.
 *
 * Aucun Gotenberg : les PDF d'essai sont ecrits par qpdf lui-meme depuis son
 * JSON. Le sommaire y est une page portant des liens vers les adresses temoins,
 * exactement comme Chromium les ecrit.
 *
 * qpdf est requis (installe dans la tache d'integration de la CI) ; sur un poste
 * qui ne l'a pas, les tests sont sautes en le disant : `brew install qpdf`.
 */

const run = promisify(execFile);
let dir = "";
let present = false;
const ABSENT = "qpdf absent : brew install qpdf";

before(async () => {
  present = await qpdfAvailable();
  dir = await mkdtemp(join(tmpdir(), "sommaire-essai-"));
});
after(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

/** Un PDF de `pages` pages A4 ; la premiere porte un lien temoin vers chacune des pages `links`. */
async function pdf(name: string, pages: number, links: number[] = []): Promise<string> {
  const objects: Record<string, { value: unknown }> = {};
  const pageRefs = Array.from({ length: pages }, (_, index) => `${3 + index} 0 R`);
  const firstAnnot = 3 + pages;
  objects["obj:1 0 R"] = { value: { "/Type": "/Catalog", "/Pages": "2 0 R" } };
  objects["obj:2 0 R"] = { value: { "/Type": "/Pages", "/Kids": pageRefs, "/Count": pages } };
  pageRefs.forEach((ref, index) => {
    const page: Record<string, unknown> = { "/Type": "/Page", "/Parent": "2 0 R", "/MediaBox": [0, 0, 595, 842], "/Resources": {} };
    if (index === 0 && links.length > 0) page["/Annots"] = links.map((_, at) => `${firstAnnot + at} 0 R`);
    objects[`obj:${ref}`] = { value: page };
  });
  links.forEach((target, at) => {
    objects[`obj:${firstAnnot + at} 0 R`] = {
      value: { "/Type": "/Annot", "/Subtype": "/Link", "/Rect": [80, 700 - at * 20, 500, 718 - at * 20], "/A": { "/S": "/URI", "/URI": `u:${TOC_LINK}${target}` } },
    };
  });
  const max = firstAnnot + links.length - 1;
  objects.trailer = { value: { "/Root": "1 0 R", "/Size": max + 1 } };
  const json = join(dir, `${name}.json`);
  const out = join(dir, `${name}.pdf`);
  await writeFile(
    json,
    JSON.stringify({ qpdf: [{ jsonversion: 2, pdfversion: "1.7", pushedinheritedpageresources: false, calledgetallpages: false, maxobjectid: max }, objects] })
  );
  await run("qpdf", ["--warning-exit-0", "--json-input", json, out]);
  return out;
}

async function inspect(path: string) {
  const { stdout } = await run("qpdf", ["--json=2", "--json-key=pages", "--json-key=qpdf", "--json-key=outlines", "--json-stream-data=none", path], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const json = JSON.parse(stdout);
  const objects = json.qpdf[1] as Record<string, { value: Record<string, unknown> }>;
  const pages = (json.pages as { object: string }[]).map((page) => page.object);
  const value = (ref: string) => objects[`obj:${ref}`].value;
  const linkTargets = (index: number) =>
    ((value(pages[index])["/Annots"] as string[] | undefined) ?? []).map((ref) => {
      const annot = value(ref);
      return "/Dest" in annot ? pages.indexOf((annot["/Dest"] as string[])[0]) + 1 : `web:${JSON.stringify(annot["/A"])}`;
    });
  const outline: string[] = [];
  const walk = (items: { title: string; destpageposfrom1: number; kids?: unknown[] }[], depth = 0) =>
    items.forEach((item) => {
      outline.push(`${"  ".repeat(depth)}${item.title} → ${item.destpageposfrom1}`);
      walk((item.kids ?? []) as never, depth + 1);
    });
  walk(json.outlines);
  return { pages, linkTargets, outline, catalog: value((objects.trailer.value as { "/Root": string })["/Root"]) };
}

test("la fusion garde les liens du sommaire, et la retouche en fait des liens internes, avec les signets", async (t) => {
  if (!present) return t.skip(ABSENT);
  // couverture (1) · sommaire (1) · fiche A (2) · fiche B (1) · devis (2) · quatrieme (1)
  const parts = [
    await pdf("couverture", 1),
    await pdf("sommaire", 1, [3, 5, 6]),
    await pdf("fiche-a", 2),
    await pdf("fiche-b", 1),
    await pdf("devis", 2),
    await pdf("quatrieme", 1),
  ];
  assert.equal(await qpdfPageCount(parts[2]), 2);

  const merged = join(dir, "book-assemble.pdf");
  await qpdfMerge(parts, merged);
  const before = await inspect(merged);
  assert.equal(before.pages.length, 8);
  assert.equal(before.linkTargets(1).length, 3, "la fusion qpdf garde les liens");
  assert.ok(before.linkTargets(1).every((target) => String(target).startsWith("web:")));

  const final = join(dir, "book.pdf");
  const { links, broken } = await qpdfApplyToc(merged, final, join(dir, "sommaire-patch.json"), {
    first: 2,
    count: 1,
    outline: [
      { title: "Sommaire", page: 2, level: 0 },
      { title: "Fiche A", page: 3, level: 0 },
      { title: "Fiche B — élément", page: 5, level: 0 },
      { title: "Devis", page: 6, level: 0 },
    ],
  });
  assert.equal(links, 3);
  assert.equal(broken, 0);

  const after = await inspect(final);
  assert.equal(after.pages.length, 8);
  assert.deepEqual(after.linkTargets(1), [3, 5, 6]);
  assert.deepEqual(after.outline, ["Sommaire → 2", "Fiche A → 3", "Fiche B — élément → 5", "Devis → 6"]);
  assert.equal(after.catalog["/PageMode"], "/UseOutlines");
  // Le fichier retouche reste un PDF sain aux yeux de qpdf.
  await run("qpdf", ["--check", final]);
});

test("un sommaire sur plusieurs pages : les liens de chaque page sont reecrits, un lien hors du book est compte", async (t) => {
  if (!present) return t.skip(ABSENT);
  const parts = [await pdf("som-1", 1, [3, 4]), await pdf("som-2", 1, [5, 40]), await pdf("corps", 3)];
  const merged = join(dir, "long-assemble.pdf");
  await qpdfMerge(parts, merged);
  const final = join(dir, "long.pdf");
  const { links, broken } = await qpdfApplyToc(merged, final, join(dir, "long-patch.json"), {
    first: 1,
    count: 2,
    outline: [{ title: "Sommaire", page: 1, level: 0 }],
  });
  assert.equal(links, 3);
  assert.equal(broken, 1, "page 40 : le book n'en a que 5");
  const after = await inspect(final);
  assert.deepEqual(after.linkTargets(0), [3, 4]);
  assert.deepEqual(after.linkTargets(1).slice(0, 1), [5]);
});
