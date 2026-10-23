import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildEditorConfig, containerHasContent, strayRootBlockMove } from "./previewConfig";
import { datasheetConfig } from "./registry";
import { productSchema } from "@/lib/payload";

/** Champs REELLEMENT declares pour un produit — la source de verite des tokens. */
const PRODUCT_FIELDS = productSchema.shape;

/**
 * Ce qui est verrouille ici est la reponse au defaut d'UX qui a motive ce module :
 * dans l'editeur, les blocs alimentes par une source de donnees ne recevaient pas
 * les donnees, rendaient `<></>` — donc RIEN — et occupaient pourtant la moitie
 * d'une page dans le PDF. Impossible de composer une fiche dans ces conditions.
 *
 * Deux garanties a tenir :
 *   1. en mode apercu, un bloc alimente rend son contenu reel ;
 *   2. un bloc qui ne produira rien rend un placeholder qui DIT pourquoi, sinon
 *      il redevient invisible et inselectionnable.
 */

const DATA = {
  product: { name: "Transpalette 2500 kg", sku: "TPM-2500" },
  features: [
    { name: "Capacite de charge", value: "2500 kg", abbreviation: "Q" },
    { name: "Poids net", value: "78 kg", abbreviation: null },
  ],
  images: [{ src: "data:image/png;base64,AAA", legend: "Vue" }],
  badges: ["ce", "tuv"],
  schema_image: null,
};

type Entry = { render: (props: Record<string, unknown>) => unknown };

function build(mode: "preview" | "tokens", zone = "body") {
  return buildEditorConfig(datasheetConfig, { mode, data: DATA, zone }).config as unknown as {
    components: Record<string, Entry>;
    root: { fields?: Record<string, unknown> };
  };
}

function markup(node: unknown): string {
  return renderToStaticMarkup(node as ReactElement);
}

test("en mode apercu, le tableau de caracteristiques rend les donnees reelles", () => {
  const config = build("preview");
  // Exactement ce que Puck passe : le token, pas le tableau.
  const html = markup(config.components.FeatureTable.render({ source: "{{features}}" }));

  assert.match(html, /<table/, "le tableau doit etre rendu, et non efface");
  assert.match(html, /Capacite de charge/);
  assert.match(html, /2500 kg \(Q\)/, "l'abreviation reste collee a sa valeur");
});

test("un champ texte est interpole avec les donnees du profil", () => {
  const config = build("preview");
  const html = markup(config.components.Heading.render({ text: "{{product.name}}", level: "h2" }));

  assert.match(html, /Transpalette 2500 kg/);
});

test("un bloc sans donnee rend un placeholder qui nomme la cause", () => {
  const config = build("preview");
  // Ce produit n'a pas de schema cote : le bloc s'effacerait au rendu.
  const html = markup(config.components.SchemaImage.render({ source: "{{schema_image.src}}" }));

  assert.match(html, /absent du PDF/, "le placeholder doit dire que le bloc ne sortira pas");
  assert.match(html, /schéma coté/i, "et pourquoi");
});

test("le placeholder d'une galerie designe le reglage fautif", () => {
  const config = build("preview");
  // Une seule image disponible, et le reglage par defaut ignore la premiere.
  const html = markup(config.components.ImageGallery.render({ source: "{{images}}", skip: 1, limit: 4 }));

  assert.match(html, /Ignorer les 1 premières images/, "le message doit citer le reglage");
  // L'apostrophe est echappee par le rendu : on ne l'inclut pas dans le motif.
  assert.match(html, /a que 1\./, "et le nombre d'images reellement disponibles");
});

test("un bandeau de pictos sans correspondance dit que la liste est vide", () => {
  const config = build("preview");
  // Le piege le plus courant : des badges arrivent, mais aucune regle ne les mappe.
  const html = markup(config.components.BadgeRow.render({ source: "{{badges}}", mapping: [] }));

  assert.match(html, /correspondance badge \/ picto/);
});

test("le saut de page recoit une representation visible", () => {
  const config = build("preview");
  // Il ne rend qu'une regle CSS d'impression : sans cela, bloc de hauteur nulle,
  // invisible et inselectionnable.
  const html = markup(config.components.PageBreak.render({}));

  assert.match(html, /saut de page forcé/);
});

