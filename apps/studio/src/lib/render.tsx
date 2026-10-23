import type { ReactElement, ReactNode } from "react";
import { datasheetConfig } from "@/blocks/registry";
import { resolveValue } from "./bind";
import { mergeBlockProps } from "./blockProps";
import { prepareData } from "./prepare";
import { buildDocument, cssColor, styleElement } from "./html";
import { STUDIO_ASSET, collectCssAssetRefs, inlineCssAssets } from "./cssAssets";
import { partitionAssetRefs, RENDER_SCOPE_ANY } from "./assetScope";
import { normalizeBodyTree } from "./pages";
import { A4_PORTRAIT, htmlToPdf, type PageGeometry } from "./gotenberg";
import type { Asset, AssetBag, AssetMode } from "./assets";
import { readAssetInlined } from "./assetStore";
import {
  attachRemoteImages,
  fetchRemoteImages,
  findRemoteImageUrls,
  inlineRemoteImages,
} from "./remoteImages";

/**
 * Pipeline de rendu : arbre de template + payload -> PDF.
 *
 *   1. prepareData : asset:// -> chemin ou data URI, *_html -> assaini
 *   2. renderNode  : arbre Puck -> React, en resolvant les tokens des props
 *   3. Gotenberg   : HTML -> PDF via Chromium
 *
 * Le format de donnees consomme est celui de Puck, donc l'editeur produit
 * directement ce que ce module consomme. Mais le RENDU n'utilise pas le
 * composant <Render> de Puck, et c'est deliberé — voir plus bas.
 */

type StaticMarkupFn = (element: ReactElement) => string;

/**
 * react-dom/server charge a l'execution, hors analyse du bundler.
 *
 * Next bundle les route handlers dans la couche "react-server", ou la condition
 * d'export du meme nom fait pointer tous les points d'entree react-dom/server.*
 * vers un stub vide. Ni l'import statique ni createRequire ne fonctionnent :
 * le premier resout le stub, le second est trace par Turbopack ("expression is
 * too dynamic"). L'annotation turbopackIgnore / webpackIgnore laisse Node
 * resoudre, avec les conditions node + import.
 *
 * CONSEQUENCE STRUCTURANTE : ce react-dom/server embarque SON instance de
 * React, distincte du react bundle. Les elements React se traversent sans
 * probleme entre instances (les symboles sont dans le registre global), mais
 * PAS les hooks — le dispatcher appartient a une instance et n'est pas visible
 * depuis l'autre. C'est pourquoi aucun bloc du registry n'utilise de hook, et
 * pourquoi on n'utilise pas <Render> de Puck, qui en appelle (useMemo).
 * Introduire un hook dans un bloc casserait le rendu avec l'erreur peu
 * parlante « Cannot read properties of null (reading 'useMemo') ».
 */
let rendererPromise: Promise<StaticMarkupFn> | null = null;

function loadStaticRenderer(): Promise<StaticMarkupFn> {
  if (!rendererPromise) {
    rendererPromise = import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ "react-dom/server.node"
    ).then((mod: unknown) => {
      const candidate = mod as {
        renderToStaticMarkup?: StaticMarkupFn;
        default?: { renderToStaticMarkup?: StaticMarkupFn };
      };
      // Module CJS : selon la detection des exports nommes par Node, la
      // fonction est exposee a plat ou sous default.
      const fn = candidate.renderToStaticMarkup ?? candidate.default?.renderToStaticMarkup;
      if (!fn) {
        throw new Error("renderToStaticMarkup introuvable dans react-dom/server.node");
      }
      return fn;
    });
  }
  return rendererPromise;
}

// --------------------------------------------------------------------------
// Parcours de l'arbre Puck
// --------------------------------------------------------------------------

type PuckNode = { type: string; props?: Record<string, unknown> };

export type PuckTree = {
  root?: { props?: Record<string, unknown> };
  content?: PuckNode[];
  zones?: Record<string, PuckNode[]>;
};

export type TemplateTrees = {
  body: PuckTree;
  header?: PuckTree | null;
  footer?: PuckTree | null;
  css?: string | null;
  geometry?: Partial<PageGeometry> | null;
};

