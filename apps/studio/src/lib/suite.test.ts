import { test } from "node:test";
import assert from "node:assert/strict";
import { safeSuite } from "./suite";

test("garde un chemin du Studio, requete comprise", () => {
  assert.equal(safeSuite("/editor/shared/fiche?zone=header"), "/editor/shared/fiche?zone=header");
  assert.equal(safeSuite("/consultation#liste"), "/consultation#liste");
});

test("refuse toute destination hors du Studio", () => {
  for (const piege of [
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
  ]) {
    assert.equal(safeSuite(piege), "/", JSON.stringify(piege));
  }
  assert.equal(safeSuite(undefined), "/");
});