test("en mode tokens, aucune resolution : le token reste lisible et editable", () => {
  const config = build("tokens");
  const html = markup(config.components.Heading.render({ text: "{{product.name}}", level: "h2" }));

  assert.match(html, /\{\{product\.name\}\}/);
});

test("en mode tokens, un bloc sans champ editable recoit aussi les donnees resolues", () => {
  // FeatureTable n'a pas de champ contentEditable : un token brut ("{{features}}")
  // n'y a aucune representation sensee. Sans resolution, le tableau rendait <></> —
  // invisible en mode Tokens exactement comme le bloc l'etait jadis en mode Apercu.
  const config = build("tokens");
  const html = markup(config.components.FeatureTable.render({ source: "{{features}}" }));

  assert.match(html, /<table/, "resolu meme en mode tokens, sinon le token brut l'efface");
  assert.match(html, /Capacite de charge/);
});

test("en mode tokens, un bloc sans donnee recoit le meme placeholder qu'en mode apercu", () => {
  const config = build("tokens");
  const html = markup(config.components.SchemaImage.render({ source: "{{schema_image.src}}" }));

  assert.match(html, /absent du PDF/, "meme garde-fou qu'en mode Apercu, pas seulement en mode Apercu");
});

test("en mode apercu, contentEditable est retire des champs", () => {
  // Puck remplace la valeur d'un champ contentEditable par un element React :
  // aucun token n'y serait resolu, et une saisie ecraserait le token par le texte
  // du produit d'exemple.
  const preview = buildEditorConfig(datasheetConfig, { mode: "preview", data: DATA, zone: "body" }).config;
  const tokens = buildEditorConfig(datasheetConfig, { mode: "tokens", data: DATA, zone: "body" }).config;

  const field = (config: unknown, block: string, name: string) =>
    (config as { components: Record<string, { fields: Record<string, { contentEditable?: boolean }> }> })
      .components[block].fields[name].contentEditable;

  assert.equal(field(preview, "Heading", "text"), false);
  assert.equal(field(tokens, "Heading", "text"), true, "le mode tokens doit le conserver");
});

test("les reglages de geometrie disparaissent hors de l'onglet du corps", () => {
  // Ils sont lus sur l'arbre du CORPS au rendu : les proposer en editant un
  // bandeau donnait un panneau dont aucune modification n'avait d'effet.
  assert.deepEqual(build("preview", "header").root.fields, {});
  assert.ok(Object.keys(build("preview", "body").root.fields ?? {}).includes("pageHeight"));
});

/**
 * `containerHasContent` decide, seule, si la suppression d'un conteneur
 * (Colonnes, Panneau, Element positionne) doit etre confirmee. Une erreur ici
 * supprimerait silencieusement du contenu compose sans avertissement, ou
 * inversement demanderait une confirmation inutile pour un conteneur vide.
 */
test("containerHasContent : un conteneur sans le champ demande n'a pas de contenu", () => {
  assert.equal(containerHasContent({ props: {} }, ["content"]), false);
});

test("containerHasContent : un slot vide n'est pas du contenu", () => {
  assert.equal(containerHasContent({ props: { content: [] } }, ["content"]), false);
});

test("containerHasContent : un seul bloc dans un slot suffit", () => {
  assert.equal(
    containerHasContent({ props: { content: [{ type: "Text", props: {} }] } }, ["content"]),
    true
  );
});

test("containerHasContent : Colonnes avec seulement la colonne de droite remplie", () => {
  assert.equal(
    containerHasContent(
      { props: { left: [], right: [{ type: "FeatureTable", props: {} }], third: [] } },
      ["left", "right", "third"]
    ),
    true
  );
});

test("containerHasContent : item introuvable (id perime) ne demande pas de confirmation", () => {
  assert.equal(containerHasContent(null, ["content"]), false);
  assert.equal(containerHasContent(undefined, ["content"]), false);
});

