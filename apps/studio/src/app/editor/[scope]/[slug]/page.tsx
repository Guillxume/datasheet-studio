import { notFound } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { requirePage } from "@/lib/guard";
import { prepareData } from "@/lib/prepare";
import { getDraft, getTemplateBySlug } from "@/lib/repository";
import { buildSampleData } from "@/lib/sampleData";
import { SAMPLE_PROFILES } from "@/lib/sampleProfiles";
import EditorClient, { type EditorTrees } from "./EditorClient";
import "./editor.css";
import { listComponentsFor } from "@/lib/componentStore";

/**
 * Le brouillon est charge COTE SERVEUR et passe au composant client.
 *
 * Cela evite une route d'API de lecture, et surtout evite l'ecran vide le temps
 * d'un aller-retour : l'editeur s'affiche deja peuple.
 */

export const dynamic = "force-dynamic";

const EMPTY = { root: { props: {} }, content: [], zones: {} } as unknown as Data;

/**
 * Jeux de donnees d'exemple du canvas, prepares ICI, cote serveur.
 *
 * Deux raisons, et la seconde est la plus importante :
 *
 *  1. `buildSampleData` inline ses images avec `Buffer`, indisponible dans le
 *     navigateur ;
 *  2. `prepareData` est exactement ce que traverse un payload de production —
 *     assainissement des champs *_html, formatage du prix. Preparer les donnees
 *     du canvas par un autre chemin ferait afficher un prix non formate a l'ecran
 *     et formate dans le PDF, c'est-a-dire recreer la divergence qu'on cherche a
 *     supprimer.
 */
function buildSamples(): Record<string, unknown> {
  const samples: Record<string, unknown> = {};

  for (const profile of SAMPLE_PROFILES) {
    samples[profile.id] = prepareData(buildSampleData(undefined, profile.id), new Map(), "inline", "fr").data;
  }

  return samples;
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ scope: string; slug: string }>;
}) {
  /*
   * templates:write et non templates:read : ouvrir l'editeur, c'est deja
   * pouvoir enregistrer. Un importateur qui veut VOIR un template passe par
   * l'apercu de l'accueil ou de la page d'import — meme moteur de rendu, mais
   * sans arbre modifiable a l'ecran.
   */
  await requirePage("templates:write");

  const { scope, slug } = await params;
  const shopSlug = scope === "shared" ? null : decodeURIComponent(scope);

  const template = await getTemplateBySlug(decodeURIComponent(slug), shopSlug);
  if (!template) {
    notFound();
  }

  const draft = await getDraft(template.id);

  // Les composants que ce template peut citer. Inutile quand on compose un
  // composant : le bloc « Composant » n'y est pas propose.
  const components = template.kind === "component" ? [] : await listComponentsFor(shopSlug);

  const initial: EditorTrees = {
    body: (draft.body ?? EMPTY) as Data,
    header: (draft.header ?? EMPTY) as Data,
    footer: (draft.footer ?? EMPTY) as Data,
  };

  return (
    <EditorClient
      scope={scope}
      slug={template.slug}
      name={template.name}
      initial={initial}
      css={draft.css}
      settings={draft.settings}
      publishedVersion={template.published_version}
      draftVersion={template.draft_version}
      samples={buildSamples()}
      kind={template.kind}
      components={components}
    />
  );
}