type ComponentEntry = {
  render: (props: Record<string, unknown>) => ReactNode;
  defaultProps?: Record<string, unknown>;
  fields?: Record<string, { type?: string }>;
};

const components = datasheetConfig.components as unknown as Record<string, ComponentEntry>;
const rootEntry = datasheetConfig.root as unknown as ComponentEntry | undefined;

// STUDIO_ASSET vit desormais dans ./cssAssets, avec les fonctions qui l'utilisent
// pour les feuilles de style : une seule definition de la forme d'une reference.

/**
 * Remplace les references a la bibliotheque du Studio (/assets/...) par des
 * data URI, lues en base au moment du rendu.
 *
 * Deux raisons, toutes deux verifiees :
 *
 *  1. UN SEUL MECANISME. Les zones repetees (header.html / footer.html) ne
 *     peuvent DE TOUTE FACON pas referencer une image autrement qu'en data URI :
 *     Chromium les rend dans un contexte de document separe qui ne resout ni les
 *     chemins relatifs aux fichiers joints, ni une base HTTP. Inliner partout
 *     evite d'avoir deux comportements selon la zone ou l'on place un picto.
 *
 *  2. AUCUNE DEPENDANCE RESEAU. Le rendu ne suppose aucun aller-retour de
 *     Gotenberg vers cette application, donc aucune URL de service a configurer,
 *     et un comportement identique en local et en production.
 *
 *  3. ET C'EST INDISPENSABLE DANS LES ZONES REPETEES. Chromium n'y charge AUCUNE
 *     ressource distante : verifie avec temoin, une meme URL se rend
 *     parfaitement dans le corps et donne, dans un bandeau, une image de fond
 *     absente et une icone d'image cassee. Voir src/lib/remoteImages.ts, qui
 *     applique le meme traitement aux URLs http(s).
 *
 * Note d'historique : un premier diagnostic avait conclu l'inverse, sur la foi
 * d'un test ou l'image temoin etait blanche sur fond blanc — donc invisible pour
 * une raison sans rapport. Le test refait avec une image contrastee et un temoin
 * a tranche.
 */
function inlineStudioAssets(value: unknown, assets: Map<string, string>): unknown {
  if (typeof value === "string") {
    if (!value.startsWith("/assets/")) {
      return value;
    }
    // Un asset absent devient une chaine vide : les blocs traitent deja ce cas
    // en s'effacant, plutot qu'en affichant une image cassee.
    return assets.get(value) ?? "";
  }
  if (Array.isArray(value)) {
    return value.map((item) => inlineStudioAssets(item, assets));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = inlineStudioAssets(inner, assets);
    }
    return out;
  }
  return value;
}

/** Collecte les references /assets/... presentes dans les arbres de template. */
function collectAssetRefs(value: unknown, found: Set<string>): void {
  if (typeof value === "string") {
    if (STUDIO_ASSET.test(value)) {
      found.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAssetRefs(item, found));
    return;
  }
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((inner) => collectAssetRefs(inner, found));
  }
}

async function loadStudioAssets(
  trees: TemplateTrees,
  shopScope: string
): Promise<StudioAssets> {
  const refs = new Set<string>();
  collectAssetRefs(trees.body, refs);
  collectAssetRefs(trees.header, refs);
  collectAssetRefs(trees.footer, refs);
  // La feuille du template est du texte, pas un arbre : elle a son propre
  // collecteur. Sans cette ligne, un @font-face du template ne chargeait rien.
  collectCssAssetRefs(trees.css, refs);

  const { readable, foreign } = partitionAssetRefs(refs, shopScope);

  const map = new Map<string, string>();
  const missing: string[] = [];

  // Les references etrangeres ne sont meme pas LUES : la restriction porte sur
  // l'acces, pas seulement sur l'affichage.
  for (const ref of readable) {
    const match = ref.match(STUDIO_ASSET);
    if (!match) continue;

    // `readAssetInlined` et non `readAsset` : l'encodage base64 est mis en
    // cache. Sur une generation en masse, le meme picto etait relu et reencode
    // a chaque fiche — voir le commentaire du cache dans assetStore.ts.
    const dataUri = await readAssetInlined(decodeURIComponent(match[1]), decodeURIComponent(match[2]));
    if (dataUri === null) {
      missing.push(ref);
      continue;
    }
    map.set(ref, dataUri);
  }

  return { map, missing, foreign };
}