test("le canvas est enveloppe par le pont d'actions de conteneur (overrides.preview)", () => {
  // `ContainerActionsBridge` appelle usePuck() et exige donc un vrai <Puck> —
  // le monter ici serait disproportionne pour ce seul test. On verifie donc la
  // STRUCTURE de l'element retourne (sans le rendre) : le point d'extension
  // existe, et les enfants du canvas lui sont bien transmis sans etre perdus.
  const { overrides } = buildEditorConfig(datasheetConfig, {
    mode: "preview",
    data: DATA,
    zone: "body",
  });
  assert.equal(typeof overrides.preview, "function");

  const probe = { type: "div", props: { children: "sonde" } } as unknown as ReactElement;
  const wrapped = overrides.preview({ children: probe }) as ReactElement;
  assert.equal(typeof wrapped.type, "function", "doit envelopper dans un composant (ContainerActionsBridge)");
  assert.equal(
    (wrapped.props as { children?: unknown }).children,
    probe,
    "les enfants du canvas doivent traverser le pont sans etre remplaces"
  );
});

/**
 * CE QUE LE TEST PRECEDENT NE VOYAIT PAS, ET QUI A COUTE UNE FONCTIONNALITE.
 *
 * Il verifiait que l'objet `overrides` est bien FABRIQUE. Il ne pouvait pas voir
 * qu'il n'etait jamais BRANCHE : `buildEditorConfig` le rangeait dans l'objet de
 * configuration, alors que `overrides` est une prop de `<Puck>`. Puck ignorait
 * ce champ inconnu sans un mot, `ContainerActionsBridge` n'etait jamais monte,
 * et les quatre actions du canvas — selectionner, dupliquer, supprimer un
 * conteneur, ajouter une page — ne faisaient rien. Constate dans un navigateur
 * avec le code reel : avant correction, un clic sur « Ajouter une page » ne
 * declenchait meme pas `onChange` ; apres, le bloc PageBreak est insere.
 *
 * Aucun test de fonction pure ne peut voir un cablage manquant. Les deux cas
 * ci-dessous lisent donc la SOURCE de l'appelant. C'est inhabituel et assume :
 * c'est le seul controle automatique possible ici, ce projet n'embarquant pas
 * de navigateur de test.
 */
const EDITOR_CLIENT = readFileSync(
  new URL("../app/editor/[scope]/[slug]/EditorClient.tsx", import.meta.url),
  "utf8"
);

