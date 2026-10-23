import { requireApi } from "@/lib/guard";
import { MAX_SELECTION, parseSelection, slugifyName, zipEntryNames } from "@/lib/datasheets";
import { downloadDatasheet, type DatasheetDownload } from "@/lib/datasheetFetch";
import { datasheetsBySelection } from "@/lib/datasheetsStore";
import { ZipWriter } from "@/lib/zip";

/**
 * Telechargement groupe des fiches cochees sur /consultation.
 *
 * UN FORMULAIRE ET NON UN APPEL fetch : le navigateur gere alors lui-meme le
 * telechargement, sa progression et son nom de fichier, sans tenir l'archive
 * en memoire dans l'onglet.
 *
 * LE NAVIGATEUR N'ENVOIE QUE DES CLES, jamais d'adresse. Les URL viennent de
 * l'index, donc de la boutique authentifiee qui les a declarees en demandant
 * le rendu — et passent encore par `safeFetch`, qui refuse les adresses
 * privees. Sans cela, cette route serait un relais pour aller lire n'importe
 * quelle adresse depuis le serveur.
 *
 * EN FLUX : chaque fiche est ajoutee a l'archive des qu'elle est telechargee.
 * La reponse est donc deja partie quand une fiche echoue : l'echec ne peut plus
 * changer le statut HTTP. Il est ecrit dans un fichier « fiches-manquantes.txt »
 * en fin d'archive — une fiche absente sans explication serait pire.
 */

export const dynamic = "force-dynamic";

/** Telechargements lances d'avance : assez pour ne pas attendre, assez peu pour la memoire. */
const ZIP_AHEAD = 4;


export async function POST(request: Request): Promise<Response> {
  const auth = await requireApi("datasheets:read");
  if (auth instanceof Response) return auth;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "Formulaire illisible." }, { status: 400 });
  }

  const shopSlug = String(form.get("boutique") ?? "").trim();
  const selection = form
    .getAll("fiche")
    .map((value) => parseSelection(String(value)))
    .filter((item) => item !== null);

  if (shopSlug === "" || selection.length === 0) {
    return Response.json({ ok: false, error: "Aucune fiche selectionnee." }, { status: 400 });
  }
  if (selection.length > MAX_SELECTION) {
    return Response.json(
      { ok: false, error: `Selection limitee a ${MAX_SELECTION} fiches par archive.` },
      { status: 413 }
    );
  }

  const rows = (await datasheetsBySelection(shopSlug, selection)).filter((row) => row.datasheet_url !== null);
  if (rows.length === 0) {
    return Response.json(
      { ok: false, error: "Aucune des fiches selectionnees n'a d'adresse connue pour cette boutique." },
      { status: 404 }
    );
  }

  const names = zipEntryNames(
    rows.map((row) => ({ productKey: row.product_key, productName: row.product_name, locale: row.locale }))
  );
  const date = new Date().toISOString().slice(0, 10);
  const filename = `fiches-techniques-${slugifyName(shopSlug, 40)}-${date}.zip`;

  /*
   * TIRE PAR LE CLIENT, QUATRE FICHES D'AVANCE. La premiere version telechargeait
   * les fiches une par une dans `start()`, et poussait chacune dans le flux sans
   * attendre que le navigateur la lise : sur une connexion lente, toute
   * l'archive s'accumulait en memoire cote serveur, et le temps total etait la
   * somme des allers-retours vers la boutique (audit du 16/10/2026).
   *
   * Desormais `pull()` ne produit l'entree suivante que quand le client en
   * redemande, et au plus ZIP_AHEAD telechargements sont lances d'avance. La
   * memoire est bornee par cette fenetre, quelle que soit la taille de la
   * selection ; le temps, par la plus lente des quatre fiches en vol.
   */
  const writer = new ZipWriter();
  const missing: string[] = [];
  const downloads = new Map<number, Promise<DatasheetDownload>>();
  let launched = 0;
  let produced = 0;
  let cancelled = false;

  const launch = () => {
    while (!cancelled && launched < rows.length && launched < produced + ZIP_AHEAD) {
      const url = rows[launched].datasheet_url!;
      downloads.set(
        launched,
        downloadDatasheet(url).catch(
          (cause: unknown): DatasheetDownload => ({ ok: false, reason: cause instanceof Error ? cause.message : String(cause) })
        )
      );
      launched += 1;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // Jusqu'a avoir pousse quelque chose : une fiche manquante ne produit
        // rien, et un `pull` qui rend la main sans rien pousser n'est pas
        // forcement rappele.
        while (produced < rows.length) {
          launch();
          const index = produced;
          const result = await downloads.get(index)!;
          downloads.delete(index);
          produced += 1;
          launch();

          if (result.ok) {
            for (const part of writer.add({ name: names[index], data: result.data })) controller.enqueue(part);
            return;
          }
          const row = rows[index];
          missing.push(`${row.product_name} (${row.product_key}, ${row.locale}) : ${result.reason}`);
        }

        if (missing.length > 0) {
          const report =
            `${missing.length} fiche(s) sur ${rows.length} n'ont pas pu etre recuperees aupres de la boutique.\n\n` +
            missing.join("\n") +
            "\n";
          for (const part of writer.add({ name: "fiches-manquantes.txt", data: new TextEncoder().encode(report) })) {
            controller.enqueue(part);
          }
        }

        for (const part of writer.finish()) controller.enqueue(part);
        controller.close();
      } catch (cause) {
        // Une archive tronquee s'ouvrirait a moitie : mieux vaut que le
        // telechargement echoue franchement.
        controller.error(cause);
      }
    },
    cancel() {
      // Telechargement interrompu par le navigateur : ne plus rien lancer.
      cancelled = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
