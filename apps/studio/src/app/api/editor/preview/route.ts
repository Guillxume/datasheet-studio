import { env } from "@/lib/env";
import { GotenbergError } from "@/lib/gotenberg";
import { requireApi } from "@/lib/guard";
import { getDraft, getPublished, getTemplateBySlug } from "@/lib/repository";
import { warningsHeaders } from "@/lib/renderWarnings";
import { pdfPageCount } from "@/lib/pdf";
import { RENDER_SCOPE_ANY, renderToPdf, type TemplateTrees } from "@/lib/render";
import { expandTreesForShop, shopIdOf } from "@/lib/componentStore";
import { renderLimiter } from "@/lib/renderQueue";
import { buildSampleData } from "@/lib/sampleData";
import { DEFAULT_SAMPLE_PROFILE, isSampleProfileId } from "@/lib/sampleProfiles";
import type { AssetBag } from "@/lib/assets";

/**
 * Apercu PDF exact du brouillon en cours d'edition.
 *
 * Prend l'arbre tel qu'il est A L'ECRAN — pas la version enregistree : on veut
 * voir ce que l'on vient de modifier, pas ce qui est en base. C'est ce qui rend
 * l'apercu utile pour regler une pagination.
 *
 * Le jeu de donnees est celui de src/lib/sampleData.ts, avec des images
 * vectorielles inline : aucun asset a joindre, donc l'apercu fonctionne meme sur
 * un template neuf. Le champ `profile` choisit lequel — c'est ce qui permet
 * d'eprouver un template sur un produit hostile (40 caracteristiques, nom sur
 * trois lignes) avant qu'il ne serve a un millier de fiches.
 *
 * DEUX SOURCES D'ARBRE, et la seconde est ce qui rend l'apercu utilisable par
 * quelqu'un qui n'a pas le droit d'editer :
 *
 *   body/header/footer  l'arbre A L'ECRAN. C'est l'editeur qui appelle ainsi.
 *   template            { scope, slug, version } — l'arbre est relu en base.
 *                       C'est la page d'import, ou l'importateur choisit un
 *                       template et veut voir a quoi il ressemble avant de
 *                       lancer 400 fiches. Il ne l'a pas sous la main : il ne
 *                       peut pas ouvrir l'editeur.
 *
 * PERMISSION templates:read dans les deux cas. Un apercu ne rend que des
 * donnees d'exemple (src/lib/sampleData.ts) : il ne divulgue aucun catalogue.
 *
 * TROIS VUES, un seul chemin de rendu :
 *
 *   format=pdf     (defaut) le PDF, avec son nombre de pages en en-tete
 *   format=html    le HTML envoye a Chromium — l'outil de diagnostic quand un
 *                  bloc reste vide et que le PDF ne dit pas pourquoi
 *   format=report  les seules mesures (pages, avertissements, poids, duree), sans
 *                  transferer le document. C'est ce que consomme le controle
 *                  avant publication, qui rend le template sur chaque profil.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  template?: { scope?: string; slug?: string; version?: "published" | "draft" };
  /** Portee du template edite (« shared » ou slug de boutique) : elle choisit les composants deplies. */
  scope?: string;
  body?: unknown;
  header?: unknown;
  footer?: unknown;
  css?: string | null;
  settings?: { geometry?: unknown };
  shop?: { name?: string; colors?: { primary?: string; secondary?: string } };
  profile?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();

  let input: Body;
  try {
    input = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Corps JSON illisible." }, { status: 400 });
  }

  /*
   * DEUX PERMISSIONS, SELON CE QUE LE CORPS CONTIENT — et c'est un correctif.
   *
   * La premiere version de cette garde demandait `templates:read` pour les deux
   * chemins. C'etait trop large : le chemin arbre-libre accepte un arbre ET DU
   * CSS ARBITRAIRES, rendus par Chromium. Un importateur, dont le role est
   * precisement de ne pas modifier les templates, pouvait y injecter du CSS —
   * donc des `url()` vers le reseau interne au moment du rendu.
   *
   * La permission doit decrire ce que la route PERMET, pas la page d'ou on
   * croit qu'elle est appelee :
   *
   *   { template: {...} }  relit un template deja en base -> templates:read.
   *                        C'est l'apercu de l'accueil et de la page d'import.
   *   { body, css, ... }   compose a partir de rien -> templates:write.
   *                        C'est l'editeur, et lui seul.
   */
  const capacite = input.template ? "templates:read" : "templates:write";
  const auth = await requireApi(capacite);
  if (auth instanceof Response) return auth;

  const loaded = input.template ? await loadTrees(input.template) : null;
  if (loaded !== null && "error" in loaded) {
    return Response.json({ ok: false, error: loaded.error }, { status: loaded.status });
  }

  if (loaded === null && (input.body === undefined || input.body === null)) {
    return Response.json({ ok: false, error: "Arbre du corps manquant." }, { status: 422 });
  }

  const rawTrees =
    loaded !== null
      ? loaded.trees
      : ({
          body: input.body,
          header: input.header ?? null,
          footer: input.footer ?? null,
          css: input.css ?? null,
          geometry: (input.settings?.geometry ?? null) as TemplateTrees["geometry"],
        } as TemplateTrees);

  // Les composants cites sont deplies avec leur version PUBLIEE : l'apercu montre
  // ce que les fiches porteront. La portee est celle du template.
  const scope = input.template?.scope ?? input.scope ?? "shared";
  const trees = await expandTreesForShop(rawTrees, await shopIdOf(scope === "shared" ? null : scope));

  // Un profil inconnu retombe sur le profil courant plutot que d'echouer : la
  // liste des profils peut evoluer, et un onglet reste ouvert plus longtemps
  // qu'un deploiement.
  const profile = isSampleProfileId(input.profile) ? input.profile : DEFAULT_SAMPLE_PROFILE;

  const data = buildSampleData(input.shop, profile);
  const bag: AssetBag = new Map();

  const format = new URL(request.url).searchParams.get("format") ?? "pdf";

  // Meme sas que le rendu de production : il n'y a qu'un Gotenberg, et donner sa
  // propre reserve a l'editeur reviendrait a mentir sur la ressource. Un apercu
  // peut donc attendre pendant une generation en masse — c'est dit, plutot que
  // masque derriere un rendu qui n'arrive jamais.
  const acquired = await renderLimiter.acquire();
  if (acquired === null) {
    const { active, waiting } = renderLimiter.stats;
    return Response.json(
      {
        ok: false,
        error: "Moteur de rendu sature",
        detail: `${active} rendu(s) en cours et ${waiting} en attente, probablement une generation en masse cote boutique. Reessayer dans un instant.`,
      },
      { status: 503, headers: { "retry-after": "5" } }
    );
  }

  try {
    const result = await renderToPdf({
      trees,
      data,
      bag,
      locale: "fr",
      title: "Apercu",
      gotenbergUrl: env.gotenbergUrl,
      /*
       * Aucune restriction de portee ici, et c'est un choix a connaitre.
       *
       * L'apercu sert a REGLER un template : il doit montrer exactement ce que
       * l'arbre a l'ecran contient, y compris une reference que le rendu de
       * production refuserait. Restreindre ici masquerait le probleme au seul
       * moment ou quelqu'un le regarde.
       *
       * La contrepartie est explicite : un template de bibliotheque referencant
       * l'asset d'une boutique s'affiche NORMALEMENT dans l'editeur et sera
       * ignore en production, avec un avertissement. C'est la limite de ce
       * correctif — le controle avant publication devrait le signaler, ce qui
       * reste a faire.
       */
      shopScope: RENDER_SCOPE_ANY,
    });

    if (format === "html") {
      return new Response(result.bodyHtml, {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const pages = pdfPageCount(result.pdf);

    if (format === "report") {
      return Response.json(
        {
          ok: true,
          profile,
          pages,
          warnings: result.warnings,
          bytes: result.pdf.length,
          ms: Date.now() - started,
        },
        { headers: { "cache-control": "no-store" } }
      );
    }

    return new Response(new Uint8Array(result.pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(result.pdf.length),
        // Un apercu ne doit jamais etre mis en cache : chaque modification doit
        // produire un nouveau rendu.
        "cache-control": "no-store",
        "x-render-profile": profile,
        ...(pages === null ? {} : { "x-pdf-pages": String(pages) }),
        ...warningsHeaders(result.warnings),
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const detail = cause instanceof GotenbergError ? cause.detail : undefined;

    // Le detail de Gotenberg (CSS invalide, timeout Chromium) est ce qui permet
    // a l'integrateur de corriger son template sans deviner.
    return Response.json({ ok: false, profile, error: message, detail }, { status: 502 });
  } finally {
    acquired.slot.release();
  }
}

/**
 * Relit un template en base pour l'apercu.
 *
 * `version` distingue deux besoins reels : « ce que les boutiques recoivent en
 * ce moment » (published) et « ce que quelqu'un est en train de composer »
 * (draft). Un import lance sur le brouillon doit pouvoir etre previsualise sur
 * le brouillon, sinon l'apercu ment.
 */
async function loadTrees(
  ref: { scope?: string; slug?: string; version?: "published" | "draft" }
): Promise<{ trees: TemplateTrees } | { error: string; status: number }> {
  if (!ref.slug) {
    return { error: "template.slug est requis.", status: 422 };
  }

  const shopSlug = ref.scope === undefined || ref.scope === "shared" ? null : ref.scope;
  const template = await getTemplateBySlug(ref.slug, shopSlug);
  if (!template) {
    return { error: "Template introuvable.", status: 404 };
  }

  const stored = ref.version === "draft" ? await getDraft(template.id) : await getPublished(template.id);
  if (!stored) {
    return { error: "Ce template n'a aucune version publiee.", status: 409 };
  }

  return {
    trees: {
      body: stored.body,
      header: stored.header ?? null,
      footer: stored.footer ?? null,
      css: stored.css ?? null,
      geometry: ((stored.settings as { geometry?: unknown } | null)?.geometry ?? null),
    } as TemplateTrees,
  };
}