test("CABLAGE : l'editeur passe les overrides a <Puck>, pas seulement la config", () => {
  // La BALISE JSX, pas les commentaires qui la mentionnent : « <Puck » suivi
  // d'un blanc puis d'un saut de ligne, jusqu'a la fermeture de la balise.
  const balise = /<Puck\s*\n[\s\S]*?\/>/.exec(EDITOR_CLIENT)?.[0];
  assert.ok(balise, "impossible de trouver la balise <Puck> dans EditorClient.tsx");

  assert.match(
    balise,
    /overrides=\{/,
    "sans cette prop, le pont d'actions du canvas n'est jamais monte et ses boutons sont inertes"
  );
});

test("CABLAGE : la configuration ne porte plus d'overrides, que Puck ignorerait", () => {
  const { config } = buildEditorConfig(datasheetConfig, {
    mode: "preview",
    data: DATA,
    zone: "body",
  });
  assert.equal(
    (config as unknown as { overrides?: unknown }).overrides,
    undefined,
    "un `overrides` dans la config est du code mort qui a l'air branche"
  );
});

/**
 * HTML depose dans un bloc de TEXTE BRUT — le cas remonte depuis le studio.
 *
 * Le bloc « Paragraphe » echappe son contenu, par construction : une
 * description PrestaShop collee dedans sort avec ses balises visibles dans le
 * PDF. Mesure faite sur le rendu reel avant d'ecrire ces cas : le meme contenu
 * donne `&lt;p&gt;...` par « Paragraphe » et `<p>...` par « Texte riche ».
 *
 * Rien n'est casse — c'est justement pour cela que ca passe inapercu jusqu'au
 * PDF. D'ou un avertissement qui laisse le rendu reel visible dessous, et non
 * un placeholder qui le remplacerait.
 */
const DESCRIPTION_HTML =
  '<p>Le <strong>fauteuil vieux rose</strong> se distingue.</p><p>Voir <a href="https://exemple.fr/x.html">le siege</a>.</p>';

test("le bloc Texte riche met bien le HTML en forme", () => {
  const config = build("preview");
  const html = markup(config.components.RichText.render({ html: DESCRIPTION_HTML }));

  assert.match(html, /<strong>fauteuil vieux rose<\/strong>/, "les balises doivent etre interpretees");
  assert.doesNotMatch(html, /&lt;strong&gt;/);
});

test("du HTML dans un Paragraphe est signale, sans masquer le rendu reel", () => {
  const config = build("preview");
  const html = markup(config.components.Text.render({ content: DESCRIPTION_HTML }));

  assert.match(html, /Texte riche \(HTML\)/, "l'avertissement doit nommer le bloc a utiliser");
  assert.match(html, /&lt;p&gt;/, "le rendu reel — balises echappees — reste visible dessous");
  assert.doesNotMatch(html, /data-ds-void/, "ce bloc SORT : il doit continuer de compter dans la pagination");
});

test("un texte ordinaire n'est pas signale", () => {
  // Le motif exige un nom de balise : une comparaison ne doit rien declencher.
  const config = build("preview");
  const html = markup(config.components.Text.render({ content: "Largeur < 5 mm et a < b, voir p. 3" }));

  assert.doesNotMatch(html, /ds-warn/);
});

test("du HTML DEJA echappe a la source est signale, y compris en Texte riche", () => {
  // Cause differente, correction differente : aucun bloc ne le mettra en forme,
  // c'est le champ envoye par la boutique qu'il faut corriger.
  const config = build("preview");
  const riche = markup(config.components.RichText.render({ html: "&lt;p&gt;deja echappe&lt;/p&gt;" }));

  assert.match(riche, /déjà échappé à la source/);
});

test("le champ a tester d'une page conditionnelle propose un token QUI EXISTE", () => {
  // Un placeholder nommant un champ absent du payload fait ecrire une condition
  // jamais remplie, donc une page qui ne sort jamais — sans le moindre message.
  const config = build("preview") as unknown as {
    components: Record<string, { fields?: Record<string, { placeholder?: string }> }>;
  };

  for (const bloc of ["Page", "PageBreak"]) {
    const propose = config.components[bloc].fields?.onlyIf?.placeholder ?? "";
    const champ = /\{\{product\.(\w+)\}\}/.exec(propose)?.[1];
    assert.ok(champ, `${bloc} : le placeholder doit proposer un token produit`);
    assert.ok(
      Object.keys(PRODUCT_FIELDS).includes(champ),
      `${bloc} : « ${champ} » n'existe pas dans productSchema`
    );
  }
});

/**
 * `strayRootBlockMove` range un bloc lache hors de toute page — entre deux
 * feuilles, ou sous la derniere. Sans lui, le bloc restait orphelin a la racine
 * et le rechargement rangeait le corps ENTIER, Pages comprises, dans une page.
 */
const page = (id: string, content: unknown[] = []) => ({ type: "Page", props: { id, content } });
const bloc = (id: string) => ({ type: "Text", props: { id } });

test("strayRootBlockMove : un corps fait de pages n'a rien a ranger", () => {
  assert.equal(strayRootBlockMove([page("p1"), page("p2")]), null);
});

test("strayRootBlockMove : un bloc lache sous une page rejoint la FIN de cette page", () => {
  assert.deepEqual(strayRootBlockMove([page("p1", [bloc("a"), bloc("b")]), bloc("x"), page("p2")]), {
    sourceIndex: 1,
    destinationZone: "p1:content",
    destinationIndex: 2,
  });
});

test("strayRootBlockMove : un bloc lache avant la premiere page rejoint son DEBUT", () => {
  assert.deepEqual(strayRootBlockMove([bloc("x"), page("p1", [bloc("a")])]), {
    sourceIndex: 0,
    destinationZone: "p1:content",
    destinationIndex: 0,
  });
});

test("strayRootBlockMove : sans aucune page, rien a faire (normalizeBodyTree s'en charge)", () => {
  assert.equal(strayRootBlockMove([bloc("x")]), null);
});
