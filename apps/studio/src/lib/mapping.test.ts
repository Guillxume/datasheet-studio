import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compactArrays,
  htmlToText,
  getPath,
  getPathMulti,
  parseExpression,
  applyTransforms,
  setPath,
  textToHtml,
  toAmount,
} from "./mapping";

/**
 * Ces quatre fonctions decident du contenu de chaque fiche produite par le
 * collecteur CSV et par le collecteur d'API. Leurs erreurs ne cassent rien de
 * visible : un prix qui ne se formate pas, une legende sur la mauvaise image,
 * un tableau creux refuse par le schema avec un message qui ne dit pas d'ou
 * vient le trou. D'ou ces assertions sur les cas ou une implementation naive
 * se trompe en silence.
 */

test("un segment numerique cree un tableau, pas un objet indexe", () => {
  const data: Record<string, unknown> = {};
  setPath(data, "images.0.src", "a.jpg");
  setPath(data, "images.1.src", "b.jpg");
  setPath(data, "images.0.legend", "Vue de face");

  assert.deepEqual(data, {
    images: [{ src: "a.jpg", legend: "Vue de face" }, { src: "b.jpg" }],
  });
});

test("les deux ecritures d'indice designent la meme chose", () => {
  const a: Record<string, unknown> = {};
  const b: Record<string, unknown> = {};
  setPath(a, "images.0.src", "x");
  setPath(b, "images[0].src", "x");
  assert.deepEqual(a, b);
  assert.equal(getPath(a, "images[0].src"), "x");
});

test("compactArrays referme les trous que JSON.stringify transformerait en null", () => {
  const data: Record<string, unknown> = {};
  setPath(data, "images.0.src", "a.jpg");
  setPath(data, "images.2.src", "c.jpg");

  // Avant nettoyage, l'indice 1 est un trou : le schema refuserait le `null`.
  assert.match(JSON.stringify(data), /null/);
  compactArrays(data);
  assert.deepEqual(data, { images: [{ src: "a.jpg" }, { src: "c.jpg" }] });
});

test("getPathMulti conserve les trous pour garder deux listes alignees", () => {
  const source = {
    medias: [{ url: "a.jpg" }, { url: "b.jpg", legende: "Detail" }],
  };

  const urls = getPathMulti(source, "medias[].url");
  const legends = getPathMulti(source, "medias[].legende");

  assert.deepEqual(urls, ["a.jpg", "b.jpg"]);
  // Le trou est CONSERVE : sans lui, "Detail" atterrirait sur la premiere image.
  assert.equal(legends.length, 2);
  assert.equal(legends[0], undefined);
  assert.equal(legends[1], "Detail");
});

test("toAmount normalise ce qu'un export francais produit reellement", () => {
  // Le cas qui a motive la fonction : Number("489,00") vaut NaN, donc pas de
  // {{product.price.formatted}}, donc un prix vide sur la fiche sans erreur.
  assert.equal(toAmount("489,00"), "489.00");
  assert.equal(toAmount("1 234,56 €"), "1234.56");
  assert.equal(toAmount("1.234,56"), "1234.56");
  assert.equal(toAmount("1,234.56"), "1234.56");
  assert.equal(toAmount("349"), "349.00");
  assert.equal(toAmount(349.5), "349.50");
  assert.equal(toAmount(""), undefined);
  assert.equal(toAmount("gratuit"), undefined);
});

test("la transformation minor rend des unites a partir de centimes", () => {
  const { path, transforms } = parseExpression("tarifs.public | minor");
  assert.equal(path, "tarifs.public");
  assert.equal(applyTransforms(34900, transforms), "349.00");
});

test("une transformation inconnue echoue au chargement, pas au 300e produit", () => {
  assert.throws(() => parseExpression("prix | arrondi"), /transformation inconnue/);
});

test("textToHtml garde les paragraphes d'un texte brut et laisse le HTML tel quel", () => {
  // Une description Medusa est du TEXTE : partie telle quelle dans un champ
  // *_html, elle perdrait tous ses sauts de ligne au rendu.
  assert.equal(textToHtml("Un\n\nDeux"), "<p>Un</p><p>Deux</p>");
  assert.equal(textToHtml("Un\nDeux"), "<p>Un<br />Deux</p>");
  assert.equal(textToHtml("<p>Deja du HTML</p>"), "<p>Deja du HTML</p>");
  assert.equal(textToHtml("a < b"), "<p>a &lt; b</p>");
  assert.equal(textToHtml("   "), "");
});

test("htmlToText rend du texte la ou le contrat en attend", () => {
  // Le suffixe decide : `description_html` est assaini et rendu,
  // `description_short` est du TEXTE. Un resume HTML verse tel quel y imprime
  // ses balises sur la fiche, sans erreur ni avertissement.
  assert.equal(
    htmlToText("<p>Le <strong>bureau</strong> s&rsquo;adapte.</p><ul><li>Plateau 25&nbsp;mm</li><li>Garantie 5 ans</li></ul>"),
    // Une rupture de ligne par bloc : sans elle, la liste a puces se recolle en
    // une phrase illisible. Deux ruptures seraient du luxe dans un champ texte.
    "Le bureau s\u2019adapte.\nPlateau 25 mm\nGarantie 5 ans"
  );
  assert.equal(htmlToText("Prix&nbsp;: 149&euro; &amp; plus"), "Prix : 149\u20ac & plus");
  assert.equal(htmlToText("a &#8212; b"), "a \u2014 b");
});

test("une entite inconnue traverse intacte plutot que d'etre devinee", () => {
  // Inventaire fait sur l'export de reference : quatre entites nommees en tout.
  // Une table devinee abimerait le texte sans que rien ne le signale ; voir
  // "&agrave;" sur une fiche conduit au moins a completer la table.
  assert.equal(htmlToText("d&eacute;j&agrave;"), "d&eacute;j&agrave;");
  assert.equal(htmlToText("Texte deja accentue en UTF-8"), "Texte deja accentue en UTF-8");
});