function isNodeArray(value: unknown): value is PuckNode[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => item !== null && typeof item === "object" && typeof (item as PuckNode).type === "string"
    )
  );
}

function renderNode(
  node: PuckNode,
  data: unknown,
  key: number,
  assets: Map<string, string>
): ReactNode {
  const entry = components[node.type];
  if (!entry) {
    // Un bloc supprime du registry ne doit pas faire echouer une fiche entiere :
    // les templates publies survivent aux refontes du registry.
    return null;
  }

  // Fusion des valeurs par defaut et reparation des sources enregistrees a `[]` :
  // voir src/lib/blockProps.ts, partage avec le canvas de l'editeur pour que les
  // deux chemins ne puissent pas preparer les props differemment.
  const merged = mergeBlockProps(node.props, entry.defaultProps);

  // Les slots sont extraits avant resolution : leur contenu est de la structure
  // d'arbre, pas de la donnee. Le type de champ declare fait autorite plutot
  // qu'une inspection de forme, qui confondrait un champ "array" avec un slot.
  const slots: Record<string, PuckNode[]> = {};
  for (const [name, field] of Object.entries(entry.fields ?? {})) {
    if (field?.type === "slot") {
      const value = merged[name];
      slots[name] = isNodeArray(value) ? value : [];
      delete merged[name];
    }
  }

  // Les images distantes ne sont PAS traitees ici mais dans le document final :
  // voir src/lib/remoteImages.ts.
  const props = inlineStudioAssets(resolveValue(merged, data), assets) as Record<string, unknown>;

  for (const [name, children] of Object.entries(slots)) {
    // Puck expose un slot comme un composant, appele <Left /> dans le bloc.
    props[name] = () => <>{children.map((child, index) => renderNode(child, data, index, assets))}</>;
  }

  const Component = entry.render;
  return <Component key={key} {...props} />;
}

/**
 * @param applyRoot false pour les zones repetees.
 *
 * La racine porte la geometrie de page, la marge interieure du CORPS et les
 * reperes de saut de page de l'editeur : trois choses qui n'ont aucun sens dans
 * un en-tete ou un pied de page. L'appliquer la injectait une marge horizontale
 * de 12 mm par defaut, qui empechait tout bandeau d'aller bord a bord — sans que
 * rien ne l'indique, puisque la racine de ces arbres est vide.
 */
function renderTree(
  tree: PuckTree,
  data: unknown,
  assets: Map<string, string>,
  applyRoot = true
): ReactElement {
  const content = Array.isArray(tree?.content) ? tree.content : [];
  const children = <>{content.map((node, index) => renderNode(node, data, index, assets))}</>;

  if (!applyRoot || !rootEntry?.render) {
    return children;
  }

  const rootProps = inlineStudioAssets(
    resolveValue(mergeBlockProps(tree?.root?.props, rootEntry.defaultProps), data),
    assets
  ) as Record<string, unknown>;

  const Root = rootEntry.render;
  return <Root {...rootProps}>{children}</Root>;
}

