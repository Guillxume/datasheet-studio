import { test } from "node:test";
import assert from "node:assert/strict";
import { ancestorsOf, blockCount, buildLayers, containerIds, planLayerMove, ROOT_ZONE, type LayerComponents } from "./layers";
import { datasheetConfig } from "./registry";

/**
 * Le panneau Calques deplace des blocs : une erreur ici en perd un (pose dans sa
 * propre branche), en cache un (troisieme colonne non dessinee) ou en deplace un
 * d'un cran de trop (Puck retire avant d'inserer). Ce sont ces trois pieges qui
 * sont verrouilles, contre le VRAI registry.
 */

const COMPONENTS = datasheetConfig.components as unknown as LayerComponents;

const text = (id: string, content = "") => ({ type: "Text", props: { id, content } });
const columns = (id: string, left: unknown[] = [], right: unknown[] = [], ratio = "1fr 1fr") => ({
  type: "Columns",
  props: { id, ratio, left, right, third: [] },
});
const page = (id: string, content: unknown[] = []) => ({ type: "Page", props: { id, content } });

const BODY = [
  page("p1", [text("a", "Premier"), columns("c", [text("l1")], [text("r1")]), text("b")]),
  page("p2", [text("z")]),
];

const plan = (sourceId: string, zone: string, index: number, pagesOnlyAtRoot = true) =>
  planLayerMove(buildLayers(BODY, COMPONENTS), COMPONENTS, sourceId, zone, index, { pagesOnlyAtRoot });

test("buildLayers : zones et index au format de Puck, slots nommes", () => {
  const [p1] = buildLayers(BODY, COMPONENTS);
  assert.equal(p1.zone, ROOT_ZONE);
  assert.equal(p1.slots[0].zone, "p1:content");
  const cols = p1.slots[0].items[1];
  assert.equal(cols.zone, "p1:content");
  assert.equal(cols.index, 1);
  assert.deepEqual(
    cols.slots.map((slot) => [slot.zone, slot.label]),
    [
      ["c:left", "Colonne 1"],
      ["c:right", "Colonne 2"],
    ]
  );
});

test("buildLayers : la 3e colonne n'est offerte que si la repartition la dessine", () => {
  const [deux] = buildLayers([columns("c")], COMPONENTS);
  assert.equal(deux.slots.length, 2);
  const [trois] = buildLayers([columns("c", [], [], "1fr 1fr 1fr")], COMPONENTS);
  assert.equal(trois.slots.length, 3);
});

test("buildLayers : le texte du bloc le distingue de ses voisins", () => {
  const [p1] = buildLayers(BODY, COMPONENTS);
  assert.equal(p1.slots[0].items[0].hint, "Premier");
});

test("planLayerMove : sortir un bloc d'une colonne, sous les Colonnes", () => {
  assert.deepEqual(plan("l1", "p1:content", 2), {
    sourceZone: "c:left",
    sourceIndex: 0,
    destinationZone: "p1:content",
    destinationIndex: 2,
  });
});

test("planLayerMove : descendre dans la meme zone compense le retrait de Puck", () => {
  // « a » (index 0) deplace AVANT « b » (index 2) : une fois retire, b est en 1.
  assert.equal(plan("a", "p1:content", 2)?.destinationIndex, 1);
  // Monter ne demande aucune correction.
  assert.equal(plan("b", "p1:content", 0)?.destinationIndex, 0);
});

test("planLayerMove : reposer un bloc a sa place ne fait rien", () => {
  assert.equal(plan("a", "p1:content", 0), null);
  assert.equal(plan("a", "p1:content", 1), null);
});

test("planLayerMove : un conteneur n'entre pas dans sa propre branche", () => {
  assert.equal(plan("c", "c:left", 0), null);
  assert.equal(plan("p1", "c:right", 0), null);
});

test("planLayerMove : les Pages restent a la racine, et la racine du corps n'a que des Pages", () => {
  assert.equal(plan("p2", "p1:content", 0), null);
  assert.equal(plan("a", ROOT_ZONE, 0), null);
  assert.deepEqual(plan("p2", ROOT_ZONE, 0), {
    sourceZone: ROOT_ZONE,
    sourceIndex: 1,
    destinationZone: ROOT_ZONE,
    destinationIndex: 0,
  });
  // En-tete et pied n'ont pas de pages : leur racine accepte tout bloc.
  assert.equal(plan("a", ROOT_ZONE, 0, false)?.destinationZone, ROOT_ZONE);
});

test("ancestorsOf : les conteneurs a deplier pour voir un bloc, du plus haut au plus proche", () => {
  const layers = buildLayers(BODY, COMPONENTS);
  assert.deepEqual(ancestorsOf(layers, "l1"), ["p1", "c"]);
  assert.deepEqual(ancestorsOf(layers, "a"), ["p1"]);
  assert.deepEqual(ancestorsOf(layers, "p1"), []);
  assert.deepEqual(ancestorsOf(layers, "inconnu"), []);
});

test("containerIds et blockCount : ce que replient et comptent les outils de l'en-tete", () => {
  const layers = buildLayers(BODY, COMPONENTS);
  assert.deepEqual(containerIds(layers), ["p1", "c", "p2"]);
  // a, Colonnes, l1, r1, b, z — les pages ne sont pas des blocs.
  assert.equal(blockCount(layers), 6);
});
