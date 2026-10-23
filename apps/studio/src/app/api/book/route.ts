import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { requireApi } from "@/lib/guard";
import { env } from "@/lib/env";
import { bookSpecSchema, imagePageHtml, missingPageHtml, type BookSpec } from "@/lib/book";
import { MAX_QUOTE_BYTES, quoteProblem } from "@/lib/bookQuote";
import { parseSelection, slugifyName } from "@/lib/datasheets";
import { bookPageImage, listBookPages, type BookPage } from "@/lib/bookPagesStore";
import { downloadDatasheet } from "@/lib/datasheetFetch";
import { datasheetsBySelection, type DatasheetRow } from "@/lib/datasheetsStore";
import { GotenbergError, htmlToPdf, mergePdfFiles, type PageGeometry } from "@/lib/gotenberg";
import { renderLimiter } from "@/lib/renderQueue";
import { pdfPageCount } from "@/lib/pdf";
import { qpdfApplyToc, qpdfAvailable, qpdfMerge, qpdfPageCount } from "@/lib/qpdf";
import { shopSeedFor } from "@/lib/shopsAdmin";
import { TOC_MARGINS, tocHtml, tocLines, tocPage, type TocSection } from "@/lib/bookToc";

/**
 * POST /api/book — compose un book en un seul PDF :
 *
 *   premiere de couverture  (fixe, si la boutique en a une)
 *   sommaire                (si demande : src/lib/bookToc.ts)
 *   pour chaque section     son intercalaire fixe, puis ses fiches
 *   fiches « a la suite »   sans intercalaire
 *   devis du client         (s'il est joint)
 *   quatrieme de couverture (fixe, si la boutique en a une)
 *
 * Corps : multipart, la demande en JSON dans `spec` (voir bookSpecSchema) et le
 * devis, facultatif, dans `devis` ; ou la demande seule en JSON, comme avant le
 * devis. Couvertures et intercalaires sont des pages
 * DESSINEES, posees en base par le super-administrateur (/consultation/book/
 * reglages) : la demande ne porte que l'ordre des sections et des fiches.
 *
 * LE NAVIGATEUR N'ENVOIE QUE DES CLES : fiches de l'index de la boutique,
 * intercalaires de CETTE boutique (un identifiant d'une autre est refuse).
 *
 * TOUT PASSE PAR LE DISQUE : chaque page est ecrite dans un dossier temporaire
 * des qu'elle existe, Gotenberg lit ces fichiers au fil de l'envoi, et le book
 * assemble repart en flux. Le dossier est supprime a la fin du transfert, ou a
 * son interruption.
 *
 * UNE PLACE DE LA FILE DE RENDU pendant la composition : un book ne doit pas
 * affamer les fiches que les boutiques demandent au meme moment.
 *
 * L'ASSEMBLAGE EST FAIT PAR QPDF quand il est la (src/lib/qpdf.ts) : il garde
 * les liens des pages — ceux du sommaire, que la retouche rend internes, et ceux
 * des fiches elles-memes, que la fusion de Gotenberg jetait. Sans qpdf, ou s'il
 * echoue, Gotenberg prend le relais ; le sommaire reste imprime, sans liens.
 * L'en-tete `x-book-toc` dit ce qu'il en est : ok, sans-liens, impossible.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const A4_FULL_BLEED: PageGeometry = { width: 210, height: 297, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
const TOC_GEOMETRY: PageGeometry = { width: 210, height: 297, margins: TOC_MARGINS };
/** Le sommaire est rendu, compte, puis rendu de nouveau a sa vraie longueur : au-dela de trois essais, on garde le dernier. */
const TOC_PASSES = 3;
/** Fiches telechargees en parallele : assez pour ne pas attendre, assez peu pour la memoire. */
const DOWNLOAD_CONCURRENCY = 4;

