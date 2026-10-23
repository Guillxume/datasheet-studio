import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { mergeBlockProps, resolveBlockProps } from "./blockProps";

/**
 * Ce module est le SEUL endroit ou les props d'un bloc sont preparees, pour le
 * PDF comme pour le canvas de l'editeur. Une divergence ici rendrait a nouveau
 * possible ce qu'il existe pour empecher : un bloc vide a l'ecran et pleine page
 * a l'impression.
 */

const DEFAULTS = {
  source: "{{features}}",
  mapping: [] as unknown[],
  size: 9,
  heading: "",
};

test("les valeurs par defaut comblent les champs absents des props enregistrees", () => {
  // Le cas d'un template publie AVANT l'ajout d'un champ au registry.
  const out = mergeBlockProps({ size: 11 }, DEFAULTS);

  assert.equal(out.size, 11, "la valeur enregistree l'emporte");
  assert.equal(out.source, "{{features}}", "le champ absent herite du defaut");
});

test("une source enregistree a [] retombe sur son token", () => {
  // Degat d'une ancienne version du registry : `source: []` ecrase le token et
  // rend le bloc vide, sans aucun signal.
  const out = mergeBlockProps({ source: [] }, DEFAULTS);

  assert.equal(out.source, "{{features}}");
});

test("un vrai champ tableau vide n'est pas repare", () => {
  // `mapping` a un defaut tableau : une liste vide y est une valeur legitime, et
  // la reparation ne doit surtout pas la remplacer.
  const out = mergeBlockProps({ mapping: [] }, DEFAULTS);

  assert.deepEqual(out.mapping, []);
});

test("un token seul renvoie la valeur typee, un token dans une phrase est interpole", () => {
  const data = {
    features: [{ name: "Poids", value: "78 kg" }],
    product: { sku: "TPM-2500" },
  };

  const out = resolveBlockProps({ source: "{{features}}", heading: "Ref. {{product.sku}}" }, data);

  assert.deepEqual(out.source, data.features, "un tableau doit traverser en tableau");
  assert.equal(out.heading, "Ref. TPM-2500");
});

test("le contexte puck traverse sans etre resolu", () => {
  const puck = { isEditing: true, metadata: { zone: "body" } };
  const out = resolveBlockProps({ puck, heading: "{{product.sku}}" }, { product: { sku: "A" } });

  assert.equal(out.puck, puck, "la meme reference, et non une copie");
  assert.equal(out.heading, "A");
});

test("un element React et une fonction traversent intacts", () => {
  // Dans l'editeur, Puck remplace la valeur d'un champ `contentEditable` par un
  // element et expose les slots comme des composants. Les traverser les
  // transformerait en objets nus, donc irrendables.
  const element = createElement("span", null, "texte");
  const slot = () => null;

  const out = resolveBlockProps({ text: element, content: slot }, {});

  assert.equal(out.text, element);
  assert.equal(out.content, slot);
});
