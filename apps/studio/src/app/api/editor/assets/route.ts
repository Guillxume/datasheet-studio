import { deleteAsset, listAssets, putAsset, MAX_ASSET_BYTES } from "@/lib/assetStore";
import { assetKeyFromName, uploadMime } from "@/lib/assetUpload";
import { requireApi } from "@/lib/guard";
import { audit } from "@/lib/users";

/**
 * Bibliotheque d'images : pictos de badges, logos, icones.
 *
 * LECTURE ET ECRITURE SONT SEPAREES. Un importateur doit voir les images — un
 * template les reference, et un apercu vide sans explication ne se diagnostique
 * pas. Il n'a en revanche aucune raison d'en televerser ni d'en supprimer : une
 * cle ecrasee change silencieusement toutes les fiches qui s'en servent.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireApi("assets:read");
  if (auth instanceof Response) return auth;

  const scope = new URL(request.url).searchParams.get("scope") ?? "shared";

  return Response.json({ ok: true, assets: await listAssets(scope) });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApi("assets:write");
  if (auth instanceof Response) return auth;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ ok: false, error: "multipart/form-data attendu." }, { status: 415 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_ASSET_BYTES * 2) {
    return Response.json({ ok: false, error: "Fichier trop volumineux." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "Multipart illisible." }, { status: 400 });
  }

  const scope = String(form.get("scope") ?? "shared");
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return Response.json({ ok: false, error: 'Champ "file" manquant.' }, { status: 422 });
  }

  const originalName = "name" in file && typeof file.name === "string" ? file.name : "asset";
  // La cle par defaut derive du nom de fichier : c'est elle que le template
  // referencera, elle doit donc rester previsible et lisible.
  // Une cle fournie est normalisee comme un nom de fichier (sans extension).
  const provided = form.get("key");
  const key = assetKeyFromName(provided === null ? originalName : `${String(provided)}.x`);

  const result = await putAsset(
    scope,
    key,
    // Une police arrive souvent en application/octet-stream : voir assetUpload.ts.
    uploadMime(file.type, originalName),
    Buffer.from(await file.arrayBuffer()),
    originalName
  );

  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 422 });

  // Une cle d'image est partagee par toutes les fiches qui la citent :
  // l'ecraser change leur rendu sans qu'aucun template n'ait bouge. C'est donc
  // un evenement a retrouver, comme une publication.
  await audit(auth, "image.televersee", `${scope}/${key}`, { fichier: originalName, octets: file.size });
  return Response.json({ ok: true, asset: result.asset });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireApi("assets:write");
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") ?? "shared";
  const key = params.get("key");

  if (!key) {
    return Response.json({ ok: false, error: "key est requis." }, { status: 422 });
  }

  await deleteAsset(scope, key);
  await audit(auth, "image.supprimee", `${scope}/${key}`);

  return Response.json({ ok: true });
}
