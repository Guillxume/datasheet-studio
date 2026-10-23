import { test } from "node:test";
import assert from "node:assert/strict";
import { canTarget, publishDecision, summarizeZone, zoneCitingComponent } from "./componentApply";
import { componentSlugsIn, expandComponents } from "./components";

/**
 * Appliquer un composant reecrit l'en-tete ou le pied de plusieurs templates
 * d'un coup — et peut les publier. Ce qui est verrouille ici : ce qu'on remplace,
 * ou on a le droit de le faire, et surtout QUAND on s'interdit de publier.
 */

test("summarizeZone : compte les blocs et reconnait une zone deja appliquee", () => {
  assert.deepEqual(summarizeZone(null, "pied"), { blocks: 0, alreadyApplied: false });
  assert.deepEqual(
    summarizeZone({ content: [{ type: "Text", props: {} }, { type: "Image", props: {} }] }, "pied"),
    { blocks: 2, alreadyApplied: false }
  );
  assert.deepEqual(summarizeZone(zoneCitingComponent("pied", "k"), "pied"), { blocks: 1, alreadyApplied: true });
  // Un autre composant, ou le composant parmi d'autres blocs : a remplacer.
  assert.equal(summarizeZone(zoneCitingComponent("autre", "k"), "pied").alreadyApplied, false);
});

test("zoneCitingComponent : une zone que le depliage remplace par le composant", () => {
  const zone = zoneCitingComponent("pied", "Composant-1");
  assert.deepEqual([...componentSlugsIn(zone)], ["pied"]);
  const expanded = expandComponents(zone, () => [{ type: "Text", props: { id: "t", content: "Pied" } }]);
  assert.deepEqual(
    expanded.content.map((node) => node.type),
    ["Text"]
  );
});

test("canTarget : composant de bibliotheque partout, composant de boutique chez elle seulement", () => {
  assert.equal(canTarget(null, null), true);
  assert.equal(canTarget(null, "shop-a"), true);
  assert.equal(canTarget("shop-a", "shop-a"), true);
  assert.equal(canTarget("shop-a", null), false);
  assert.equal(canTarget("shop-a", "shop-b"), false);
});

test("publishDecision : on ne publie que ce changement, jamais un brouillon qui attendait", () => {
  assert.equal(publishDecision(false, { publishedVersion: 3, draftVersion: 3 }), "draft");
  assert.equal(publishDecision(true, { publishedVersion: 3, draftVersion: 3 }), "publish");
  assert.equal(publishDecision(true, { publishedVersion: 3, draftVersion: 4 }), "pending-draft");
  assert.equal(publishDecision(true, { publishedVersion: null, draftVersion: 1 }), "never-published");
});
