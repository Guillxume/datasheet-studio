import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLES } from "./demo/products";

/**
 * Rend les fiches de demonstration PAR L'API PUBLIQUE, comme le ferait une
 * boutique : POST /api/v1/render, cle de la boutique en Bearer, payload et
 * images en multipart.
 *
 *   STUDIO_URL=http://localhost:3000 DEMO_API_KEY=sk_... tsx scripts/demo-samples.ts [--out <dossier>]
 *
 * --out ecrit aussi chaque PDF dans le dossier donne, nomme d'apres la reference.
 *
 * Chaque rendu passe par le journal et indexe la fiche : c'est ce qui remplit
 * /journal et /consultation sur une instance neuve. Relancer rend les memes
 * produits une fois de plus — l'index les met a jour, le journal s'allonge.
 *
 * Client HTTP seulement : aucune connexion a la base.
 */

const IMAGES = join(process.cwd(), "scripts", "demo", "images");

async function main(): Promise<void> {
  const base = (process.env.STUDIO_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const key = process.env.DEMO_API_KEY ?? process.env.STUDIO_KEY;
  if (!key) throw new Error("DEMO_API_KEY (ou STUDIO_KEY) manquant.");

  const index = process.argv.indexOf("--out");
  const out = index === -1 ? null : process.argv[index + 1];
  if (out) mkdirSync(out, { recursive: true });

  let failures = 0;
  for (const sample of SAMPLES) {
    const form = new FormData();
    form.set(
      "payload",
      JSON.stringify({ template: sample.template, version: "published", locale: "fr", data: sample.data })
    );
    for (const [asset, file] of Object.entries(sample.assets)) {
      const bytes = readFileSync(join(IMAGES, file));
      form.set(`asset[${asset}]`, new Blob([new Uint8Array(bytes)], { type: "image/svg+xml" }), file);
    }

    const started = Date.now();
    const response = await fetch(`${base}/api/v1/render`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
    });
    const { name, sku } = sample.data.product as { name: string; sku: string };

    if (response.ok) {
      const pdf = await response.arrayBuffer();
      if (out) writeFileSync(join(out, `${sku}.pdf`), Buffer.from(pdf));
      console.log(
        `rendu  ${sample.template.padEnd(22)} ${name}  (${pdf.byteLength} octets, ${Date.now() - started} ms)`
      );
    } else {
      failures += 1;
      console.error(`ECHEC  ${sample.template.padEnd(22)} ${name}  HTTP ${response.status} ${await response.text()}`);
    }
  }

  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
