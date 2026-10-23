import { looksLikePdf } from "./datasheets";
import { MAX_QUOTE_BYTES } from "./bookQuote";

/**
 * Le devis du client, recupere dans l'ERP par sa reference — l'autre origine du
 * devis d'un book, a cote du PDF televerse (src/lib/bookQuote.ts). Ce module ne
 * fait QUE l'aller chercher : une fois les octets en main, le devis suit le
 * meme chemin que s'il avait ete choisi sur le disque.
 *
 * L'ERP EST UN DOLIBARR (erp.example.com, celui qu'interroge deja un outil
 * interne de stock), multi-entites : chaque appel porte une entite dans
 * l'en-tete `dolapientity`. Deux routes STANDARD de son API REST, verifiees
 * presentes le 21/10/2026 :
 *
 *   GET /proposals/ref/{ref}         le devis, dont `last_main_doc`
 *   GET /documents/download          son PDF, en base64 dans du JSON
 *
 * PLUSIEURS ENTITES PAR BOUTIQUE (retour du 21/10/2026). Les devis des grands
 * comptes Acme ne sont pas faits sur l'entite Acme mais sur d'autres. La
 * boutique liste donc SES entites (reglage, src/lib/shopsAdmin.ts) ; le
 * commercial ne saisit que la reference, et le devis est cherche dans toutes,
 * en parallele. Pas « toutes les entites que la cle voit » : la cle des stocks
 * ouvre sans doute d'autres societes du groupe, et n'importe quel compte du
 * Studio en lirait alors les devis.
 *
 * LE PDF N'EST JAMAIS GENERE ICI. Dolibarr sait le produire a la demande
 * (PUT /documents/builddoc), mais ce serait ecrire dans l'ERP depuis le Studio,
 * et peut-etre remplacer le document qu'un commercial a retouche. Un devis sans
 * PDF est signale ; on le genere dans Dolibarr.
 *
 * `fetchImpl` est injectable : les tests rejouent les reponses de l'ERP sans
 * l'interroger (erpQuote.test.ts).
 */

export type ErpConfig = {
  /** Racine de l'API, « https://…/api/index.php ». */
  url: string;
  apiKey: string;
  /** Les entites Dolibarr ou chercher, dans l'ordre du reglage (parseEntities). */
  entities: string[];
};

export type ErpQuote = {
  /** La reference telle que l'ERP l'ecrit. */
  ref: string;
  /** Date du devis, AAAA-MM-JJ ; null si l'ERP n'en donne pas. */
  date: string | null;
  /** 0 brouillon, 1 valide, 2 signe, 3 non signe, 4 facture (codes Dolibarr). */
  status: number | null;
  /** L'entite ou le devis a ete trouve. */
  entity: string;
  filename: string;
  pdf: Uint8Array;
};

/** Une erreur dont le message est destine a la personne devant l'ecran, avec le statut HTTP a rendre. */
export class ErpQuoteError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/**
 * Une reference de devis : lettres, chiffres, tirets, points, soulignes et
 * parentheses (un brouillon Dolibarr s'appelle « (PROV42) »). Pas de barre
 * oblique : la reference entre dans un chemin d'URL et dans un nom de fichier.
 */
const REFERENCE = /^[A-Za-z0-9()._-]{1,64}$/;

export function normalizeQuoteReference(value: string): string | null {
  const ref = value.trim();
  return REFERENCE.test(ref) ? ref : null;
}

const TIMEOUT_MS = 15_000;
/** Au-dela, ce n'est plus une boutique mais tout l'ERP : le reglage le refuse. */
export const MAX_ENTITIES = 20;

/**
 * Les entites d'une boutique, saisies « 4, 9, 12 » : des nombres, separes par
 * des virgules, des points-virgules ou des espaces, sans doublon, dans l'ordre
 * saisi. null si la saisie n'en est pas une — elle est refusee plutot que lue a
 * moitie. Vide : aucune entite, la recuperation par reference est masquee.
 */
export function parseEntities(value: string | null | undefined): string[] | null {
  const text = (value ?? "").trim();
  if (text === "") return [];
  const parts = text.split(/[\s,;]+/).filter((part) => part !== "");
  if (!parts.every((part) => /^\d{1,6}$/.test(part))) return null;
  const entities = [...new Set(parts.map((part) => String(Number(part))))];
  return entities.length <= MAX_ENTITIES ? entities : null;
}

/**
 * Le chemin du PDF tel que /documents/download l'attend : relatif au dossier
 * des devis. `last_main_doc` le donne relatif aux donnees de l'entite
 * (« propale/D-MA-051341/D-MA-051341.pdf ») ; a defaut, le nommage par defaut
 * de Dolibarr, « <ref>/<ref>.pdf ».
 */
export function quoteDocumentPath(ref: string, lastMainDoc: unknown): string {
  if (typeof lastMainDoc === "string" && lastMainDoc.trim() !== "") {
    const path = lastMainDoc.trim();
    const at = path.lastIndexOf("propale/");
    return at >= 0 ? path.slice(at + "propale/".length) : path;
  }
  return `${ref}/${ref}.pdf`;
}

