import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_BLOCK, componentContent, componentSlugsIn, expandComponents, type Node } from "./components";

const text = (id: string, content: string): Node => ({ type: "Text", props: { id, content } });
const ref = (id: string, component: string): Node => ({ type: COMPONENT_BLOCK, props: { id, component } });

const pied = [text("t1", "Acme - 01 00 00 00 00"), { type: "Divider", props: { id: "d1" } }];
const resolve = (slug: string) => (slug === "pied-acme" ? pied : null);

test("un bloc Composant est remplace par le contenu du composant, a sa place", () => {
  const footer = { content: [text("a", "avant"), ref("c1", "pied-acme"), text("b", "apres")] };
  const out = expandComponents(footer, resolve);
  assert.deepEqual(
    out.content.map((node) => node.type),
    ["Text", "Text", "Divider", "Text"]
  );
});

test("le depliage atteint les slots, a n'importe quelle profondeur", () => {
  const body = {
    content: [
      { type: "Page", props: { id: "p", content: [{ type: "Columns", props: { id: "col", left: [ref("c1", "pied-acme")], right: [] } }] } },
    ],
  };
  const out = expandComponents(body, resolve);
  const left = ((out.content[0].props!.content as Node[])[0].props!.left) as Node[];
  assert.deepEqual(left.map((node) => node.type), ["Text", "Divider"]);
});

test("un composant place deux fois ne produit pas deux blocs de meme id", () => {
  const out = expandComponents({ content: [ref("x", "pied-acme"), ref("y", "pied-acme")] }, resolve);
  const ids = out.content.map((node) => node.props!.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["x/t1", "x/d1", "y/t1", "y/d1"]);
});

test("un composant introuvable disparait sans faire echouer le rendu", () => {
  const out = expandComponents({ content: [text("a", "a"), ref("c", "supprime")] }, resolve);
  assert.deepEqual(out.content.map((node) => node.props!.id), ["a"]);
});

test("pas de composant dans un composant : pas de boucle possible", () => {
  // Deux composants qui se citent : sans la regle, le depliage ne finirait pas.
  const cyclique = (slug: string): Node[] | null =>
    slug === "a" ? [text("ta", "A"), ref("rb", "b")] : slug === "b" ? [text("tb", "B"), ref("ra", "a")] : null;
  const out = expandComponents({ content: [ref("r", "a")] }, cyclique);
  assert.deepEqual(out.content.map((node) => node.type), ["Text"]);
});

test("les arbres charges ne sont jamais modifies", () => {
  const footer = { content: [ref("c1", "pied-acme")] };
  const avant = JSON.stringify(footer);
  expandComponents(footer, resolve);
  assert.equal(JSON.stringify(footer), avant);
  assert.equal(pied[0].props!.id, "t1");
});

test("les tableaux qui ne sont pas des blocs sont laisses tels quels", () => {
  // Les regles d'un bloc (mapping de pictos…) sont des tableaux d'objets sans `type`.
  const node = { type: "HighlightRow", props: { id: "h", mapping: [{ badge: "garantie:5", label: "Garantie" }] } };
  const out = expandComponents({ content: [node] }, resolve);
  assert.deepEqual(out.content[0], node);
});

test("les composants cites sont collectes partout, sans doublon", () => {
  const trees = {
    body: { content: [{ type: "Page", props: { id: "p", content: [ref("a", "bandeau")] } }] },
    footer: { content: [ref("b", "pied-acme"), ref("c", "pied-acme")] },
  };
  assert.deepEqual([...componentSlugsIn(trees)].sort(), ["bandeau", "pied-acme"]);
});

test("le contenu d'un composant est pris dans ses pages", () => {
  const body = { content: [{ type: "Page", props: { id: "p", content: pied } }] };
  assert.deepEqual(componentContent(body).map((node) => node.type), ["Text", "Divider"]);
  assert.deepEqual(componentContent({ content: pied }).map((node) => node.type), ["Text", "Divider"]);
  assert.deepEqual(componentContent(null), []);
});
