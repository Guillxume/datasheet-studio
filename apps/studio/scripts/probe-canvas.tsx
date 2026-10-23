/**
 * Sonde visuelle du canvas de l'editeur.
 *
 * A QUOI CA SERT. Le canvas est le seul endroit du Studio qu'aucun test ne peut
 * atteindre : il vit dans le navigateur, dans Puck. Cette sonde le rend hors
 * navigateur — arbre de template + contexte `puck.isEditing` + feuille de
 * l'editeur — puis demande une capture au Chromium de Gotenberg, deja present pour
 * produire les PDF. On peut donc VOIR l'effet d'une modification du chassis de
 * canvas sans piloter de navigateur, et comparer deux etats.
 *
 * CE QU'ELLE N'EST PAS. Une reproduction de Puck. Elle mime ce que Puck passe aux
 * blocs (props brutes, slots exposes en composants, contexte `puck`) mais ne
 * fournit ni ses enveloppes de glisser-deposer, ni les attributs
 * `data-puck-component` qu'il pose par effet. Les reperes, la geometrie, les
 * placeholders et la typographie sont fideles ; la selection et la mesure ne
 * peuvent pas etre eprouvees ici.
 *
 * Usage :
 *   pnpm probe-canvas                                   # corps, profil typique
 *   PROFILE=dense pnpm probe-canvas
 *   ZONE=header pnpm probe-canvas
 *   MODE=tokens pnpm probe-canvas
 *   TEMPLATE=docs/exemple-bandeaux.json ZONE=footer pnpm probe-canvas
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildEditorConfig } from "@/blocks/previewConfig";
import { datasheetConfig } from "@/blocks/registry";
import { prepareData } from "@/lib/prepare";
import { buildSampleData } from "@/lib/sampleData";
import { DEFAULT_SAMPLE_PROFILE, isSampleProfileId } from "@/lib/sampleProfiles";
import { PRINT_ELEMENT_CSS, PRINT_TYPOGRAPHY } from "@/lib/printCss";
import { loadEnv } from "./_env";

loadEnv();

type Node = { type: string; props?: Record<string, unknown> };

const OUT_DIR = process.env.OUT_DIR ?? "/tmp/datasheet-canvas";
const TEMPLATE = process.env.TEMPLATE ?? "docs/exemple-template-02.json";
const ZONE = process.env.ZONE ?? "body";
const MODE = process.env.MODE === "tokens" ? "tokens" : "preview";
const PROFILE = isSampleProfileId(process.env.PROFILE) ? process.env.PROFILE : DEFAULT_SAMPLE_PROFILE;
const GOTENBERG = process.env.GOTENBERG_URL ?? "http://localhost:3100";

const data = prepareData(buildSampleData(undefined, PROFILE), new Map(), "inline", "fr").data;

// Cette sonde rend les blocs hors de `<Puck>` : les overrides du canvas
// (le pont d'actions de conteneur) n'ont rien a y faire, d'ou la config seule.
const { config } = buildEditorConfig(datasheetConfig, { mode: MODE, data, zone: ZONE }) as unknown as {
  config: {
    components: Record<
      string,
      { render: (props: Record<string, unknown>) => ReactNode; fields?: Record<string, { type?: string }> }
    >;
    root: { render: (props: Record<string, unknown>) => ReactNode; defaultProps?: Record<string, unknown> };
  };
};

const template = JSON.parse(readFileSync(TEMPLATE, "utf8")) as {
  body?: { root?: { props?: Record<string, unknown> }; content?: Node[] };
  header?: { content?: Node[] } | null;
  footer?: { content?: Node[] } | null;
};

const rootProps = { ...config.root.defaultProps, ...(template.body?.root?.props ?? {}) };

const puck = {
  isEditing: true,
  metadata: {
    zone: ZONE,
    reservedMm:
      ZONE === "header"
        ? Number(rootProps.marginTop ?? 32)
        : ZONE === "footer"
          ? Number(rootProps.marginBottom ?? 22)
          : 0,
    pageWidth: Number(rootProps.pageWidth ?? 210),
    marginLeft: Number(rootProps.marginLeft ?? 0),
    marginRight: Number(rootProps.marginRight ?? 0),
    hasHeader: (template.header?.content?.length ?? 0) > 0,
    hasFooter: (template.footer?.content?.length ?? 0) > 0,
  },
};

/** Mime Puck : props brutes, slots exposes en composants, contexte `puck`. */
function renderNode(node: Node, key: number): ReactNode {
  const entry = config.components[node.type];
  if (!entry) return null;

  const props: Record<string, unknown> = { ...node.props, puck };

  for (const [name, field] of Object.entries(entry.fields ?? {})) {
    if (field?.type !== "slot") continue;
    const children = Array.isArray(props[name]) ? (props[name] as Node[]) : [];
    props[name] = () => createElement("div", null, ...children.map(renderNode));
  }

  return createElement(entry.render as never, { key, ...props });
}

