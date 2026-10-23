import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Non-regression du theme de l'editeur.
 *
 * POURQUOI CES TESTS EXISTENT. Trois defauts ont ete livres avec le premier
 * systeme de themes :
 *
 *  1. le calque de survol du canvas est devenu OPAQUE — le bloc survole
 *     disparaissait sous un aplat ; en theme sombre, un rectangle quasi noir
 *     sur la feuille blanche ;
 *  2. la couleur de texte au survol de la palette de glisser-deposer avait recu
 *     une teinte FIXE alors que son fond, lui, bascule — 2,43:1 en theme sombre ;
 *  3. la clef de stockage du theme etait importee depuis un module « use client »
 *     par un composant SERVEUR : elle valait `undefined` cote serveur, et le
 *     script de pre-peinture partait en `localStorage.getItem(undefined)`. Le
 *     theme choisi n'etait donc restaure a aucun chargement de page.
 *
 * Aucun des trois n'aurait ete vu par un test de contraste : le premier n'est
 * pas un probleme de contraste du tout, le deuxieme vit dans une regle de Puck
 * que nous n'ecrivons pas, et le troisieme ne se voit ni a la compilation
 * (`tsc --noEmit` passe) ni au build (`next build` passe).
 *
 * LE THEME VIENT DESORMAIS DU PACKAGE (@guillxume/ui, theme
 * « datasheet-studio ») : ses jetons sont declares sur `:root` et redefinis sur
 * `.dark`. editor.css ne garde que le branchement des jetons de Puck sur ceux
 * du theme, les jetons FIXES de la feuille (--sheet-*) et du bureau (--desk),
 * et les regles du canvas. C'est ce que ces tests verrouillent.
 *
 * CE QU'ILS NE PEUVENT PAS FAIRE. Ils lisent les feuilles de style comme du
 * texte : ils verifient des INVARIANTS DE CONCEPTION, pas des valeurs rendues.
 * Un vrai controle de contraste demande un navigateur.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const EDITOR = stripComments(readFileSync(join(root, "app/editor/[scope]/[slug]/editor.css"), "utf8"));

/**
 * Le theme est lu LA OU LE STUDIO LE RESOUT (node_modules, via les `exports` du
 * package) : c'est cette copie-la qui est servie, pas celle d'un depot voisin.
 */
const THEME = stripComments(
  readFileSync(require.resolve("@guillxume/ui/themes/datasheet-studio.css"), "utf8"),
);

type Rule = { selector: string; body: string };

/**
 * Les regles d'une feuille, a plat : `@media`, `@supports` et `@layer` sont
 * traverses, leurs regles internes comptent comme les autres. Les autres
 * at-rules (`@theme`, `@keyframes`...) et les instructions sans bloc
 * (`@import`) sont ignorees.
 */
