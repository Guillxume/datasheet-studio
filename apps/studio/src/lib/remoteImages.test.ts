import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REMOTE_IMAGES,
  attachRemoteImages,
  fetchRemoteImages,
  findRemoteImageUrls,
  inlineRemoteImages,
  remoteFilename,
  type FetchOutcome,
} from "./remoteImages";

/**
 * Chromium n'a plus d'acces reseau : les images distantes sont relevees dans le
 * document final, telechargees par l'application, puis jointes (corps) ou
 * inlinees (bandeaux). Ces assertions verrouillent le releve — ce qui est une
 * ressource et ce qui n'en est pas — et la reecriture.
 */

const image = (octets = 4): FetchOutcome => ({ ok: true, image: { mime: "image/png", bytes: Buffer.alloc(octets, 1) } });

test("releve les src et les url(), echappes compris", () => {
  const html = [
    '<img src="https://exemple.test/a.jpg?w=1&amp;h=2" alt="">',
    "<img src='https://exemple.test/b.png'>",
    '<div style="background-image:url(&quot;https://exemple.test/fond.jpg&quot;)"></div>',
    "<style>.x{background:url(https://exemple.test/css.webp)} .y{background:url('https://exemple.test/q.gif')}</style>",
  ].join("");
  assert.deepEqual(findRemoteImageUrls(html), [
    "https://exemple.test/a.jpg?w=1&h=2",
    "https://exemple.test/b.png",
    "https://exemple.test/fond.jpg",
    "https://exemple.test/css.webp",
    "https://exemple.test/q.gif",
  ]);
});

test("ignore ce qui n'est pas une ressource", () => {
  // Un lien, l'adresse de la fiche en texte (contenu du QR code), une data URI,
  // un fichier joint, un srcset : rien de tout cela n'est telecharge.
  const html = [
    '<a href="https://boutique.test/produit">voir</a>',
    "<p>https://boutique.test/produit</p>",
    '<img src="data:image/png;base64,AAAA">',
    '<img src="./img-0.jpg">',
    '<img srcset="https://exemple.test/x.jpg 2x">',
  ].join("");
  assert.deepEqual(findRemoteImageUrls(html), []);
});

test("le corps joint les images, les bandeaux les inlinent", () => {
  const images = new Map([["https://exemple.test/a.jpg?w=1&h=2", { mime: "image/jpeg", bytes: Buffer.from("JPEG") }]]);
  const html = '<img src="https://exemple.test/a.jpg?w=1&amp;h=2"><img src="https://exemple.test/absente.png">';

  const corps = attachRemoteImages(html, images, new Set());
  const nom = remoteFilename("https://exemple.test/a.jpg?w=1&h=2", "image/jpeg");
  assert.match(nom, /^distant-[0-9a-f]{24}\.jpg$/);
  assert.equal(corps.markup, `<img src="./${nom}"><img src="https://exemple.test/absente.png">`);
  assert.deepEqual(
    corps.assets.map((asset) => [asset.filename, asset.mime, asset.bytes.toString()]),
    [[nom, "image/jpeg", "JPEG"]]
  );

  // Une image non telechargee reste telle quelle : elle sera absente, et
  // l'avertissement de rendu l'a deja signalee.
  assert.equal(
    inlineRemoteImages(html, images),
    `<img src="data:image/jpeg;base64,${Buffer.from("JPEG").toString("base64")}"><img src="https://exemple.test/absente.png">`
  );
});

test("un nom de fichier deja pris par un asset de la boutique n'est jamais ecrase", () => {
  const url = "https://exemple.test/a.png";
  const images = new Map([[url, { mime: "image/png", bytes: Buffer.from("PNG") }]]);
  const pris = remoteFilename(url, "image/png");
  const corps = attachRemoteImages(`<img src="${url}">`, images, new Set([pris]));
  assert.notEqual(corps.assets[0].filename, pris);
  assert.equal(corps.markup, `<img src="./${corps.assets[0].filename}">`);
});

test("plafonne le nombre d'images, signale les echecs, et met en cache", async () => {
  const appels: string[] = [];
  const fetcher = async (url: string): Promise<FetchOutcome> => {
    appels.push(url);
    return url.endsWith("/refusee") ? { ok: false, raison: "image distante refusee (adresse non publique)" } : image();
  };

  const urls = Array.from({ length: MAX_REMOTE_IMAGES + 2 }, (_, i) => `https://plafond.test/${i}`);
  urls.push("https://plafond.test/refusee");
  const premier = await fetchRemoteImages(urls, fetcher);

  assert.equal(premier.images.size, MAX_REMOTE_IMAGES);
  assert.equal(appels.length, MAX_REMOTE_IMAGES);
  assert.equal(premier.warnings.filter((w) => w.includes(`plus de ${MAX_REMOTE_IMAGES} par fiche`)).length, 3);

  // Deuxieme rendu : tout vient du cache, aucun telechargement.
  appels.length = 0;
  const second = await fetchRemoteImages(urls.slice(0, 5), fetcher);
  assert.equal(second.images.size, 5);
  assert.equal(appels.length, 0);

  const refus = await fetchRemoteImages(["https://plafond.test/refusee"], fetcher);
  assert.equal(refus.images.size, 0);
  assert.deepEqual(refus.warnings, ["image distante refusee (adresse non publique) : https://plafond.test/refusee"]);
});

test("le budget d'octets d'un rendu borne la memoire", async () => {
  const lourde = async (): Promise<FetchOutcome> => image(9 * 1024 * 1024);
  const urls = Array.from({ length: 8 }, (_, i) => `https://budget.test/${i}`);
  const resultat = await fetchRemoteImages(urls, lourde);
  // 48 Mo de budget, 9 Mo par image : cinq passent, les suivantes sont ignorees.
  assert.equal(resultat.images.size, 5);
  assert.equal(resultat.warnings.filter((w) => w.includes("budget")).length, 3);
});

test("retire les prechargements d'images que React ajoute", () => {
  const url = "https://exemple.test/logo.png";
  const images = new Map([[url, { mime: "image/png", bytes: Buffer.from("PNG") }]]);
  const html = `<link rel="preload" as="image" href="${url}"/><img src="${url}"><link rel="stylesheet" href="./a.css">`;
  const bandeau = inlineRemoteImages(html, images);
  assert.ok(!bandeau.includes("preload"));
  assert.ok(bandeau.includes('<link rel="stylesheet" href="./a.css">'));
  assert.ok(!attachRemoteImages(html, images, new Set()).markup.includes("preload"));
});
