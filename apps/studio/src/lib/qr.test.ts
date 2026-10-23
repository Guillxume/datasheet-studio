import { test } from "node:test";
import assert from "node:assert/strict";
import { qrSvgDataUri } from "./qr";

/**
 * Le QR remplace celui que l'ancien module PrestaShop produisait via
 * mpdf/qrcode. Il est genere dans le bloc, donc de facon synchrone : ces
 * assertions verrouillent surtout le fait qu'un contenu aberrant fait s'effacer
 * le bloc au lieu de faire echouer la fiche.
 */

const decode = (uri: string): string => decodeURIComponent(uri.replace(/^data:image\/svg\+xml,/, ""));

test("produit un SVG en data URI", () => {
  const uri = qrSvgDataUri("https://exemple.test/produit-123");
  assert.ok(uri, "une URI doit etre produite");
  assert.match(uri as string, /^data:image\/svg\+xml,/);

  const svg = decode(uri as string);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  // crispEdges evite l'antialiasing des modules, qui brouille la lecture a l'impression.
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /<path d="M/);
});

test("un contenu plus long produit un QR plus dense", () => {
  const petit = decode(qrSvgDataUri("a") as string);
  const grand = decode(qrSvgDataUri("https://exemple.test/" + "x".repeat(300)) as string);

  const box = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1] ?? 0);
  assert.ok(box(grand) > box(petit), `${box(grand)} doit depasser ${box(petit)}`);
});

test("le fond est transparent par defaut, colorable au besoin", () => {
  const transparent = decode(qrSvgDataUri("test") as string);
  assert.doesNotMatch(transparent, /<rect/);

  const colore = decode(qrSvgDataUri("test", { light: "#ffffff", dark: "#0b5ea8" }) as string);
  assert.match(colore, /<rect[^>]*fill="#ffffff"/);
  assert.match(colore, /fill="#0b5ea8"/);
});

test("refuse une couleur qui n'en est pas", () => {
  // Une valeur de couleur arrive d'un champ de template : elle ne doit jamais
  // pouvoir injecter d'attributs ou de balises dans le SVG.
  const svg = decode(qrSvgDataUri("test", { dark: '"/><script>alert(1)</script>' }) as string);
  assert.doesNotMatch(svg, /<script/);
  assert.match(svg, /fill="#000000"/);
});

test("accepte une variable CSS comme couleur", () => {
  const svg = decode(qrSvgDataUri("test", { dark: "var(--color-primary)" }) as string);
  assert.match(svg, /fill="var\(--color-primary\)"/);
});

/**
 * « Ca ressemble a un QR » ne suffit pas. Un QR valide porte trois motifs de
 * reperage de 7x7 modules (haut-gauche, haut-droit, bas-gauche) : anneau noir,
 * anneau blanc, coeur noir 3x3. Verifier leur presence dans la matrice, c'est
 * verifier que le generateur produit un code lisible par un telephone, et pas
 * seulement un damier plausible.
 */
test("porte les trois motifs de reperage d'un QR valide", () => {
  const margin = 2;
  const svg = decode(qrSvgDataUri("https://exemple.test/produit", { margin }) as string);
  const box = Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1] ?? 0);
  const count = box - margin * 2;

  // Reconstruit la matrice depuis les rectangles du path.
  const dark = new Set<string>();
  for (const [, x, y] of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    dark.add(`${Number(x) - margin},${Number(y) - margin}`);
  }
  const isDark = (col: number, row: number) => dark.has(`${col},${row}`);

  const checkFinder = (originCol: number, originRow: number, corner: string) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const onOuterRing = r === 0 || r === 6 || c === 0 || c === 6;
        const onInnerRing = r === 1 || r === 5 || c === 1 || c === 5;
        const expected = onOuterRing ? true : onInnerRing ? false : true;
        assert.equal(
          isDark(originCol + c, originRow + r),
          expected,
          `${corner} : module (${c},${r}) devrait etre ${expected ? "noir" : "blanc"}`
        );
      }
    }
  };

  checkFinder(0, 0, "haut-gauche");
  checkFinder(count - 7, 0, "haut-droit");
  checkFinder(0, count - 7, "bas-gauche");

  // Une version de QR fait toujours 4 x version + 17 modules de cote.
  assert.equal((count - 17) % 4, 0, `taille de matrice invalide : ${count}`);
});

test("retourne null plutot que d'echouer sur un contenu inutilisable", () => {
  assert.equal(qrSvgDataUri(""), null);
  assert.equal(qrSvgDataUri("   "), null);
  // Au-dela de la capacite maximale d'un QR, le bloc doit s'effacer.
  assert.equal(qrSvgDataUri("x".repeat(10000)), null);
});
