import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildSampleData } from "./sampleData";
import type { AssetBag } from "./assets";
import type { StudioAssets, TemplateTrees } from "./render";

/**
 * src/lib/db.ts cree son client a l'import et exige donc DATABASE_URL, que
 * src/lib/render.tsx entraine par sa chaine de dependances. On ne change pas ce
 * comportement — echouer au demarrage sur une configuration absente est voulu —
 * mais ce test n'a besoin d'aucune base : les pictos sont injectes. D'ou une URL
 * factice, posee avant l'import, et un import DYNAMIQUE de render.tsx pour que
 * l'affectation precede son chargement.
 */
process.env.DATABASE_URL ??= "postgres://temoin:temoin@127.0.0.1:5432/temoin";

/**
 * Temoin du HTML envoye a Chromium.
 *
 * POURQUOI. Le registry porte plus de mille neuf cents lignes de mise en page et
 * aucun test ne le rendait : les suites existantes couvrent l'assainissement, le
 * regroupement des caracteristiques, le QR et la preparation du payload — jamais le
 * document produit. En refactorant la racine pour le canvas, le chemin PDF a ete
 * modifie et rien ne l'aurait signale ; seul un appel manuel a Gotenberg l'a vu.
 *
 * Ce que ce temoin attrape : toute modification du HTML produit pour un template de
 * reference. Un style en ligne perdu, un bloc qui s'efface, un token qui ne resout
 * plus, une structure de tableau qui change.
 *
 * Ce qu'il n'attrape pas : ce que Chromium fait de ce HTML. La pagination reelle se
 * verifie par un rendu (voir `pnpm probe-canvas` et l'apercu de l'editeur).
 *
 * Mettre a jour apres un changement VOULU :
 *
 *   GOLDEN=update pnpm test
 *
 * puis relire le diff du temoin. C'est la relecture qui protege, pas le fichier.
 */

const GOLDEN = "fixtures/golden/template-02.html";

/**
 * Pictos de la bibliotheque, injectes plutot que lus en base : le test n'a ainsi
 * besoin d'aucune base de donnees, et le temoin ne bouge pas quand le contenu d'un
 * picto change.
 */
const STUDIO_ASSETS: StudioAssets = {
  map: new Map([
    ["/assets/shared/carsat", "data:image/png;base64,PICTO-CARSAT"],
    ["/assets/shared/certificat", "data:image/png;base64,PICTO-CERTIFICAT"],
    ["/assets/shared/garantie-3-ans", "data:image/png;base64,PICTO-GARANTIE"],
    ["/assets/shared/manuel", "data:image/png;base64,PICTO-MANUEL"],
  ]),
  missing: [],
  // Aucune reference etrangere dans le template de reference : le golden
  // doit rester identique, la restriction de portee ne le concerne pas.
  foreign: [],
};

/**
 * Les images inlines sont remplacees par une empreinte de leur charge.
 *
 * Sans cela le temoin est illisible, donc non relisible — et un temoin qu'on ne
 * relit pas ne protege de rien. Le QR code, en particulier, sort en SVG url-encode
 * de plusieurs milliers de caracteres sur une seule ligne.
 *
 * Une empreinte plutot qu'une taille : deux QR de contenus differents peuvent avoir
 * la meme longueur, et on veut voir le changement.
 */
