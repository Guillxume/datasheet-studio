import { requireApi } from "@/lib/guard";
import {
  BOOK_PAGE_MIMES,
  MAX_BOOK_PAGE_BYTES,
  addCover,
  createDivider,
  deleteBookPage,
  movePage,
  updatePage,
} from "@/lib/bookPagesStore";
import { audit } from "@/lib/users";

/**
 * POST /api/book/pages — les pages fixes du book d'une boutique.
 *
 * RESERVE AU SUPER-ADMINISTRATEUR (book:configure) : couvertures et
 * intercalaires engagent la charte, une seule personne en decide.
 *
 * Multipart, champ `action` :
 *   couverture | quatrieme   boutique, [titre], image  AJOUTE une couverture
 *   creer                     boutique, titre, categories (JSON), image
 *   modifier                  boutique, id, [titre], [categories], [image]
 *   deplacer                  boutique, id, sens (-1 | 1)
 *   supprimer                 boutique, id
 *
 * Une boutique a autant de couvertures qu'elle veut (migration 016) : on choisit
 * la sienne en composant le book. `modifier`, `deplacer` et `supprimer` valent
 * pour toutes les pages ; les categories, pour les seuls intercalaires.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fail(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

/**
 * L'image, verifiee sur son CONTENU et non sur le type annonce : le navigateur
 * dit ce que l'extension laisse croire, la signature dit ce qu'est le fichier.
 */
async function readImage(value: FormDataEntryValue | null): Promise<{ mime: string; data: Buffer } | string | null> {
  if (!(value instanceof Blob) || value.size === 0) return null;
  if (value.size > MAX_BOOK_PAGE_BYTES) return `image de plus de ${MAX_BOOK_PAGE_BYTES / 1024 / 1024} Mo`;
  const data = Buffer.from(await value.arrayBuffer());
  const mime =
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ? "image/png"
      : data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
        ? "image/jpeg"
        : data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP"
          ? "image/webp"
          : null;
  if (!mime || !BOOK_PAGE_MIMES.has(mime)) return "l'image doit etre un PNG, un JPEG ou un WebP";
  return { mime, data };
}

function readCategories(value: FormDataEntryValue | null): string[] | null | "invalide" {
  if (value === null) return null;
  try {
    const parsed = JSON.parse(String(value)) as unknown;
    if (!Array.isArray(parsed) || parsed.length > 50 || !parsed.every((item) => typeof item === "string" && item.length <= 200)) {
      return "invalide";
    }
    return [...new Set(parsed.map((item: string) => item.trim()).filter((item) => item !== ""))];
  } catch {
    return "invalide";
  }
}

export async function POST(request: Request): Promise<Response> {
  const actor = await requireApi("book:configure");
  if (actor instanceof Response) return actor;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Formulaire illisible.");
  }

  const action = String(form.get("action") ?? "");
  const shop = String(form.get("boutique") ?? "").trim();
  const id = String(form.get("id") ?? "").trim();
  if (shop === "") return fail(422, "Boutique manquante.");

  if (action === "couverture" || action === "quatrieme") {
    const title = String(form.get("titre") ?? "").trim();
    if (title.length > 120) return fail(422, "Nom trop long (120 caracteres au plus).");
    const image = await readImage(form.get("image"));
    if (image === null) return fail(422, "Image manquante.");
    if (typeof image === "string") return fail(422, image);
    const created = await addCover(shop, action, { title: title || null, image });
    if (!created) return fail(404, "Boutique introuvable.");
    await audit(actor, `book.${action}`, shop, { titre: title || null, octets: image.data.length });
    return Response.json({ ok: true, id: created });
  }

  if (action === "creer") {
    const title = String(form.get("titre") ?? "").trim();
    const categories = readCategories(form.get("categories"));
    const image = await readImage(form.get("image"));
    if (title === "" || title.length > 120) return fail(422, "Titre manquant (120 caracteres au plus).");
    if (categories === "invalide") return fail(422, "Categories illisibles.");
    // UN INTERCALAIRE N'EXISTE PAS SANS SON IMAGE : c'est la page meme.
    if (image === null) return fail(422, "Un intercalaire a toujours une image.");
    if (typeof image === "string") return fail(422, image);
    const created = await createDivider(shop, { title, categories: categories ?? [], image });
    if (!created) return fail(404, "Boutique introuvable.");
    await audit(actor, "book.intercalaire_cree", shop, { titre: title });
    return Response.json({ ok: true, id: created });
  }

  if (action === "modifier") {
    const rawTitle = form.get("titre");
    const title = rawTitle === null ? undefined : String(rawTitle).trim();
    const categories = readCategories(form.get("categories"));
    const image = await readImage(form.get("image"));
    // Vide permis : une couverture peut ne pas avoir de nom. La base refuse
    // toujours un intercalaire sans titre (contrainte de la migration 012).
    if (title !== undefined && title.length > 120) return fail(422, "Titre invalide.");
    if (categories === "invalide") return fail(422, "Categories illisibles.");
    if (typeof image === "string") return fail(422, image);
    let done: boolean;
    try {
      done = await updatePage(shop, id, { title, categories: categories ?? undefined, image: image ?? undefined });
    } catch (cause) {
      // 23514 : la contrainte « un intercalaire a un titre » (migration 012).
      if ((cause as { code?: string }).code === "23514") return fail(422, "Un intercalaire a toujours un titre.");
      throw cause;
    }
    if (!done) return fail(404, "Page introuvable pour cette boutique.");
    await audit(actor, "book.page_modifiee", shop, { id });
    return Response.json({ ok: true });
  }

  if (action === "deplacer") {
    const direction = Number(form.get("sens")) === -1 ? -1 : 1;
    if (!(await movePage(shop, id, direction))) return fail(404, "Page introuvable pour cette boutique.");
    return Response.json({ ok: true });
  }

  if (action === "supprimer") {
    if (!(await deleteBookPage(shop, id))) return fail(404, "Page introuvable pour cette boutique.");
    await audit(actor, "book.page_supprimee", shop, { id });
    return Response.json({ ok: true });
  }

  return fail(400, `Action inconnue : ${action}`);
}
