import { test } from "node:test";
import assert from "node:assert/strict";
import { refusCrossOrigin } from "./origin";

const h = (entries: Record<string, string>) => new Headers(entries);
const STUDIO = "studio.acme.example";

test("une ecriture depuis le Studio passe", () => {
  assert.equal(refusCrossOrigin("POST", h({ host: STUDIO, origin: `https://${STUDIO}` })), null);
  assert.equal(refusCrossOrigin("DELETE", h({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" })), null);
  assert.equal(refusCrossOrigin("POST", h({ host: STUDIO, "sec-fetch-site": "same-origin" })), null);
});

test("une ecriture depuis une boutique du meme domaine est refusee", () => {
  // Le cas que SameSite=Lax laisse passer : meme site, autre origine.
  assert.match(refusCrossOrigin("POST", h({ host: STUDIO, origin: "https://www.acme.example" }))!, /www\.acme\.example/);
  assert.ok(refusCrossOrigin("POST", h({ host: STUDIO, "sec-fetch-site": "same-site" })));
  assert.ok(refusCrossOrigin("PUT", h({ host: STUDIO, origin: "https://evil.example" })));
  assert.ok(refusCrossOrigin("POST", h({ host: STUDIO, origin: "null" })));
  // Meme hote mais autre port : autre origine.
  assert.ok(refusCrossOrigin("POST", h({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3001" })));
});

test("les lectures et les clients sans navigateur ne sont pas concernes", () => {
  assert.equal(refusCrossOrigin("GET", h({ host: STUDIO, origin: "https://evil.example" })), null);
  assert.equal(refusCrossOrigin("POST", h({ host: STUDIO })), null);
});