/**
 * Document autonome pour les zones repetees (header.html / footer.html).
 *
 * Chromium les rend dans un contexte tres contraint, dont trois regles ont ete
 * etablies par mesure (voir l'historique : chaque oubli produit une degradation
 * SILENCIEUSE, sans erreur ni avertissement) :
 *
 *  1. print-color-adjust: exact est OBLIGATOIRE. Sans lui, Chromium ignore
 *     purement et simplement les couleurs de fond et de texte, et le bandeau
 *     sort en noir sur blanc. printBackground=true cote Gotenberg ne suffit pas.
 *
 *  2. Le document doit avoir UN SEUL element racine. Avec plusieurs enfants de
 *     <body>, Chromium les repartit dans ses trois emplacements
 *     gauche/centre/droite et ecrase leurs styles. D'ou le conteneur ci-dessous,
 *     qui rend la zone robuste meme si le template y place plusieurs blocs.
 *
 *  3. Cet element racine devient un item flex du conteneur de Chromium : sans
 *     width: 100% il epouse son contenu au lieu de la page.
 *
 *  4. Les MARGES PAPIER laterales doivent etre appliquees ici. Chromium ne les
 *     applique pas aux gabarits d'en-tete et de pied : ils occupent toujours
 *     toute la largeur de la feuille. Le canvas de l'editeur, lui, les montrait
 *     deja (MarginBoxCanvas les pose en padding) — un bandeau compose aligne
 *     sur le corps sortait donc colle au bord dans le PDF, et le logo s'y
 *     retrouvait tronque. Les deux surfaces se contredisaient sans qu'aucune
 *     erreur ne le signale : c'est exactement le genre d'ecart que le partage
 *     du registry existe pour empecher.
 */
function buildMarginBoxDocument(
  bodyHtml: string,
  margins: { left: number; right: number },
  colors?: { primary?: string; secondary?: string },
  templateCss?: string | null
): string {
  // Meme filtre que le document principal (buildDocument) : la couleur vient de
  // la configuration d'une boutique, et etait inseree ici telle quelle dans une
  // feuille de style.
  const primary = colors?.primary ? cssColor(colors.primary) : "#1a1a1a";
  const secondary = colors?.secondary ? cssColor(colors.secondary) : "#666666";

  // La feuille du template est injectee AVANT les regles de la bande, et non
  // apres comme dans le document principal. Ce n'est pas une inattention :
  //
  //   - ce qui suit (marges nulles, largeur 100 %, print-color-adjust) est
  //     etabli PAR MESURE et ne doit pas pouvoir etre neutralise par une regle
  //     `body` du template — voir les trois points documentes plus haut ;
  //   - ce que le template apporte d'utile ici (un @font-face, un :root qui
  //     definit --font-body) est insensible a l'ordre : une propriete
  //     personnalisee se resout au moment de son USAGE, pas de sa declaration.
  //
  // Sans cette injection, une police choisie pour le document s'appliquait au
  // corps mais pas aux bandeaux, qui restaient en Arial — un ecart de
  // typographie visible sur chaque page, entre le pied de page et le reste.
  return `<!doctype html>
<html><head><meta charset="utf-8">${styleElement(templateCss)}
<style>
:root { --color-primary: ${primary}; --color-secondary: ${secondary}; }
html, body { margin: 0; padding: 0; width: 100%; }
body { font-family: var(--font-body, Arial, Helvetica, sans-serif); font-size: 8pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ds-marginbox { width: 100%; box-sizing: border-box; padding: 0 ${margins.right}mm 0 ${margins.left}mm; }
img { display: block; }
</style></head><body><div class="ds-marginbox">${bodyHtml}</div></body></html>`;
}

export type RenderResult = {
  pdf: Buffer;
  warnings: string[];
  bodyHtml: string;
};

export type RenderInput = {
  trees: TemplateTrees;
  data: unknown;
  bag: AssetBag;
  locale: string;
  title: string;
  gotenbergUrl: string;
  /**
   * Slug de la boutique pour laquelle on rend, ou RENDER_SCOPE_ANY.
   *
   * OBLIGATOIRE, et c'est le point : le compilateur force chaque appelant a
   * decider pour quelle boutique il rend. Un champ optionnel aurait laisse
   * revenir la fuite d'assets entre sites par simple oubli.
   */
  shopScope: string;
};

// Re-exportes : les appelants du rendu n'ont pas a connaitre le decoupage
// interne, et RENDER_SCOPE_ANY se lit naturellement a cote de renderToPdf.
export { partitionAssetRefs, RENDER_SCOPE_ANY };

export type StudioAssets = {
  map: Map<string, string>;
  missing: string[];
  /** References refusees parce qu'elles appartiennent a une autre boutique. */
  foreign: string[];
};

