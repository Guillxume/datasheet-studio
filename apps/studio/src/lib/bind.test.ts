import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveValue } from "./bind";

/**
 * La resolution des tokens decide de ce qui apparait sur une fiche envoyee a un
 * client. Un chemin qui ne resout pas ne produit aucune erreur : il rend une
 * chaine vide, donc un bloc vide. C'est exactement le genre de panne qu'on ne
 * voit qu'en relisant un PDF, et le segment « last » ajoute un chemin de plus a
 * se tromper.
 */

const DATA = {
  images: [
    { src: "asset://img-0", legend: "ambiance" },
    { src: "asset://img-1", legend: "trois-quarts" },
    { src: "asset://img-2", legend: "detoure" },
  ],
  features: [
    { name: "Largeur", value: "120 cm" },
    { name: "Garantie", value: "3 ans" },
  ],
  product: { name: "Bureau Electra", sku: "ELE-120" },
  schema_image: null,
  // Une boutique peut poser ce qu'elle veut dans custom.* : si un champ s'appelle
  // « last », il doit rester lisible.
  custom: { last: "valeur d'un champ nomme last" },
};

test("un indice numerique designe toujours la meme position", () => {
  assert.equal(resolveValue("{{images.0.src}}", DATA), "asset://img-0");
});

test("« last » designe le dernier element, quel que soit le nombre d'images", () => {
  assert.equal(resolveValue("{{images.last.src}}", DATA), "asset://img-2");

  // Le meme token sur un produit qui a deux images de plus : c'est tout l'interet,
  // aucun indice fixe ne vaut pour les deux.
  const plusLong = { images: [...DATA.images, { src: "asset://img-3" }, { src: "asset://img-4" }] };
  assert.equal(resolveValue("{{images.last.src}}", plusLong), "asset://img-4");
});

test("« last-1 » designe l'avant-derniere, quel que soit le nombre d'images", () => {
  assert.equal(resolveValue("{{images.last-1.src}}", DATA), "asset://img-1");

  const plusLong = { images: [...DATA.images, { src: "asset://img-3" }, { src: "asset://img-4" }] };
  assert.equal(resolveValue("{{images.last-1.src}}", plusLong), "asset://img-3");
  assert.equal(resolveValue("{{images.last-2.src}}", plusLong), "asset://img-2");
});

test("« last-1 » ne rend rien sur une liste trop courte", () => {
  assert.equal(resolveValue("{{images.last-1.src}}", { images: [{ src: "seule" }] }), undefined);
  assert.equal(resolveValue("{{images.last-1.src}}", { images: [] }), undefined);
});

test("sur un objet, « last-1 » reste une cle ordinaire", () => {
  assert.equal(resolveValue("{{custom.last-1}}", { custom: { "last-1": "champ" } }), "champ");
});

test("« last » vaut pour n'importe quelle liste, pas seulement les images", () => {
  assert.equal(resolveValue("{{features.last.value}}", DATA), "3 ans");
});

test("une liste vide ne rend rien plutot que de casser le rendu", () => {
  assert.equal(resolveValue("{{images.last.src}}", { images: [] }), undefined);
  assert.equal(resolveValue("{{images.last.src}}", {}), undefined);
});

test("sur un objet, « last » reste une cle ordinaire", () => {
  // Sans cette reserve, un champ custom nomme « last » deviendrait
  // silencieusement illisible le jour ou le segment a pris un sens.
  assert.equal(resolveValue("{{custom.last}}", DATA), "valeur d'un champ nomme last");
});

test("« last » s'interpole aussi dans une phrase", () => {
  assert.equal(
    resolveValue("Vue : {{images.last.legend}}", DATA),
    "Vue : detoure",
    "le token suit les deux comportements du resolveur, pas seulement le token exact"
  );
});

test("le token exact rend la valeur typee et non du texte", () => {
  assert.deepEqual(resolveValue("{{images.last}}", DATA), {
    src: "asset://img-2",
    legend: "detoure",
  });
});

test("les chemins existants ne changent pas de comportement", () => {
  assert.equal(resolveValue("{{product.name}}", DATA), "Bureau Electra");
  assert.equal(resolveValue("Ref. {{product.sku}}", DATA), "Ref. ELE-120");
  assert.equal(resolveValue("{{schema_image.src}}", DATA), undefined);
  assert.equal(resolveValue("texte sans token", DATA), "texte sans token");
});