function normalize(html: string): string {
  return html.replace(
    /data:([\w/+.-]+)(;base64)?,([^"'\s>]+)/g,
    (_match, mime: string, base64: string | undefined, payload: string) => {
      const digest = createHash("sha1").update(payload).digest("hex").slice(0, 12);
      return `data:${mime}${base64 ?? ""},<${digest}>`;
    }
  );
}

/** Une balise par ligne : c'est ce qui rend le temoin relisible et le diff precis. */
function lines(html: string): string[] {
  return normalize(html).replace(/></g, ">\n<").split("\n");
}

function firstDifference(actual: string[], expected: string[]): string | null {
  const count = Math.max(actual.length, expected.length);

  for (let index = 0; index < count; index += 1) {
    if (actual[index] === expected[index]) continue;

    return [
      `premiere difference a la ligne ${index + 1} sur ${count}`,
      `  temoin : ${expected[index] ?? "(fin du fichier)"}`,
      `  obtenu : ${actual[index] ?? "(fin du fichier)"}`,
      "",
      "Si le changement est voulu : GOLDEN=update pnpm test, puis relire le diff.",
    ].join("\n");
  }

  return null;
}

async function build() {
  const template = JSON.parse(readFileSync("docs/exemple-template-02.json", "utf8")) as {
    body: unknown;
    header?: unknown;
    footer?: unknown;
    css?: string | null;
  };

  const trees = {
    body: template.body,
    header: template.header ?? null,
    footer: template.footer ?? null,
    css: template.css ?? null,
    geometry: null,
  } as TemplateTrees;

  const bag: AssetBag = new Map();
  const { buildRenderDocuments, RENDER_SCOPE_ANY } = await import("./render");

  return buildRenderDocuments(
    {
      trees,
      data: buildSampleData(undefined, "typique"),
      bag,
      locale: "fr",
      title: "Fiche",
      // Sans effet ici : les assets sont fournis tout faits en second argument,
      // donc aucune lecture n'a lieu. Le champ reste obligatoire pour que le
      // compilateur force le choix partout ailleurs.
      shopScope: RENDER_SCOPE_ANY,
    },
    STUDIO_ASSETS
  );
}

test("le HTML produit pour le template de reference est inchange", async () => {
  const documents = await build();

  const produced = [
    "<!-- ===== index.html ===== -->",
    ...lines(documents.indexHtml),
    "<!-- ===== header.html ===== -->",
    ...lines(documents.headerHtml ?? ""),
    "<!-- ===== footer.html ===== -->",
    ...lines(documents.footerHtml ?? ""),
  ];

  if (process.env.GOLDEN === "update") {
    mkdirSync("fixtures/golden", { recursive: true });
    writeFileSync(GOLDEN, `${produced.join("\n")}\n`);
    return;
  }

  const expected = readFileSync(GOLDEN, "utf8").trimEnd().split("\n");
  assert.equal(firstDifference(produced, expected), null);
});

/**
 * Assertions structurelles, INDEPENDANTES du temoin.
 *
 * Sans elles, un `GOLDEN=update` distrait pourrait enteriner une regression
 * majeure — un tableau vide, des tokens non resolus — en la gravant dans le
 * fichier de reference. Celles-ci echouent quand meme.
 */
test("le document contient bien les donnees resolues, pas des tokens", async () => {
  const documents = await build();

  assert.equal(documents.warnings.length, 0, "aucun avertissement attendu sur ce montage");
  assert.doesNotMatch(documents.indexHtml, /\{\{/, "aucun token ne doit survivre au rendu");

  // Les blocs alimentes par une source doivent avoir produit leur contenu.
  assert.match(documents.indexHtml, /<table/, "le tableau de caracteristiques");
  assert.match(documents.indexHtml, /Capacité de charge/, "un libelle de caracteristique");
  assert.match(documents.indexHtml, /2500 kg \(Q\)/, "une valeur avec son renvoi de schema");
  assert.match(documents.indexHtml, /PICTO-CARSAT/, "un picto de la bibliotheque, inline");

  // Et rien qui n'appartienne qu'a l'editeur.
  assert.doesNotMatch(documents.indexHtml, /ds-void|ds-page-sheet|ds-tag/, "chrome d'editeur");
});

test("les bandeaux sont des documents autonomes, aux contraintes de Chromium", async () => {
  const documents = await build();

  for (const [zone, html] of [
    ["en-tete", documents.headerHtml],
    ["pied", documents.footerHtml],
  ] as const) {
    assert.ok(html, `${zone} attendu`);
    // Trois regles etablies par mesure, dont l'oubli degrade SILENCIEUSEMENT.
    assert.match(html, /print-color-adjust: exact/, `${zone} : sans quoi Chromium ignore les fonds`);
    assert.match(html, /class="ds-marginbox"/, `${zone} : un seul element racine`);
    assert.match(html, /width: 100%/, `${zone} : sinon le bandeau epouse son contenu`);
  }
});

test("les bandeaux repetes respectent les marges papier laterales", async () => {
  /**
   * DIVERGENCE EDITEUR / PDF, constatee en composant une fiche reelle.
   *
   * Chromium n'applique PAS les marges de page a ses gabarits d'en-tete et de
   * pied : ils occupent toute la largeur de la feuille. Le canvas de l'editeur,
   * lui, les montrait deja (MarginBoxCanvas les pose en padding). Un en-tete
   * compose aligne sur le corps sortait donc colle au bord dans le PDF, logo
   * tronque — sans erreur, sans avertissement, et invisible tant qu'on ne
   * comparait pas les deux surfaces.
   *
   * Le controle porte sur le padding du conteneur : c'est le seul endroit ou la
   * marge peut etre appliquee, le document de bandeau etant autonome.
   */
  const documents = await build();

  assert.ok(documents.headerHtml, "ce montage a un en-tete");
  assert.match(
    documents.headerHtml as string,
    /\.ds-marginbox \{[^}]*padding: 0 \d+(?:\.\d+)?mm 0 \d+(?:\.\d+)?mm/,
    "le conteneur de bandeau doit porter les marges papier"
  );

  // Et la valeur doit etre CELLE de la geometrie, pas une constante.
  const attendu = `padding: 0 ${documents.geometry.margins.right}mm 0 ${documents.geometry.margins.left}mm`;
  assert.ok(
    (documents.headerHtml as string).includes(attendu),
    `attendu « ${attendu} » dans le document d'en-tete`
  );
});
