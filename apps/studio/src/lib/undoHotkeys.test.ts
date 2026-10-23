import { test } from "node:test";
import assert from "node:assert/strict";
import { undoDecision } from "./undoHotkeys";

/**
 * Ctrl+Z n'annulait rien sur un clavier AZERTY (et Ctrl+W annulait a sa place) :
 * Puck lit la position physique de la touche, pas la lettre. Constate dans un
 * navigateur avant correction. Les cas ci-dessous sont les vrais couples
 * (code, key) qu'envoie chaque disposition.
 */

const key = (code: string, k: string, mods: Partial<Record<"ctrl" | "meta" | "shift" | "alt", boolean>> = {}) => ({
  code,
  key: k,
  ctrlKey: mods.ctrl ?? false,
  metaKey: mods.meta ?? false,
  shiftKey: mods.shift ?? false,
  altKey: mods.alt ?? false,
});

test("QWERTY : Puck s'en charge deja, on ne fait rien (sinon on annulerait deux fois)", () => {
  assert.equal(undoDecision(key("KeyZ", "z", { ctrl: true })), null);
  assert.equal(undoDecision(key("KeyZ", "z", { meta: true })), null);
  assert.equal(undoDecision(key("KeyZ", "Z", { meta: true, shift: true })), null);
  assert.equal(undoDecision(key("KeyY", "y", { ctrl: true })), null);
});

test("AZERTY : Ctrl/Cmd+Z annule, Maj retablit — la touche Z envoie KeyW", () => {
  assert.equal(undoDecision(key("KeyW", "z", { ctrl: true })), "back");
  assert.equal(undoDecision(key("KeyW", "z", { meta: true })), "back");
  assert.equal(undoDecision(key("KeyW", "Z", { meta: true, shift: true })), "forward");
});

test("AZERTY : Ctrl+W (code KeyZ) ne doit plus annuler", () => {
  assert.equal(undoDecision(key("KeyZ", "w", { ctrl: true })), "block");
});

test("QWERTZ : Z et Y permutes — Ctrl+Z annule au lieu de retablir", () => {
  assert.equal(undoDecision(key("KeyY", "z", { ctrl: true })), "back");
  assert.equal(undoDecision(key("KeyZ", "y", { ctrl: true })), "forward");
});

test("hors raccourci : sans Ctrl/Cmd, avec AltGr, ou une autre lettre", () => {
  assert.equal(undoDecision(key("KeyW", "z")), null);
  assert.equal(undoDecision(key("KeyW", "z", { ctrl: true, alt: true })), null);
  assert.equal(undoDecision(key("KeyS", "s", { ctrl: true })), null);
});
