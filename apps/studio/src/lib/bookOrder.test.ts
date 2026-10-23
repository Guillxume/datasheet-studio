import { test } from "node:test";
import assert from "node:assert/strict";
import { moveItem } from "./bookOrder";

test("un element change de place, les autres gardent leur ordre", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
});

test("une position hors limites ne change rien et ne perd rien", () => {
  assert.deepEqual(moveItem(["a", "b"], 0, 9), ["a", "b"]);
  assert.deepEqual(moveItem(["a", "b"], -1, 0), ["a", "b"]);
});
