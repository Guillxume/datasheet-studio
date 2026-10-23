import { z } from "zod";
import { requireApi } from "@/lib/guard";
import {
  createShop,
  listShopsForAdmin,
  rotateApiKey,
  shopSettingsSchema,
  updateShop,
} from "@/lib/shopsAdmin";
import { audit } from "@/lib/users";

/**
 * Boutiques : creation, reglages, cle API. Role administrateur uniquement.
 *
 * CE QUE CETTE ROUTE REMPLACE. `pnpm issue-key <slug>` faisait deja tout
 * cela — mais sur le serveur, en SSH, et en ecrasant silencieusement la cle
 * existante a chaque appel (le ON CONFLICT DO UPDATE du script). La commande
 * reste, elle sert a l'amorcage ; ce n'est plus le seul chemin, et ce n'est plus
 * celui qu'on prend en exploitation.
 *
 * LA CLE N'EST LISIBLE QU'UNE FOIS, a sa creation ou a sa rotation. La base n'en
 * garde que le sha256 (voir src/lib/auth.ts) : il n'existe aucun moyen de la
 * relire, et c'est voulu.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("creer"),
    slug: z.string().min(2).max(63),
    name: z.string().min(2).max(120),
  }),
  z.object({
    action: z.literal("configurer"),
    id: z.uuid(),
    name: z.string().min(2).max(120).optional(),
    webhookUrl: z.string().max(500).nullable().optional(),
    settings: shopSettingsSchema,
  }),
  z.object({ action: z.literal("rotation"), id: z.uuid() }),
  z.object({ action: z.literal("actif"), id: z.uuid(), active: z.boolean() }),
]);

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

export async function GET(): Promise<Response> {
  const auth = await requireApi("admin:shops");
  if (auth instanceof Response) return auth;

  return Response.json({ ok: true, shops: await listShopsForAdmin() });
}

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("admin:shops");
  if (actor instanceof Response) return actor;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "Corps JSON illisible.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Le premier message de zod est le seul utile a l'ecran : les suivants
    // decrivent le meme champ sous un autre angle.
    return fail(422, parsed.error.issues[0]?.message ?? "Requete invalide.");
  }
  const body = parsed.data;

  if (body.action === "creer") {
    const created = await createShop(body.slug, body.name);
    if ("error" in created) {
      return fail(409, created.error);
    }

    await audit(actor, "boutique.creee", body.slug);

    // La cle voyage UNE FOIS, dans cette reponse. L'interface l'affiche dans un
    // encadre a copier, puis elle est perdue pour tout le monde, y compris pour
    // le serveur.
    return Response.json({ ok: true, id: created.id, key: created.key });
  }

  if (body.action === "configurer") {
    const updated = await updateShop(body.id, {
      name: body.name,
      webhookUrl: body.webhookUrl === undefined ? undefined : body.webhookUrl || null,
      settings: body.settings,
    });
    if (!updated) return fail(404, "Boutique introuvable.");

    await audit(actor, "boutique.configuree", updated.slug);
    return Response.json({ ok: true, shop: updated });
  }

  if (body.action === "rotation") {
    const rotated = await rotateApiKey(body.id);
    if (rotated === null) return fail(404, "Boutique introuvable.");

    await audit(actor, "boutique.cle-tournee", rotated.slug);
    return Response.json({ ok: true, key: rotated.key });
  }

  // body.action === "actif"
  const updated = await updateShop(body.id, { active: body.active });
  if (!updated) return fail(404, "Boutique introuvable.");

  await audit(actor, body.active ? "boutique.reactivee" : "boutique.desactivee", updated.slug);
  return Response.json({ ok: true, shop: updated });
}
