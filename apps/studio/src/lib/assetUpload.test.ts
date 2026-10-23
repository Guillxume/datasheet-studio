import { test } from "node:test";
import assert from "node:assert/strict";
import { ASSET_MIMES, assetKeyFromName, uploadMime } from "./assetUpload";

/**
 * Une police n'arrivait pas jusqu'a la bibliotheque (bouton limite aux images,
 * type annonce en application/octet-stream), et un accent coutait une lettre a
 * la cle. Les deux se verrouillent ici.
 */

test("uploadMime : une police mal annoncee est reconnue a son extension", () => {
  assert.equal(uploadMime("application/octet-stream", "Jost-400.woff2"), "font/woff2");
  assert.equal(uploadMime("", "Jost-400.WOFF"), "font/woff");
  assert.equal(uploadMime("", "Marque.ttf"), "font/ttf");
  assert.equal(uploadMime("application/x-font-opentype", "Marque.otf"), "font/otf");
  // Les types obtenus sont bien ceux que le serveur accepte.
  for (const name of ["a.woff2", "a.woff", "a.ttf", "a.otf"]) {
    assert.ok(ASSET_MIMES.has(uploadMime("application/octet-stream", name)), name);
  }
});

test("uploadMime : un type deja exploitable est garde, un inconnu reste refusable", () => {
  assert.equal(uploadMime("image/png", "picto.png"), "image/png");
  assert.equal(uploadMime("font/woff2", "Jost.woff2"), "font/woff2");
  // Un fichier quelconque ne devient pas une police par magie.
  assert.equal(uploadMime("application/octet-stream", "notes.txt"), "application/octet-stream");
  assert.equal(uploadMime("application/pdf", "fiche.pdf"), "application/pdf");
});

test("assetKeyFromName : accents retires, lettre gardee", () => {
  assert.equal(assetKeyFromName("Logo Contoso Équipement.png"), "logo-contoso-equipement");
  assert.equal(assetKeyFromName("Garantie 3 ans (FR).png"), "garantie-3-ans-fr");
  assert.equal(assetKeyFromName("Jost-400.woff2"), "jost-400");
  assert.match(assetKeyFromName("x".repeat(90) + ".png"), /^[a-z0-9][a-z0-9._-]{0,63}$/);
});
