import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canGroupWithNext,
  componentBody,
  componentContentFrom,
  groupWithNext,
  replaceWithComponent,
  slugify,
  ungroup,
  zoneItems,
  ROOT_ZONE,
  type TreeNode,
} from "./grouping";
import { componentContent, expandComponents } from "@/lib/components";

/**
 * Grouper, degrouper, transformer en composant : chaque operation reecrit
 * l'arbre du template. Une erreur ici PERD des blocs, sans message — d'ou les
 * verifications sur ce qui reste, et pas seulement sur ce qui a ete ajoute.
 */

const text = (id: string) => ({ type: "Text", props: { id, content: id } });
const tree = () => ({
  root: { props: {} },
  zones: {},
  content: [
    {
      type: "Page",
      props: {
        id: "p1",
        content: [
          text("a"),
          text("b"),
          text("c"),
          { type: "Columns", props: { id: "cols", left: [text("l1"), text("l2")], right: [], third: [] } },
        ],
      },
    },
  ],
});

const ids = (nodes: TreeNode[] | null) => (nodes ?? []).map((node) => node.props.id);

test("groupWithNext : reunit le bloc et son suivant, a leur place", () => {
  const out = groupWithNext(tree(), "p1:content", 0, "g1");
  assert.deepEqual(ids(zoneItems(out, "p1:content")), ["g1", "c", "cols"]);
  assert.deepEqual(ids(zoneItems(out, "g1:content")), ["a", "b"]);
});

test("groupWithNext : sur un Groupe, le suivant le rejoint en dernier", () => {
  const once = groupWithNext(tree(), "p1:content", 0, "g1");
  const twice = groupWithNext(once, "p1:content", 0, "ignore");
  assert.deepEqual(ids(zoneItems(twice, "p1:content")), ["g1", "cols"]);
  assert.deepEqual(ids(zoneItems(twice, "g1:content")), ["a", "b", "c"]);
});

test("groupWithNext : fonctionne dans un slot imbrique, sans toucher au reste", () => {
  const out = groupWithNext(tree(), "cols:left", 0, "g1");
  assert.deepEqual(ids(zoneItems(out, "cols:left")), ["g1"]);
  assert.deepEqual(ids(zoneItems(out, "g1:content")), ["l1", "l2"]);
  assert.deepEqual(ids(zoneItems(out, "p1:content")), ["a", "b", "c", "cols"]);
});

test("groupWithNext : rien sans bloc suivant, rien sur des Pages", () => {
  assert.equal(canGroupWithNext(tree(), "p1:content", 3), false);
  assert.equal(canGroupWithNext(tree(), ROOT_ZONE, 0), false);
  const original = tree();
  assert.equal(groupWithNext(original, "p1:content", 3, "g1"), original);
});

test("ungroup : les blocs reprennent la place du groupe, dans leur ordre", () => {
  const grouped = groupWithNext(tree(), "p1:content", 1, "g1");
  const out = ungroup(grouped, "p1:content", 1);
  assert.deepEqual(ids(zoneItems(out, "p1:content")), ["a", "b", "c", "cols"]);
});

test("componentContentFrom : le contenu d'un Groupe, un bloc seul, jamais une Page ni un Composant", () => {
  const grouped = groupWithNext(tree(), "p1:content", 0, "g1");
  assert.deepEqual(ids(componentContentFrom(zoneItems(grouped, "p1:content")![0])), ["a", "b"]);
  assert.deepEqual(ids(componentContentFrom(text("x") as TreeNode)), ["x"]);
  assert.equal(componentContentFrom(tree().content[0] as TreeNode), null);
  assert.equal(componentContentFrom({ type: "Composant", props: { id: "k", component: "pied" } }), null);
});

test("composant cree puis cite : la fiche depliee contient les memes blocs qu'avant", () => {
  const grouped = groupWithNext(tree(), "p1:content", 0, "g1");
  const content = componentContentFrom(zoneItems(grouped, "p1:content")![0])!;

  // Ce que l'editeur du composant enregistre, et ce que le depliage en relit.
  const body = componentBody(content, "page-k");
  assert.deepEqual(ids(componentContent(body) as TreeNode[]), ["a", "b"]);

  // Le template cite desormais le composant a la place du groupe...
  const cited = replaceWithComponent(grouped, "p1:content", 0, "mon-bloc", "k1");
  assert.deepEqual(
    zoneItems(cited, "p1:content")!.map((node) => node.type),
    ["Composant", "Text", "Columns"]
  );

  // ... et le depliage rend les blocs d'origine, a la meme place.
  const expanded = expandComponents(cited, (slug) => (slug === "mon-bloc" ? componentContent(body) : null));
  assert.deepEqual(
    zoneItems(expanded, "p1:content")!.map((node) => node.props.content ?? node.type),
    ["a", "b", "c", "Columns"]
  );
});

test("slugify : un nom affiche devient un slug que createTemplate accepte", () => {
  assert.equal(slugify("Pied de page Acme — v2"), "pied-de-page-acme-v2");
  assert.equal(slugify("  Équipe & Coordonnées "), "equipe-coordonnees");
  assert.match(slugify("x".repeat(80)), /^[a-z0-9][a-z0-9-]{1,62}$/);
});