export type RenderDocuments = {
  /** Document principal, tel qu'il part vers Chromium. */
  indexHtml: string;
  /** Corps seul, sans enveloppe : c'est ce que sert `?format=html`. */
  bodyHtml: string;
  headerHtml: string | null;
  footerHtml: string | null;
  warnings: string[];
  geometry: PageGeometry;
  assets: Asset[];
};

/**
 * Tout le rendu SAUF l'appel a Chromium.
 *
 * Extrait pour etre testable : le registry fait plus de mille neuf cents lignes de
 * mise en page et aucun test ne le rendait. En refactorant la racine, on a modifie
 * le chemin PDF sans qu'aucune assertion ne le couvre — seul un appel manuel l'a vu.
 * Voir src/lib/render.test.ts, qui compare le HTML produit a un temoin.
 *
 * @param studioAssets injecte les pictos de la bibliotheque. Par defaut ils sont
 *        lus en base ; un test en fournit une carte fixe et n'a donc besoin
 *        d'aucune base de donnees.
 */
export async function buildRenderDocuments(
  input: Omit<RenderInput, "gotenbergUrl">,
  studioAssets?: StudioAssets
): Promise<RenderDocuments> {
  const { trees, data, bag, locale, title, shopScope } = input;
  const toMarkup = await loadStaticRenderer();
  const assets = studioAssets ?? (await loadStudioAssets(trees, shopScope));

  return buildDocuments({ trees, data, bag, locale, title, toMarkup, studioAssets: assets });
}

export async function renderToPdf(input: RenderInput): Promise<RenderResult> {
  const { gotenbergUrl } = input;
  const documents = await buildRenderDocuments(input);

  const pdf = await htmlToPdf(
    {
      indexHtml: documents.indexHtml,
      headerHtml: documents.headerHtml,
      footerHtml: documents.footerHtml,
      assets: documents.assets,
      geometry: documents.geometry,
    },
    gotenbergUrl
  );

  return { pdf, warnings: documents.warnings, bodyHtml: documents.bodyHtml };
}