const zoneTree =
  ZONE === "body" ? template.body : ZONE === "header" ? template.header : template.footer;
const content = Array.isArray(zoneTree?.content) ? zoneTree.content : [];

const markup = renderToStaticMarkup(
  createElement(config.root.render as never, {
    ...rootProps,
    puck,
    children: createElement("div", null, ...content.map(renderNode)),
  })
);

// La feuille de l'editeur et celle de l'application sont lues sur le disque : la
// sonde ne peut donc pas montrer un canvas different de celui de l'editeur.
const editorCss = readFileSync("src/app/editor/[scope]/[slug]/editor.css", "utf8");
const globalCss = readFileSync("src/app/globals.css", "utf8");

const shop = (data as { shop?: { colors?: Record<string, string> } }).shop;

/**
 * La barre de mesure de l'editeur, executee DANS le Chromium de la capture.
 *
 * C'est le seul moyen d'eprouver measure.ts : il lit un layout, donc il exige un
 * moteur de rendu. Le code est celui de l'editeur, compile a la volee — pas une
 * transcription, qui pourrait etre juste la ou l'original serait faux.
 *
 * Les attributs `data-puck-component` sont poses ici : dans l'editeur c'est Puck
 * qui le fait, par effet, sur l'element racine de chaque bloc.
 */
const measureBundle = buildSync({
  entryPoints: ["src/app/editor/[scope]/[slug]/measure.ts"],
  bundle: true,
  format: "iife",
  globalName: "DsMeasure",
  write: false,
  logLevel: "silent",
}).outputFiles[0].text;

const measureScript = `
${measureBundle}
(function () {
  var container = document.querySelector(".ds-canvas-content") || document.querySelector(".ds-marginbox-canvas");
  if (!container) return;
  var wrapper = Array.prototype.find.call(container.children, function (el) {
    return !el.classList.contains("ds-page-markers");
  });
  if (wrapper) {
    Array.prototype.forEach.call(wrapper.children, function (el, index) {
      el.setAttribute("data-puck-component", "probe-" + index);
    });
  }
  var result = DsMeasure.measureCanvas(document.body, function (id) { return id; });
  var banner = document.createElement("pre");
  // Pose EN TETE du document et dans le flux, et non en position fixe : une
  // seconde capture cadree sur le viewport doit pouvoir la lire seule.
  banner.style.cssText = "margin:0;padding:8px 12px;background:#0f172a;color:#7ee787;font:16px/1.5 ui-monospace,monospace;white-space:pre-wrap";
  banner.textContent = JSON.stringify(result, null, 1);
  document.body.insertBefore(banner, document.body.firstChild);
})();
`;

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>
${globalCss}
${editorCss}
.ds-page-sheet { ${PRINT_TYPOGRAPHY} ${PRINT_ELEMENT_CSS} }
body {
  --ds-zoom: ${process.env.ZOOM ?? "1"};
  --color-primary: ${shop?.colors?.primary ?? "#1a1a1a"};
  --color-secondary: ${shop?.colors?.secondary ?? "#666666"};
  color-scheme: light;
}
</style></head><body>${markup}<script>${measureScript}</script></body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const stem = `${OUT_DIR}/${ZONE}-${MODE}-${PROFILE}`;
writeFileSync(`${stem}.html`, html);

async function screenshot(width: string, height: string, clip: boolean): Promise<Buffer | null> {
  const form = new FormData();
  form.append("files", new Blob([html], { type: "text/html" }), "index.html");
  form.append("format", "png");
  form.append("width", width);
  form.append("height", height);
  // clip=false capture toute la hauteur du document ; clip=true, le seul viewport.
  form.append("clip", clip ? "true" : "false");
  form.append("emulatedMediaType", "screen");

  const response = await fetch(`${GOTENBERG.replace(/\/$/, "")}/forms/chromium/screenshot/html`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    console.error(`Gotenberg ${response.status} : ${(await response.text()).slice(0, 500)}`);
    return null;
  }

  return Buffer.from(await response.arrayBuffer());
}

async function capture(): Promise<void> {
  const full = await screenshot(process.env.WIDTH ?? "1000", process.env.HEIGHT ?? "1400", false);
  if (full === null) {
    console.log(`HTML tout de meme ecrit : ${stem}.html`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(`${stem}.png`, full);

  // Cadrage sur le viewport : la seule facon de lire la barre de mesure seule,
  // une capture pleine hauteur la rendant illisible apres reduction.
  const banner = await screenshot("760", process.env.BANNER_HEIGHT ?? "330", true);
  if (banner !== null) writeFileSync(`${stem}-mesure.png`, banner);

  console.log(`${content.length} blocs · profil ${PROFILE} · zone ${ZONE} · mode ${MODE}`);
  console.log(`${stem}.png`);
  console.log(`${stem}-mesure.png`);
  console.log(`${stem}.html`);
}

void capture();