function rulesOf(css: string): Rule[] {
  const rules: Rule[] = [];
  let i = 0;

  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;

    // Le selecteur commence apres la derniere instruction terminee par `;`
    // (un @import, par exemple) ou apres le bloc precedent.
    const prelude = css.slice(i, open);
    const selector = prelude.slice(prelude.lastIndexOf(";") + 1).trim();

    let depth = 0;
    let close = open;
    for (; close < css.length; close += 1) {
      if (css[close] === "{") depth += 1;
      else if (css[close] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const body = css.slice(open + 1, close);
    if (selector.startsWith("@")) {
      if (/^@(media|supports|layer)\b/.test(selector)) rules.push(...rulesOf(body));
    } else {
      rules.push({ selector: selector.replace(/\s+/g, " "), body });
    }
    i = close + 1;
  }

  return rules;
}

/** Les declarations d'un corps de regle, sous forme nom -> valeur. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(name.trim(), value.trim().replace(/\s+/g, " "));
  }
  return out;
}

/**
 * Toutes les declarations des regles dont le selecteur est `selector`, seul ou
 * dans une liste (`:root, .light` : depuis la 0.3.0, le theme clair vaut aussi
 * pour les ilots `.light` dans une page sombre), fusionnees.
 *
 * Le garde `assert.notEqual` existe parce qu'une premiere version de ces tests
 * ne trouvait aucun bloc et passait donc sans rien verifier.
 */
function declarationsOf(css: string, selector: string): Map<string, string> {
  const matching = rulesOf(css).filter((rule) =>
    rule.selector.split(",").some((part) => part.trim() === selector),
  );
  assert.notEqual(matching.length, 0, `bloc « ${selector} » introuvable`);
  return new Map(matching.flatMap((rule) => [...declarations(rule.body)]));
}

const references = (value: string) => [...value.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);

const ED = declarationsOf(EDITOR, ".ed");
const THEME_LIGHT = declarationsOf(THEME, ":root");
const THEME_DARK = declarationsOf(THEME, ".dark");

/**
 * Jetons qui changent de valeur selon le theme : tout ce que `.dark` redefinit,
 * dans le theme du package comme dans editor.css (le bureau, --desk).
 */
const JETONS_QUI_BASCULENT = new Set([...THEME_DARK.keys(), ...declarationsOf(EDITOR, ".dark").keys()]);

/* ------------------------------------------------------------------------ */
/* Regle des deux surfaces                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Jetons de Puck qui peignent sur la surface de page. La liste vient des regles
 * reelles de @puckeditor/core : `--puck-slot-*` habille les zones de depot et le
 * calque de survol d'un bloc, `--puck-color-selection-*` en est la valeur de
 * repli.
 */
const PEINT_SUR_LA_FEUILLE = /^--puck-(slot|color-selection)-/;

/**
 * Regles `.ds-*` posees sur le BUREAU, pas sur le papier : la pile des pages et
 * sa coquille (le fond du canvas), le numero de page (dans la marge du bureau)
 * et « Ajouter une page » (sous la feuille). Elles suivent le theme, comme le
 * reste du mobilier. Toute autre regle `.ds-*` dessine sur la feuille.
 */
const SUR_LE_BUREAU = /^\.ds-(canvas-stack|canvas-shell|page-no|add-page)\b/;

test("le theme du package est bien lu, et --desk bascule", () => {
  // Sans ces gardes, un theme introuvable ou renomme viderait la liste des
  // jetons qui basculent, et le test suivant passerait sans rien verifier.
  assert.ok(JETONS_QUI_BASCULENT.has("--primary"));
  assert.ok(JETONS_QUI_BASCULENT.has("--card"));
  assert.ok(JETONS_QUI_BASCULENT.has("--desk"));
});

test("rien de ce qui peint sur la feuille ne depend d'un jeton qui bascule", () => {
  const surLaFeuille: { where: string; value: string }[] = [];

  for (const [name, value] of ED) {
    if (PEINT_SUR_LA_FEUILLE.test(name)) surLaFeuille.push({ where: `.ed ${name}`, value });
  }
  const jetonsDePuck = surLaFeuille.length;
  assert.notEqual(jetonsDePuck, 0, "aucun jeton de feuille trouve : ce test ne verifierait rien");

  for (const rule of rulesOf(EDITOR)) {
    const selectors = rule.selector.split(",").map((part) => part.trim());
    if (!selectors.some((part) => part.includes(".ds-"))) continue;
    if (selectors.every((part) => SUR_LE_BUREAU.test(part))) continue;
    for (const [name, value] of declarations(rule.body)) {
      surLaFeuille.push({ where: `${rule.selector} ${name}`, value });
    }
  }
  assert.ok(surLaFeuille.length > jetonsDePuck, "aucune regle .ds-* de la feuille trouvee");

  const fautes = surLaFeuille.flatMap(({ where, value }) =>
    references(value)
      .filter((token) => JETONS_QUI_BASCULENT.has(token))
      .map((token) => `${where} utilise ${token}`),
  );

  assert.deepEqual(
    fautes,
    [],
    "La feuille represente du papier : elle est blanche dans les deux themes. " +
      "Ce qui est pose dessus doit utiliser un jeton --sheet-*, une couleur fixe ou `transparent`, " +
      "jamais un jeton du theme.",
  );
});

test("les jetons de la feuille sont fixes : aucune variante sombre", () => {
  const sheet = [...declarationsOf(EDITOR, ":root").keys()].filter((name) => name.startsWith("--sheet-"));
  assert.notEqual(sheet.length, 0, "aucun jeton --sheet-* declare sur :root");

  const redefinis = [...JETONS_QUI_BASCULENT].filter((name) => name.startsWith("--sheet-"));
  assert.deepEqual(redefinis, [], "un jeton --sheet-* redefini en sombre ne serait plus fixe");
});

test("le calque de survol et les zones de depot restent translucides", () => {
  // Ces trois-la se posent PAR-DESSUS du contenu qu'il faut continuer a voir.
  for (const name of ["--puck-slot-color-bg", "--puck-slot-component-color-overlay", "--puck-color-selection-bg"]) {
    const value = ED.get(name);
    assert.ok(value, `${name} n'est plus declare : Puck reprendrait sa valeur d'usine`);
    assert.match(
      value,
      /transparent/,
      `${name} = « ${value} » est opaque. Un calque opaque masque le bloc qu'on survole, ` +
        "c'est-a-dire exactement ce qu'on cherche a juger en le survolant.",
    );
  }
});

/* ------------------------------------------------------------------------ */
/* Jetons qui doivent, eux, basculer                                         */
/* ------------------------------------------------------------------------ */

test("--puck-color-interactive pointe sur un jeton du theme qui bascule", () => {
  const value = ED.get("--puck-color-interactive");
  assert.ok(value, "--puck-color-interactive n'est plus declare");

  const [reference] = references(value);
  assert.ok(reference, `--puck-color-interactive = « ${value} » : une valeur en dur ne peut pas basculer.`);
  assert.ok(
    THEME_LIGHT.has(reference) && THEME_DARK.has(reference),
    `--puck-color-interactive pointe sur ${reference}, qui n'est pas defini a la fois sur :root et .dark ` +
      "du theme. Or Puck l'emploie en COULEUR DE TEXTE sur un fond qui, lui, bascule " +
      "(survol de la palette, ligne d'Outline, icone de bouton-icone).",
  );
});

test("les couleurs de l'interface de Puck suivent le theme du package", () => {
  const interfacePuck = [...ED].filter(
    ([name]) => /^--puck-(color|button)-/.test(name) && !PEINT_SUR_LA_FEUILLE.test(name),
  );
  assert.ok(interfacePuck.length >= 10, "branchement des couleurs de Puck introuvable");

  const fautes: string[] = [];
  for (const [name, value] of interfacePuck) {
    const refs = references(value);
    if (refs.length === 0) fautes.push(`${name} = « ${value} » : valeur en dur, elle ne basculera pas`);
    for (const token of refs) {
      if (!THEME_LIGHT.has(token) || !THEME_DARK.has(token)) {
        fautes.push(`${name} utilise ${token}, absent de :root ou de .dark du theme`);
      }
    }
  }
  assert.deepEqual(fautes, []);

  // Les rayons suivent l'angle du theme (droit), qui n'a pas de variante sombre.
  for (const name of ["--puck-radius-xs", "--puck-radius-s", "--puck-radius-m", "--puck-radius-l"]) {
    const refs = references(ED.get(name) ?? "");
    assert.ok(refs.length > 0 && refs.every((token) => THEME_LIGHT.has(token)), `${name} doit suivre --radius`);
  }
});

/* ------------------------------------------------------------------------ */
/* Etancheite des jetons                                                     */
/* ------------------------------------------------------------------------ */

test("chaque jeton reference par editor.css est defini", () => {
  const defined = new Set(
    [EDITOR, THEME].flatMap((css) => rulesOf(css).flatMap((rule) => [...declarations(rule.body).keys()])),
  );
  // Fournis par Puck lui-meme, ou poses en ligne sur le canvas (EditorClient,
  // src/blocks/canvasChrome.tsx), ou par la feuille du template.
  const externes = /^--(puck-|ds-zoom$|font-body$|color-primary$|color-secondary$)/;

  const manquants = new Set<string>();
  for (const [, name] of EDITOR.matchAll(/var\((--[\w-]+)/g)) {
    if (!defined.has(name) && !externes.test(name)) manquants.add(name);
  }
  assert.deepEqual(
    [...manquants],
    [],
    "Jeton inconnu : l'ancien systeme (--ds-*, tokens.css) a disparu, seuls restent le theme du package " +
      "et les jetons --sheet-* / --desk d'editor.css.",
  );
});

/* ------------------------------------------------------------------------ */
/* Frontiere serveur / client                                                */
/* ------------------------------------------------------------------------ */

test("layout.tsx n'importe aucune valeur depuis un module client", () => {
  // Un composant serveur qui importe une valeur d'un module « use client » ne
  // recoit PAS la valeur : le bundler lui donne une reference de module client.
  // Une constante y devient `undefined`, silencieusement — ni tsc ni next build
  // ne le signalent, et le defaut ne se voit qu'en lisant le HTML servi.
  const layoutPath = join(root, "app/layout.tsx");
  const layout = stripComments(readFileSync(layoutPath, "utf8"));

  assert.doesNotMatch(layout, /^\s*["']use client["']/m, "layout.tsx doit rester un composant serveur");

  const fautes: string[] = [];
  for (const [, spec] of layout.matchAll(/^\s*import[^"']*["']([^"']+)["']/gm)) {
    if (spec.endsWith(".css") || (!spec.startsWith(".") && !spec.startsWith("@/"))) continue;

    const base = spec.startsWith("@/") ? join(root, spec.slice(2)) : join(dirname(layoutPath), spec);
    const source = [".ts", ".tsx", "/index.ts", "/index.tsx"]
      .map((ext) => `${base}${ext}`)
      .find((candidate) => {
        try {
          readFileSync(candidate);
          return true;
        } catch {
          return false;
        }
      });
    assert.ok(source, `import « ${spec} » de layout.tsx : fichier introuvable, ce test ne verifierait rien`);

    if (/^\s*["']use client["']/m.test(readFileSync(source, "utf8"))) {
      fautes.push(`${spec} porte « use client »`);
    }
  }

  assert.deepEqual(
    fautes,
    [],
    "Une valeur partagee entre le serveur et le client doit vivre dans un module SANS directive, " +
      "que les deux cotes importent (voir src/lib/theme.ts).",
  );
});

test("le script de pre-peinture embarque la clef reelle", () => {
  // Verrouille le lien entre la clef et le script : ils ne peuvent pas diverger
  // puisque le script est construit a partir de la constante. Ce test echoue si
  // quelqu'un recopie la clef en dur dans le script.
  const source = readFileSync(join(root, "lib/theme.ts"), "utf8");
  assert.match(source, /THEME_PREPAINT_SCRIPT[\s\S]*buildThemeScript\(SETTINGS_STORAGE_KEY\)/);
  assert.doesNotMatch(source, /^\s*["']use client["']/m, "src/lib/theme.ts doit rester lisible par le serveur");
});