async function buildDocuments({
  trees,
  data,
  bag,
  locale,
  title,
  toMarkup,
  studioAssets,
  // `shopScope` est volontairement ABSENT de cette signature : a ce stade les
  // assets sont deja resolus et filtres, la portee n'a plus rien a decider.
  // L'omettre du type plutot que passer une valeur inutilisee garde vrai le fait
  // que chaque champ de la signature sert a quelque chose.
}: Omit<RenderInput, "gotenbergUrl" | "shopScope"> & {
  toMarkup: StaticMarkupFn;
  studioAssets: StudioAssets;
}): Promise<RenderDocuments> {
  const geometry = resolveGeometry(trees);

  // Le corps reference les assets en relatif (fichiers joints au multipart).
  const body = prepareData(data, bag, "relative", locale);

  /**
   * Le corps est TOUJOURS une liste de pages au rendu, y compris pour les
   * modeles enregistres avant l'introduction des pages.
   *
   * Ce n'est pas de la commodite : la racine et le bloc `Page` se partagent le
   * retrait du contenu, l'espacement entre blocs et la hauteur minimale, et
   * c'est la page qui les applique. Un corps mixte — des blocs libres a cote de
   * pages — les appliquerait deux fois pour les uns et pas du tout pour les
   * autres. La normalisation supprime le cas au lieu de le gerer.
   */
  const bodyHtml = toMarkup(
    renderTree(normalizeBodyTree(trees.body), body.data, studioAssets.map)
  );

  const colors = extractColors(body.data);

  // Voir inlineCssAssets : sans cette reecriture, une police declaree dans la
  // feuille du template ne se charge pas et le document sort en Arial. Calculee
  // une fois, elle sert au corps ET aux bandeaux, qui doivent partager la meme
  // typographie sous peine d'un ecart visible sur chaque page.
  const templateCss = inlineCssAssets(trees.css, studioAssets.map);

  const documentHtml = buildDocument({ bodyHtml, templateCss, colors, locale, title });

  // Les zones repetees exigent des data URI : voir resolveImageRef().
  const warnings = [
    ...body.warnings,
    ...studioAssets.missing.map((ref) => `asset de template introuvable : ${ref}`),
    // Formulation distincte de « introuvable » : la correction n'est pas la
    // meme. Un asset absent se televerse ; un asset etranger se retire du
    // template, ou se deplace dans la bibliotheque commune.
    ...studioAssets.foreign.map(
      (ref) => `asset d'une autre boutique ignore : ${ref} — le rendu ne lit que « shared » et sa propre portee`
    ),
  ];
  let headerHtml: string | null = null;
  let footerHtml: string | null = null;

  if (trees.header || trees.footer) {
    const inlined = prepareData(data, bag, "inline", locale);
    // Les avertissements sont identiques a ceux du corps, on ne les duplique pas.
    if (trees.header) {
      headerHtml = buildMarginBoxDocument(
        toMarkup(renderTree(trees.header, inlined.data, studioAssets.map, false)),
        geometry.margins,
        colors,
        templateCss
      );
    }
    if (trees.footer) {
      footerHtml = buildMarginBoxDocument(
        toMarkup(renderTree(trees.footer, inlined.data, studioAssets.map, false)),
        geometry.margins,
        colors,
        templateCss
      );
    }
  }

  // Images distantes : relevees dans les documents FINALS, telechargees une
  // seule fois pour les trois, puis jointes au corps et inlinees dans les
  // bandeaux. Chromium n'a aucun acces reseau. Voir src/lib/remoteImages.ts.
  const remote = await fetchRemoteImages([
    ...findRemoteImageUrls(documentHtml),
    ...(headerHtml ? findRemoteImageUrls(headerHtml) : []),
    ...(footerHtml ? findRemoteImageUrls(footerHtml) : []),
  ]);
  warnings.push(...remote.warnings);

  const bagAssets = [...bag.values()];
  const attached = attachRemoteImages(documentHtml, remote.images, new Set(bagAssets.map((asset) => asset.filename)));
  if (headerHtml) headerHtml = inlineRemoteImages(headerHtml, remote.images);
  if (footerHtml) footerHtml = inlineRemoteImages(footerHtml, remote.images);

  return {
    indexHtml: attached.markup,
    // bodyHtml reste celui de la boutique, URLs d'origine comprises : c'est ce
    // que sert `?format=html`, a afficher dans un navigateur et non dans Chromium.
    bodyHtml,
    headerHtml,
    footerHtml,
    warnings,
    geometry,
    assets: [...bagAssets, ...attached.assets],
  };
}

/**
 * Geometrie de page, par ordre de priorite :
 *   1. les props de la racine de l'arbre du corps — source de verite, editable
 *      dans l'editeur ;
 *   2. trees.geometry, issu de la colonne settings — conserve pour les templates
 *      crees avant que la geometrie ne remonte dans l'arbre ;
 *   3. A4 portrait.
 */
function resolveGeometry(trees: TemplateTrees): PageGeometry {
  const rootProps = (trees.body?.root?.props ?? {}) as Record<string, unknown>;
  const num = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  const legacy: Partial<PageGeometry> = trees.geometry ?? {};
  const legacyMargins: Partial<PageGeometry["margins"]> = legacy.margins ?? {};

  return {
    width: num(rootProps.pageWidth) ?? legacy.width ?? A4_PORTRAIT.width,
    height: num(rootProps.pageHeight) ?? legacy.height ?? A4_PORTRAIT.height,
    landscape: legacy.landscape ?? false,
    margins: {
      top: num(rootProps.marginTop) ?? legacyMargins.top ?? A4_PORTRAIT.margins.top,
      right: num(rootProps.marginRight) ?? legacyMargins.right ?? A4_PORTRAIT.margins.right,
      bottom: num(rootProps.marginBottom) ?? legacyMargins.bottom ?? A4_PORTRAIT.margins.bottom,
      left: num(rootProps.marginLeft) ?? legacyMargins.left ?? A4_PORTRAIT.margins.left,
    },
  };
}

function extractColors(data: unknown): { primary?: string; secondary?: string } | undefined {
  if (data === null || typeof data !== "object") return undefined;
  const shop = (data as { shop?: { colors?: { primary?: string; secondary?: string } } }).shop;
  return shop?.colors;
}

export type { AssetMode };