export async function fetchErpQuote(
  config: ErpConfig,
  reference: string,
  fetchImpl: typeof fetch = fetch
): Promise<ErpQuote> {
  const ref = normalizeQuoteReference(reference);
  if (ref === null) throw new ErpQuoteError("Référence de devis invalide.", 422);
  if (config.entities.length === 0) throw new ErpQuoteError("Aucune entité ERP pour cette boutique.", 409);

  const base = config.url.replace(/\/+$/, "");
  const call = async (path: string, entity: string): Promise<Response> => {
    try {
      return await fetchImpl(`${base}${path}`, {
        headers: { dolapikey: config.apiKey, dolapientity: entity, accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ErpQuoteError("L'ERP ne répond pas. Réessayer dans un instant.", 502);
    }
  };
  const refused = (response: Response) =>
    response.status === 401 || response.status === 403
      ? new ErpQuoteError("L'ERP refuse l'accès du Studio : clé d'API ou droits à vérifier.", 502)
      : new ErpQuoteError(`L'ERP a répondu ${response.status}.`, 502);
  const listed = config.entities.join(", ");

  // Toutes les entites a la fois : une recherche dure ce que dure la plus lente,
  // pas leur somme. Un 404 dit « pas ici » ; toute autre reponse est une panne.
  const answers = await Promise.all(
    config.entities.map(async (entity) => {
      const found = await call(`/proposals/ref/${encodeURIComponent(ref)}`, entity).catch((failure: unknown) => failure);
      if (isFailure(found)) return { entity, error: found };
      if (!(found instanceof Response)) throw found;
      if (found.status === 404) return { entity, proposal: null };
      if (!found.ok) return { entity, error: refused(found) };
      const proposal = (await found.json().catch(() => null)) as Record<string, unknown> | null;
      if (!proposal || typeof proposal !== "object") {
        return { entity, error: new ErpQuoteError("Réponse de l'ERP illisible.", 502) };
      }
      return { entity, proposal };
    })
  );

  const hits = answers.filter((answer) => "proposal" in answer && answer.proposal !== null);
  if (hits.length > 1) {
    throw new ErpQuoteError(
      `La référence « ${ref} » existe dans plusieurs entités ERP (${hits.map((hit) => hit.entity).join(", ")}) : impossible de savoir laquelle est la bonne.`,
      409
    );
  }
  if (hits.length === 0) {
    // Sans reponse de toutes les entites, on ne peut pas affirmer que le devis
    // n'existe pas : la panne est dite telle quelle.
    const failure = answers.find((answer) => "error" in answer);
    if (failure && "error" in failure) throw failure.error;
    throw new ErpQuoteError(`Aucun devis « ${ref} » dans l'ERP pour cette boutique (entités ${listed}).`, 404);
  }

  const { entity } = hits[0];
  const proposal = (hits[0] as { proposal: Record<string, unknown> }).proposal;
  const erpRef = typeof proposal.ref === "string" && proposal.ref !== "" ? proposal.ref : ref;
  const path = quoteDocumentPath(erpRef, proposal.last_main_doc);
  const document = await call(`/documents/download?modulepart=propal&original_file=${encodeURIComponent(path)}`, entity);
  if (document.status === 404) {
    throw new ErpQuoteError(
      `Le devis « ${erpRef} » n'a pas encore de PDF dans l'ERP : le générer depuis Dolibarr, puis réessayer.`,
      409
    );
  }
  if (!document.ok) throw refused(document);
  const file = (await document.json().catch(() => null)) as { content?: unknown; filename?: unknown } | null;
  if (!file || typeof file.content !== "string") throw new ErpQuoteError("Réponse de l'ERP illisible.", 502);

  // Le base64 fait 4/3 de l'original : au-dela, inutile de le decoder.
  if (file.content.length > (MAX_QUOTE_BYTES * 4) / 3 + 4) {
    throw new ErpQuoteError(`Devis trop lourd : au plus ${MAX_QUOTE_BYTES / 1024 / 1024} Mo.`, 422);
  }
  const pdf = new Uint8Array(Buffer.from(file.content, "base64"));
  if (!looksLikePdf(pdf)) throw new ErpQuoteError(`Le document du devis « ${erpRef} » n'est pas un PDF.`, 422);

  return {
    ref: erpRef,
    date: dateOf(proposal.date ?? proposal.datep),
    status: Number.isInteger(Number(proposal.statut ?? proposal.status)) ? Number(proposal.statut ?? proposal.status) : null,
    entity,
    filename: `devis-${erpRef.replace(/[()]/g, "")}.pdf`,
    pdf,
  };
}

/** Une panne deja traduite pour l'ecran (ERP injoignable), et non une reponse. */
function isFailure(value: unknown): value is ErpQuoteError {
  return value instanceof ErpQuoteError;
}

/** Dolibarr rend ses dates en horodatage Unix (secondes). */
function dateOf(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}
