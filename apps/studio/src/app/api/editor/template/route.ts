import { requireApi } from "@/lib/guard";
import { env } from "@/lib/env";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateBySlug,
  publishDraft,
  saveDraft,
  templateUsage,
} from "@/lib/repository";
import { audit } from "@/lib/users";
import { can } from "@/lib/roles";
import {
  applyComponentToZone,
  dependentsOf,
  republishDependents,
  templatesCiting,
} from "@/lib/componentStore";

/**
 * Mutations de l'editeur.
 *
 * SOUS /api/editor ET NON /api/v1, deliberement : le middleware laisse passer
 * /api/v1/* sans session, parce que ces routes portent leur propre cle API. Une
 * route d'edition placee la serait publique.
 *
 * Un seul point d'entree a actions plutot que six routes REST : pour un outil
 * interne, la surface reduite vaut mieux que la purete du verbe HTTP.
 *
 * DEUX PERMISSIONS, PAS UNE. Enregistrer un brouillon (templates:write) et le
 * publier (templates:publish) sont separes dans la matrice de src/lib/roles.ts
 * meme si les deux roles qui ecrivent ont aujourd'hui les deux droits. La
 * distinction coute une ligne ici et sera la le jour ou l'on voudra un role qui
 * compose sans mettre en ligne — ce qui est la demande qui revient toujours.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: string;
  /** Confirme une suppression malgre des rendus recents. Voir l'action "supprimer". */
  force?: boolean;
  scope?: string;
  slug?: string;
  name?: string;
  targetScope?: string;
  targetSlug?: string;
  /** A la creation : « component » pour un composant reutilisable. */
  kind?: string;
  /** « appliquer » : la zone remplacee, les templates vises, et s'il faut publier. */
  zone?: string;
  targets?: string[];
  publish?: boolean;
  trees?: {
    body?: unknown;
    header?: unknown;
    footer?: unknown;
    css?: string | null;
    settings?: Record<string, unknown>;
  };
};

const scopeToShop = (scope: string | undefined): string | null =>
  scope === undefined || scope === "shared" ? null : scope;

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

/** La permission exigee par chaque action. Une action absente de cette table est refusee. */
const REQUIRED = {
  create: "templates:write",
  duplicate: "templates:write",
  save: "templates:write",
  publish: "templates:publish",
  supprimer: "templates:write",
  /** Les templates qu'une publication de composant republiera — affiches avant. */
  dependances: "templates:read",
  /**
   * Remplacer l'en-tete ou le pied de plusieurs templates par un composant.
   * templates:write suffit pour enregistrer ; publier dans la foulee exige EN
   * PLUS templates:publish, verifie dans l'action.
   */
  appliquer: "templates:write",
} as const;

