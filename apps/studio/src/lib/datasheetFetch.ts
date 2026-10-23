import { looksLikePdf } from "./datasheets";
import { safeFetch } from "./publicUrl";

/**
 * Recuperer le PDF d'une fiche aupres de la boutique qui la publie.
 *
 * Partage par le zip et le book de /consultation : les deux ne telechargent que
 * des adresses de l'index (declarees par la boutique authentifiee), et passent
 * par `safeFetch`, qui refuse les adresses privees.
 */

/** Une fiche technique pese quelques centaines de Ko ; 25 Mo est deja une anomalie. */
export const MAX_DATASHEET_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

export type DatasheetDownload = { ok: true; data: Uint8Array } | { ok: false; reason: string };

export async function downloadDatasheet(url: string): Promise<DatasheetDownload> {
  const attempt = await safeFetch(url, { timeoutMs: TIMEOUT_MS, accept: "application/pdf" });
  if (!attempt.ok) return { ok: false, reason: `adresse refusee (${attempt.raison})` };

  const response = attempt.response;
  if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };

  const data = await readCapped(response, MAX_DATASHEET_BYTES);
  if (data === null) return { ok: false, reason: "fichier trop volumineux" };

  /*
   * Une boutique qui a retire un produit repond souvent par une page HTML en
   * 200. Le controle porte sur le contenu et non sur l'en-tete Content-Type,
   * que certains serveurs posent mal.
   */
  if (!looksLikePdf(data)) return { ok: false, reason: "la reponse n'est pas un PDF" };

  return { ok: true, data };
}

/** Lit le corps sans jamais depasser `max` octets — un Content-Length absent ou faux ne suffit pas a s'en proteger. */
export async function readCapped(response: Response, max: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > max) return null;
  if (!response.body) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
