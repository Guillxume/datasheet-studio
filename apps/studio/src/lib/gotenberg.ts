import type { Asset } from "./assets";

/**
 * Client Gotenberg (route Chromium HTML -> PDF).
 *
 * Gotenberg 8 attend des dimensions en POUCES. Les templates sont edites en
 * millimetres (unite d'imprimeur), la conversion se fait ici, a la frontiere.
 */

const MM_PER_INCH = 25.4;

export type PageGeometry = {
  /** En millimetres. A4 par defaut. */
  width: number;
  height: number;
  margins: { top: number; right: number; bottom: number; left: number };
  landscape?: boolean;
};

export const A4_PORTRAIT: PageGeometry = {
  width: 210,
  height: 297,
  // Les marges haute et basse reservent la place des en-tete et pied de page :
  // Chromium y dessine header.html et footer.html. Une marge trop faible les
  // tronque silencieusement.
  margins: { top: 32, right: 0, bottom: 22, left: 0 },
};

export type GotenbergInput = {
  indexHtml: string;
  headerHtml?: string | null;
  footerHtml?: string | null;
  assets: Asset[];
  geometry: PageGeometry;
};

export class GotenbergError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: string
  ) {
    super(message);
    this.name = "GotenbergError";
  }
}

const mm = (value: number): string => (value / MM_PER_INCH).toFixed(4);

export async function htmlToPdf(input: GotenbergInput, baseUrl: string, timeoutMs = 60_000): Promise<Buffer> {
  const form = new FormData();

  // Gotenberg impose le nom "index.html" pour le document principal, et
  // "header.html" / "footer.html" pour les zones repetees.
  form.append("files", new Blob([input.indexHtml], { type: "text/html" }), "index.html");
  if (input.headerHtml) {
    form.append("files", new Blob([input.headerHtml], { type: "text/html" }), "header.html");
  }
  if (input.footerHtml) {
    form.append("files", new Blob([input.footerHtml], { type: "text/html" }), "footer.html");
  }

  for (const asset of input.assets) {
    form.append("files", new Blob([new Uint8Array(asset.bytes)], { type: asset.mime }), asset.filename);
  }

  const { geometry: g } = input;
  form.append("paperWidth", mm(g.landscape ? g.height : g.width));
  form.append("paperHeight", mm(g.landscape ? g.width : g.height));
  form.append("marginTop", mm(g.margins.top));
  form.append("marginBottom", mm(g.margins.bottom));
  form.append("marginLeft", mm(g.margins.left));
  form.append("marginRight", mm(g.margins.right));
  form.append("printBackground", "true");
  form.append("emulatedMediaType", "print");
  // La geometrie vient des reglages du template, pas d'un @page dans le CSS :
  // une seule source de verite pour les dimensions.
  form.append("preferCssPageSize", "false");

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/forms/chromium/convert/html`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new GotenbergError(`Gotenberg injoignable : ${reason}`, 0, reason);
  }

  if (!response.ok) {
    // Gotenberg renvoie un message d'erreur exploitable en texte brut
    // (CSS invalide, fichier manquant, timeout Chromium) : le remonter tel
    // quel evite de deboguer a l'aveugle depuis PrestaShop.
    const detail = await response.text().catch(() => "");
    throw new GotenbergError(`Gotenberg a repondu ${response.status}`, response.status, detail.slice(0, 2000));
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Assemble des PDF, dans l'ordre du tableau, par le moteur de Gotenberg.
 *
 * LES FICHIERS PASSENT PAR LE DISQUE ET NON PAR LA MEMOIRE : un book de deux
 * cents fiches pese des centaines de megaoctets. `openAsBlob` rend un Blob
 * adosse au fichier, lu au fil de l'envoi — la requete multipart ne tient
 * jamais l'ensemble en memoire. La reponse est rendue telle quelle pour etre
 * relayee en flux au navigateur, sans etre lue ici.
 *
 * L'ORDRE EST CELUI DES NOMS : Gotenberg fusionne par ordre alphabetique des
 * noms de fichiers. Ils sont donc numerotes sur cinq chiffres, independamment
 * du nom des fichiers sur le disque.
 *
 * 85 SECONDES ET NON CINQ MINUTES : Gotenberg coupe toute requete a 90 s
 * (`--api-timeout`, infra/docker-compose.yml). Attendre plus longtemps ne
 * servait qu'a recevoir son refus plus tard, sous une forme moins lisible.
 * Mesure le 16/10/2026 : 200 fiches fusionnees en 0,4 s.
 */
export async function mergePdfFiles(paths: string[], baseUrl: string, timeoutMs = 85_000): Promise<Response> {
  const { openAsBlob } = await import("node:fs");
  const form = new FormData();
  for (const [index, path] of paths.entries()) {
    const blob = await openAsBlob(path, { type: "application/pdf" });
    form.append("files", blob, `${String(index + 1).padStart(5, "0")}.pdf`);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/forms/pdfengines/merge`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new GotenbergError(`Gotenberg injoignable : ${reason}`, 0, reason);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GotenbergError(`Gotenberg a repondu ${response.status}`, response.status, detail.slice(0, 2000));
  }
  return response;
}