export async function POST(request: Request): Promise<Response> {
  /*
   * AVANT DE LIRE LE CORPS, comme /api/v1/render : l'action n'est connue qu'une
   * fois le JSON analyse, mais un brouillon (action "save") transporte l'arbre
   * Puck entier, sans limite jusqu'ici. Les autres actions de cette route
   * (create/duplicate/publish/supprimer) ont un corps minuscule ; le plafond
   * generique de l'application ne les gene pas.
   */
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > env.maxRequestBytes) {
    return fail(413, `Payload trop volumineux (${declared} octets)`);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail(400, "Corps JSON illisible.");
  }

  const action = body.action ?? "";
  if (!(action in REQUIRED)) {
    return fail(400, `Action inconnue : ${action}`);
  }

  const actor = await requireApi(REQUIRED[action as keyof typeof REQUIRED]);
  if (actor instanceof Response) return actor;

  if (action === "create") {
    if (!body.slug || !body.name) {
      return fail(422, "slug et name sont requis.");
    }
    const kind = body.kind === "component" ? "component" : "template";
    const result = await createTemplate(body.slug, body.name, scopeToShop(body.scope), kind);
    if ("error" in result) return fail(409, result.error);

    await audit(actor, `${kind === "component" ? "composant" : "template"}.cree`, `${body.scope ?? "shared"}/${body.slug}`);
    return Response.json({ ok: true, id: result.id });
  }

  if (action === "duplicate") {
    if (!body.slug || !body.targetSlug || !body.name) {
      return fail(422, "slug, targetSlug et name sont requis.");
    }
    const source = await getTemplateBySlug(body.slug, scopeToShop(body.scope));
    if (!source) {
      return fail(404, "Template source introuvable.");
    }
    const result = await duplicateTemplate(
      source.id,
      scopeToShop(body.targetScope),
      body.targetSlug,
      body.name
    );
    if (!("error" in result)) {
      await audit(actor, "template.duplique", `${body.targetScope ?? "shared"}/${body.targetSlug}`, {
        depuis: `${body.scope ?? "shared"}/${body.slug}`,
      });
    }

    return "error" in result ? fail(409, result.error) : Response.json({ ok: true, id: result.id });
  }

  // Les actions suivantes portent toutes sur un template existant.
  if (!body.slug) {
    return fail(422, "slug est requis.");
  }
  const template = await getTemplateBySlug(body.slug, scopeToShop(body.scope));
  if (!template) {
    return fail(404, "Template introuvable.");
  }

  if (action === "save") {
    if (!body.trees || body.trees.body === undefined) {
      return fail(422, "trees.body est requis.");
    }

    // Le rendu neutralise deja cette sequence (src/lib/html.ts, styleElement) ;
    // la refuser ici dit a l'auteur ce qu'il a ecrit, au lieu de le corriger
    // en silence. Aucune feuille legitime ne la contient.
    if (typeof body.trees.css === "string" && /<\/style/i.test(body.trees.css)) {
      return fail(422, "La feuille de style ne peut pas contenir « </style ».");
    }

    const number = await saveDraft(template.id, {
      body: body.trees.body,
      header: body.trees.header ?? null,
      footer: body.trees.footer ?? null,
      css: body.trees.css ?? null,
      settings: body.trees.settings ?? {},
    });

    return Response.json({ ok: true, draft_version: number });
  }

  if (action === "dependances") {
    const dependents = template.kind === "component" ? await dependentsOf(template.id) : [];
    return Response.json({ ok: true, dependents });
  }

  if (action === "appliquer") {
    if (template.kind !== "component") {
      return fail(422, "Seul un composant s'applique a des templates.");
    }
    if (body.zone !== "header" && body.zone !== "footer") {
      return fail(422, "zone doit valoir header ou footer.");
    }
    if (!Array.isArray(body.targets) || body.targets.length === 0) {
      return fail(422, "Aucun template choisi.");
    }
    if (body.publish === true && !can(actor.role, "templates:publish")) {
      return fail(403, "Votre role ne permet pas de publier : decocher la publication.");
    }

    const outcomes = await applyComponentToZone(template.id, body.zone, body.targets, body.publish === true);
    await audit(actor, "composant.applique", `${body.scope ?? "shared"}/${template.slug}`, {
      zone: body.zone,
      publication_demandee: body.publish === true,
      templates: outcomes.map((item) => `${item.shopSlug ?? "shared"}/${item.slug} : ${item.outcome}`),
    });
    return Response.json({ ok: true, outcomes });
  }

  if (action === "publish") {
    const number = await publishDraft(template.id);
    if (number === null) {
      return fail(409, "Aucun brouillon a publier.");
    }

    /*
     * PUBLIER UN COMPOSANT CHANGE LES FICHES DE TOUS LES TEMPLATES QUI LE CITENT :
     * c'est le choix fait (effet immediat). Ces templates recoivent une nouvelle
     * version publiee, sans quoi les boutiques, qui ne regenerent que sur un
     * changement de version, garderaient l'ancien rendu en cache. Voir
     * republishDependents.
     */
    if (template.kind === "component") {
      const republished = await republishDependents(template.id, template.name);
      await audit(actor, "composant.publie", `${body.scope ?? "shared"}/${template.slug}`, {
        version: number,
        templates_republies: republished.map((item) => `${item.shopSlug ?? "shared"}/${item.slug}`),
      });
      return Response.json({ ok: true, published_version: number, republished });
    }

    /*
     * LA PUBLICATION EST L'ACTE LE PLUS LOURD DU STUDIO : c'est elle qui change
     * les fiches servies aux clients, sur toutes les boutiques qui utilisent le
     * template. Seuls les composants etaient journalises (audit du 16/10/2026) :
     * « qui a publie la version qui a casse les fiches ? » restait sans reponse.
     */
    await audit(actor, "template.publie", `${body.scope ?? "shared"}/${template.slug}`, { version: number });
    return Response.json({ ok: true, published_version: number });
  }

  /*
   * UN COMPOSANT CITE NE SE SUPPRIME PAS : les templates qui le citent sortiraient
   * sans lui, sans que rien ne le dise sur les fiches. On rend la liste, a
   * retirer d'abord des templates.
   */
  if (template.kind === "component") {
    const citing = await templatesCiting(template.id);
    if (citing.length > 0) {
      return Response.json(
        {
          ok: false,
          error: `Ce composant est utilise par ${citing.length} template(s) : ${citing
            .map((item) => `${item.name} (${item.shopSlug ?? "bibliotheque"})`)
            .join(", ")}. Le retirer de ces templates d'abord.`,
          citing,
        },
        { status: 409 }
      );
    }
  }

  // action === "supprimer"
  /*
   * DEUX TEMPS QUAND LE TEMPLATE A SERVI RECEMMENT. Le premier appel rend 409
   * avec le nombre de rendus des 90 derniers jours ; l'interface l'affiche et
   * redemande. Le second porte `force: true`.
   *
   * Une simple boite de dialogue « etes-vous sur ? » ne dit rien : personne ne
   * sait de tete si un template sert encore. Un nombre, si.
   */
  const usage = await templateUsage(template.id);
  if (usage > 0 && body.force !== true) {
    return Response.json(
      {
        ok: false,
        error: `Ce template a servi a ${usage} rendu(s) de production sur les 90 derniers jours.`,
        usage,
        confirmable: true,
      },
      { status: 409 }
    );
  }

  await deleteTemplate(template.id);
  await audit(actor, "template.supprime", `${body.scope ?? "shared"}/${template.slug}`, {
    rendus_90j: usage,
  });

  return Response.json({ ok: true });
}
