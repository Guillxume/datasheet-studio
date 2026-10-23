import { test } from "node:test";
import assert from "node:assert/strict";
import { StudioClient, StudioError } from "./client";
import type { RenderRequest } from "@/lib/payload";
import type { CollectedAsset } from "./types";

/**
 * La distinction entre « a retenter » et « a corriger » est le coeur d'une
 * generation en masse correcte : sans elle, une saturation passagere du moteur
 * se confond avec un template casse, et l'un se rejoue quand l'autre demande une
 * correction. C'est ce que verifient ces assertions, avec ce qu'elles
 * supposent : un corps refabrique a chaque tentative, et l'en-tete Retry-After
 * respecte.
 */

const payload = {
  template: "fiche-technique-01",
  version: "published",
  locale: "fr",
  data: {
    shop: { name: "Test", colors: {}, company: {} },
    product: { name: "Produit", category_path: [] },
    features: [],
    images: [],
    schema_image: null,
    badges: [],
    qr_code: null,
    custom: {},
  },
} as unknown as RenderRequest;

const asset = (key = "img-0"): CollectedAsset => ({
  key,
  mime: "image/jpeg",
  bytes: Buffer.from("des octets"),
  fingerprint: "1024:1700000000000",
});

type Call = { url: string; init: RequestInit };

function stub(responses: Array<() => Response>) {
  const calls: Call[] = [];
  const waits: number[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("appel inattendu");
    return next();
  }) as unknown as typeof fetch;

  const client = new StudioClient({
    url: "https://studio.exemple.fr",
    key: "sk_test",
    fetchImpl,
    waitImpl: async (ms) => {
      waits.push(ms);
    },
  });
  return { client, calls, waits };
}

const pdf = (headers: Record<string, string> = {}) =>
  new Response(new Uint8Array(Buffer.from("%PDF-1.4")), {
    status: 200,
    headers: { "content-type": "application/pdf", "x-template-version": "7", ...headers },
  });

const jsonError = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

test("sans piece jointe, le corps est du JSON", async () => {
  const { client, calls } = stub([() => pdf()]);
  const result = await client.render(payload);

  assert.equal(calls[0].url, "https://studio.exemple.fr/api/v1/render");
  assert.equal((calls[0].init.headers as Record<string, string>)["content-type"], "application/json");
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, "Bearer sk_test");
  assert.equal(result.templateVersion, 7);
});

test("avec une piece jointe, le corps est un multipart nomme asset[cle]", async () => {
  const { client, calls } = stub([() => pdf()]);
  await client.render(payload, [asset()]);

  const form = calls[0].init.body as FormData;
  assert.ok(form instanceof FormData);
  assert.equal(typeof form.get("payload"), "string");
  assert.ok(form.get("asset[img-0]") instanceof Blob);
  // fetch pose lui-meme le boundary : un content-type fixe le casserait.
  assert.equal((calls[0].init.headers as Record<string, string>)["content-type"], undefined);
});

test("un 429 est rejoue en respectant Retry-After", async () => {
  const { client, calls, waits } = stub([
    () => jsonError(429, { error: "Moteur sature" }, { "retry-after": "5" }),
    () => pdf(),
  ]);

  const result = await client.render(payload);
  assert.equal(calls.length, 2);
  // Le serveur seul sait ou en est sa file : on suit son en-tete plutot que
  // notre propre idee du rythme.
  assert.deepEqual(waits, [5000]);
  assert.equal(result.bytes > 0, true);
});

test("le corps est refabrique a chaque tentative, sinon le rejeu part a vide", async () => {
  const { client, calls } = stub([
    () => jsonError(502, { error: "Chromium a lache" }),
    () => pdf(),
  ]);

  await client.render(payload, [asset()]);
  const first = calls[0].init.body as FormData;
  const second = calls[1].init.body as FormData;
  assert.notEqual(first, second);
  assert.ok(second.get("asset[img-0]") instanceof Blob);
});

test("un 422 n'est pas rejoue et nomme le champ fautif", async () => {
  const { client, calls } = stub([
    () =>
      jsonError(422, {
        error: "Payload invalide",
        detail: [{ path: ["data", "product", "name"], message: "Required" }],
      }),
  ]);

  await assert.rejects(
    () => client.render(payload),
    (error: unknown) => {
      assert.ok(error instanceof StudioError);
      assert.equal(error.retryable, false);
      assert.match(error.describe(), /data\.product\.name/);
      return true;
    }
  );
  assert.equal(calls.length, 1);
});

test("une panne reseau est rejouable", async () => {
  let attempts = 0;
  const fetchImpl = (async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError("fetch failed");
    return pdf();
  }) as unknown as typeof fetch;

  const client = new StudioClient({
    url: "https://studio.exemple.fr",
    key: "sk_test",
    fetchImpl,
    waitImpl: async () => {},
  });

  const result = await client.render(payload);
  assert.equal(attempts, 2);
  assert.equal(result.templateVersion, 7);
});

test("les avertissements de rendu sont decodes, un asset manquant ne fait pas echouer", async () => {
  const warnings = "asset introuvable a images.0.src : asset://img-0 | asset introuvable a shop.logo";
  const { client } = stub([() => pdf({ "x-render-warnings": encodeURIComponent(warnings) })]);

  const result = await client.render(payload);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /images\.0\.src/);
});

test("un corps trop lourd est refuse localement, en nommant la piece en cause", async () => {
  // Un 413 n'est PAS rejouable : la fiche irait en quarantaine avec un message
  // qui ne dit pas quelle image est en cause. Ici, on peut la nommer.
  const client = new StudioClient({
    url: "https://studio.exemple.fr",
    key: "sk_test",
    maxRequestBytes: 1024,
    fetchImpl: (async () => pdf()) as unknown as typeof fetch,
  });

  const enorme: CollectedAsset = { ...asset("schema"), bytes: Buffer.alloc(4096) };
  await assert.rejects(
    () => client.render(payload, [asset(), enorme]),
    (error: unknown) => {
      assert.ok(error instanceof StudioError);
      assert.equal(error.status, 413);
      assert.match(String(error.detail), /schema/);
      return true;
    }
  );
});

test("GET /templates remonte les versions publiees", async () => {
  const { client } = stub([
    () =>
      new Response(
        JSON.stringify({
          templates: [
            { slug: "fiche-technique-01", published_version: 7, selectable: true },
            { slug: "brouillon", published_version: null, selectable: false },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ),
  ]);

  const templates = await client.templates();
  assert.equal(templates.length, 2);
  assert.equal(templates[0].published_version, 7);
});
