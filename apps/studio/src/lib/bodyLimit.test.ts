import { test } from "node:test";
import assert from "node:assert/strict";
import { capRequestBody } from "./bodyLimit";

/** Un corps « chunked » : un flux, sans Content-Length. */
function chunked(parts: string[], contentType: string): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
  return new Request("http://studio.test/api/v1/render", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

test("un corps sous le plafond se lit normalement", async () => {
  const { request, exceeded } = capRequestBody(chunked(['{"a":', "1}"], "application/json"), 100);
  assert.deepEqual(await request.json(), { a: 1 });
  assert.equal(exceeded(), false);
});

test("un corps chunked au-dela du plafond echoue en cours de lecture", async () => {
  const parts = Array.from({ length: 50 }, () => "x".repeat(1000));
  const { request, exceeded } = capRequestBody(chunked(parts, "text/plain"), 10_000);
  await assert.rejects(() => request.text());
  assert.equal(exceeded(), true);
});

test("le multipart plafonne reste lisible sous la limite", async () => {
  const form = new FormData();
  form.set("payload", '{"x":1}');
  const original = new Request("http://studio.test/", { method: "POST", body: form });
  const { request, exceeded } = capRequestBody(original, 1_000_000);
  const relu = await request.formData();
  assert.equal(relu.get("payload"), '{"x":1}');
  assert.equal(exceeded(), false);
});