function fail(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

/**
 * Le devis n'a pas pu etre lu par Gotenberg. Le plus souvent, un mot de passe
 * d'OUVERTURE : un PDF seulement protege contre la modification passe, mais
 * celui-la fait echouer la fusion entiere sur un « 500 » muet (verifie le
 * 21/10/2026). D'ou un controle du devis SEUL avant la composition : l'echec
 * dit alors ce qui est en cause, au lieu de « Composition du book impossible ».
 */
class UnreadableQuote extends Error {}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApi("datasheets:read");
  if (auth instanceof Response) return auth;

  let spec: BookSpec;
  let quote: Uint8Array | null = null;
  try {
    let raw: unknown;
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      raw = JSON.parse(String(form.get("spec") ?? ""));
      const file = form.get("devis");
      if (file instanceof File) {
        // La taille AVANT de lire : inutile de charger 30 Mo pour les refuser.
        if (file.size > MAX_QUOTE_BYTES) return fail(413, quoteProblem(file.size, new Uint8Array()) ?? "");
        quote = new Uint8Array(await file.arrayBuffer());
      }
    } else {
      raw = await request.json();
    }
    const parsed = bookSpecSchema.safeParse(raw);
    if (!parsed.success) return fail(422, `Demande invalide : ${parsed.error.issues[0]?.message ?? "?"}`);
    spec = parsed.data;
  } catch {
    return fail(400, "Demande illisible.");
  }
  const problem = quote ? quoteProblem(quote.length, quote) : null;
  if (problem) return fail(422, problem);

  const pages = await listBookPages(spec.boutique);
  const dividers = new Map(pages.filter((page) => page.kind === "intercalaire").map((page) => [page.id, page]));
  const unknown = spec.sections.find((section) => section.divider !== null && !dividers.has(section.divider));
  if (unknown) return fail(422, "Intercalaire inconnu pour cette boutique.");

  /*
   * La couverture choisie, DANS cette boutique et de la bonne nature : un
   * identifiant seul ne doit pas suffire a imprimer la page d'une autre
   * boutique. Non precisee : la premiere de la liste (comportement d'avant la
   * migration 016). `null` : aucune.
   */
  const pick = (kind: "couverture" | "quatrieme", id: string | null | undefined) =>
    id === undefined
      ? pages.find((page) => page.kind === kind)
      : id === null
        ? undefined
        : pages.find((page) => page.kind === kind && page.id === id);
  const cover = pick("couverture", spec.cover);
  const back = pick("quatrieme", spec.back);
  if ((spec.cover && !cover) || (spec.back && !back)) return fail(422, "Couverture inconnue pour cette boutique.");

  // Les fiches demandees, dans la boutique demandee seulement.
  const wanted = spec.sections.flatMap((section) => section.fiches);
  const selection = wanted.map((value) => parseSelection(value)).filter((item) => item !== null);
  const rows = new Map(
    (await datasheetsBySelection(spec.boutique, selection)).map((row) => [`${row.locale}:${row.product_key}`, row])
  );

  const slot = await renderLimiter.acquire();
  if (!slot) return fail(503, "Le Studio est occupe par d'autres rendus. Reessayer dans un instant.");

  const dir = await mkdtemp(join(tmpdir(), "book-"));
  const cleanup = () => rm(dir, { recursive: true, force: true }).catch(() => undefined);

  try {
    const paths: string[] = [];
    let counter = 0;
    const write = async (bytes: Uint8Array): Promise<void> => {
      const path = join(dir, `${String(++counter).padStart(5, "0")}.pdf`);
      await writeFile(path, bytes);
      paths.push(path);
    };
    const render = async (html: string) => write(await htmlToPdf({ indexHtml: html, assets: [], geometry: A4_FULL_BLEED }, env.gotenbergUrl));

    /**
     * Une page dessinee : son image, pleine page. Absente (supprimee entre-temps),
     * elle est sautee. Rend le nombre de pages ecrites, pour le sommaire.
     */
    const drawn = async (page: BookPage | undefined): Promise<number> => {
      if (!page) return 0;
      const image = await bookPageImage(page.id, spec.boutique);
      if (!image) return 0;
      await render(imagePageHtml(`data:${image.mime};base64,${image.image.toString("base64")}`));
      return 1;
    };

    // Le devis d'abord, seul : s'il est illisible, inutile de telecharger les fiches.
    let quotePath: string | null = null;
    if (quote) {
      const received = join(dir, "devis-recu.pdf");
      await writeFile(received, quote);
      const checked = await mergePdfFiles([received], env.gotenbergUrl).catch((cause: unknown) => {
        // Gotenberg a repondu, et refuse ce fichier : c'est le devis. Injoignable
        // (statut 0), ce n'est pas lui — l'erreur generale s'applique.
        throw cause instanceof GotenbergError && cause.status > 0 ? new UnreadableQuote() : cause;
      });
      quotePath = join(dir, "devis.pdf");
      await writeFile(quotePath, Buffer.from(await checked.arrayBuffer()));
    }

    const coverPages = await drawn(cover);

    const downloads = prefetch(wanted, rows, dir);
    const missing: string[] = [];
    // Ce que chaque partie occupe, pour le sommaire. Une fiche dont le nombre de
    // pages n'a pas pu etre lu garde son chemin : qpdf le comptera.
    const sections: (TocSection & { unknown: { index: number; path: string }[] })[] = [];

    for (const section of spec.sections) {
      const printed =
        spec.dividers && section.printDivider && section.divider !== null ? await drawn(dividers.get(section.divider)) : 0;
      const entry: (typeof sections)[number] = {
        title: section.divider !== null ? (dividers.get(section.divider)?.title ?? null) : null,
        dividerPages: printed,
        fiches: [],
        unknown: [],
      };
      sections.push(entry);

      for (const value of section.fiches) {
        const row = rows.get(value);
        const result: Prefetched = row?.datasheet_url
          ? await downloads.get(value)!
          : { ok: false, reason: row ? "adresse inconnue" : "fiche inconnue de cette boutique" };

        const name = row?.product_name ?? value;
        if (result.ok) {
          // Deja sur le disque : seul le chemin entre dans la liste. Une fiche
          // demandee deux fois est lue deux fois, depuis le meme fichier.
          paths.push(result.path);
          if (result.pages === null) entry.unknown.push({ index: entry.fiches.length, path: result.path });
          entry.fiches.push({ title: name, pages: result.pages ?? 0 });
        } else {
          missing.push(`${name} : ${result.reason}`);
          await render(missingPageHtml({ name, reason: result.reason, color: "#2e2b25" }));
          entry.fiches.push({ title: name, pages: 1 });
        }
      }
    }

    if (quotePath) paths.push(quotePath);
    await drawn(back);

    const withQpdf = await qpdfAvailable();
    let tocStatus: "absent" | "ok" | "sans-liens" | "impossible" = "absent";
    let toc: { first: number; count: number; outline: { title: string; page: number; level: 0 | 1 }[] } | null = null;

    if (spec.toc) {
      // Les fiches au nombre de pages inconnu : qpdf sait les lire ; sans lui, le
      // sommaire donnerait des numeros faux — il n'est pas imprime.
      for (const entry of sections) {
        for (const { index, path } of entry.unknown) {
          const pages = withQpdf ? await qpdfPageCount(path) : null;
          if (pages === null) tocStatus = "impossible";
          else entry.fiches[index].pages = pages;
        }
      }
      if (tocStatus !== "impossible") {
        const lines = tocLines(sections, quotePath !== null);
        // La couleur de la boutique, celle de ses fiches ; tocHtml retombe sur le gris si elle n'en est pas une.
        const seed = (await shopSeedFor(spec.boutique).catch(() => null)) as { colors?: { primary?: unknown } } | null;
        const color = typeof seed?.colors?.primary === "string" ? seed.colors.primary : "";
        let count = 1;
        let pdf: Uint8Array | null = null;
        for (let pass = 0; pass < TOC_PASSES; pass++) {
          pdf = await htmlToPdf({ indexHtml: tocHtml(lines, coverPages + count, color), assets: [], geometry: TOC_GEOMETRY }, env.gotenbergUrl);
          const real = pdfPageCount(pdf);
          if (real === null || real === count) break;
          count = real;
        }
        const tocPath = join(dir, "sommaire.pdf");
        await writeFile(tocPath, pdf!);
        paths.splice(coverPages, 0, tocPath);
        toc = {
          first: coverPages + 1,
          count,
          outline: [
            { title: "Sommaire", page: coverPages + 1, level: 0 },
            ...lines.map((line) => ({ title: line.title, page: tocPage(line, coverPages + count), level: line.level })),
          ],
        };
        tocStatus = "sans-liens";
      }
    }

    // L'assemblage : qpdf s'il est la (il garde les liens), Gotenberg sinon. Un
    // echec de qpdf n'est pas un echec du book : le relais est pris.
    let book: ReadableStream<Uint8Array> | null = null;
    if (withQpdf) {
      const merged = join(dir, "book-assemble.pdf");
      try {
        await qpdfMerge(paths, merged);
        let final = merged;
        if (toc) {
          const linked = join(dir, "book.pdf");
          try {
            const { links, broken } = await qpdfApplyToc(merged, linked, join(dir, "sommaire.json"), toc);
            final = linked;
            if (links > 0 && broken === 0) tocStatus = "ok";
          } catch (cause) {
            console.error("book : sommaire non cliquable, retouche impossible", cause);
          }
        }
        book = Readable.toWeb(createReadStream(final)) as ReadableStream<Uint8Array>;
      } catch (cause) {
        console.error("book : assemblage qpdf impossible, relais par Gotenberg", cause);
      }
    }
    if (!book) book = (await mergePdfFiles(paths, env.gotenbergUrl)).body!;
    slot.slot.release();

    const filename = `book-${slugifyName(spec.boutique, 40)}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new Response(relay(book, cleanup), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
        // Les fiches remplacees par une page « indisponible » : l'ecran le dit,
        // le book l'imprime. Encode pour rester un en-tete ASCII.
        "x-book-missing": String(missing.length),
        "x-book-missing-detail": encodeURIComponent(JSON.stringify(missing.slice(0, 20))),
        "x-book-toc": tocStatus,
      },
    });
  } catch (cause) {
    slot.slot.release();
    await cleanup();
    if (cause instanceof UnreadableQuote) {
      return fail(
        422,
        "Le devis n'a pas pu être lu : il est sans doute protégé par un mot de passe, ou abîmé. L'enregistrer à nouveau sans protection, puis réessayer."
      );
    }
    const message = cause instanceof GotenbergError ? `${cause.message} : ${cause.detail.slice(0, 300)}` : String(cause);
    console.error("book : composition impossible", message);
    return fail(cause instanceof GotenbergError ? 502 : 500, "Composition du book impossible.");
  }
}

/** `pages` : lu a l'arrivee, pendant que la fiche est en memoire ; null si la lecture rapide n'a pas su. */
type Prefetched = { ok: true; path: string; pages: number | null } | { ok: false; reason: string };

/**
 * Telecharge les fiches a l'avance, quelques-unes a la fois : la boucle
 * principale attend la fiche dont elle a besoin pendant que les suivantes
 * arrivent. Une promesse par fiche, cle « <langue>:<cle> ».
 *
 * CHAQUE FICHE VA SUR LE DISQUE DES SON ARRIVEE. Les telechargements avancent
 * plus vite que la boucle, qui compose aussi les intercalaires : la premiere
 * version gardait chaque PDF en memoire jusqu'a son tour, soit jusqu'a deux
 * cents fiches — plusieurs centaines de Mo pour un book d'images lourdes (audit
 * du 16/10/2026). Desormais seuls les DOWNLOAD_CONCURRENCY telechargements en
 * cours tiennent en memoire ; le reste attend dans le dossier temporaire, qui
 * est supprime avec le book.
 */
function prefetch(values: string[], rows: Map<string, DatasheetRow>, dir: string): Map<string, Promise<Prefetched>> {
  const queue = [...new Set(values)].flatMap((value) => {
    const url = rows.get(value)?.datasheet_url;
    return url ? [{ value, url }] : [];
  });

  const results = new Map<string, Promise<Prefetched>>();
  const resolvers = new Map<string, (result: Prefetched) => void>();
  for (const { value } of queue) results.set(value, new Promise((resolve) => resolvers.set(value, resolve)));

  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const index = next++;
      const job = queue[index];
      const result = await downloadDatasheet(job.url)
        .then(async (download): Promise<Prefetched> => {
          if (!download.ok) return download;
          const path = join(dir, `fiche-${String(index).padStart(5, "0")}.pdf`);
          await writeFile(path, download.data);
          return { ok: true, path, pages: pdfPageCount(download.data) };
        })
        .catch((cause: unknown): Prefetched => ({ ok: false, reason: cause instanceof Error ? cause.message : String(cause) }));
      resolvers.get(job.value)!(result);
    }
  };
  for (let i = 0; i < Math.min(DOWNLOAD_CONCURRENCY, queue.length); i++) void worker();
  return results;
}

/** Relaie le book au navigateur, puis supprime le dossier temporaire. */
function relay(body: ReadableStream<Uint8Array>, cleanup: () => Promise<void>): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          await cleanup();
          return;
        }
        controller.enqueue(value);
      } catch (cause) {
        controller.error(cause);
        await cleanup();
      }
    },
    async cancel() {
      await reader.cancel().catch(() => undefined);
      await cleanup();
    },
  });
}
