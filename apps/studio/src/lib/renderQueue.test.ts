import { test } from "node:test";
import assert from "node:assert/strict";
import { RenderLimiter } from "./renderQueue";

/**
 * Le sas protege de l'epuisement memoire sous generation en masse. Une erreur ici
 * ne se verrait pas en developpement — elle se verrait en production, sous charge,
 * et sous la forme d'un processus tue. D'ou ces assertions sur les quatre points ou
 * un semaphore naif se trompe : l'equite, la double liberation, la file pleine et
 * l'attente qui n'en finit pas.
 */

test("accorde les places jusqu'au plafond, sans attendre", async () => {
  const limiter = new RenderLimiter(2, 4, 1000);

  const first = await limiter.acquire();
  const second = await limiter.acquire();

  assert.ok(first);
  assert.ok(second);
  assert.equal(first.queuedMs, 0);
  assert.deepEqual(limiter.stats.active, 2);
});

test("une place liberee va au premier en attente, pas au dernier arrive", async () => {
  // L'equite n'est pas cosmetique : sans elle, une boutique qui pousse en continu
  // affame les requetes deja en file, dont le socket reste ouvert pour rien.
  const limiter = new RenderLimiter(1, 4, 1000);

  const held = await limiter.acquire();
  assert.ok(held);

  const order: string[] = [];
  const a = limiter.acquire().then((slot) => {
    order.push("a");
    return slot;
  });
  const b = limiter.acquire().then((slot) => {
    order.push("b");
    return slot;
  });

  assert.equal(limiter.stats.waiting, 2);

  held.slot.release();
  const first = await a;
  assert.deepEqual(order, ["a"], "le premier en file passe d'abord");
  assert.ok(first);

  first.slot.release();
  assert.ok(await b);
  assert.deepEqual(order, ["a", "b"]);
});

test("le temps d'attente est mesure", async () => {
  const limiter = new RenderLimiter(1, 4, 1000);
  const held = await limiter.acquire();
  assert.ok(held);

  const pending = limiter.acquire();
  await new Promise((resolve) => setTimeout(resolve, 25));
  held.slot.release();

  const waited = await pending;
  assert.ok(waited);
  assert.ok(waited.queuedMs >= 20, `attente mesuree a ${waited.queuedMs} ms`);
});

test("file pleine : refus immediat plutot qu'attente", async () => {
  const limiter = new RenderLimiter(1, 1, 1000);

  const held = await limiter.acquire();
  assert.ok(held);
  const queued = limiter.acquire();
  assert.equal(limiter.stats.waiting, 1);

  // La place suivante n'est pas mise en file : l'appelant doit repondre 429 tout
  // de suite, une requete qui patiente tenant un socket et sa memoire.
  assert.equal(await limiter.acquire(), null);

  held.slot.release();
  assert.ok(await queued);
});

test("une attente trop longue rend la main", async () => {
  const limiter = new RenderLimiter(1, 4, 20);
  const held = await limiter.acquire();
  assert.ok(held);

  assert.equal(await limiter.acquire(), null, "au-dela du delai, on renonce");
  assert.equal(limiter.stats.waiting, 0, "le renoncant quitte la file");

  // La place tenue reste valide : renoncer ne doit rien liberer de travers.
  held.slot.release();
  assert.equal(limiter.stats.active, 0);
});

test("liberer deux fois ne libere pas deux places", async () => {
  const limiter = new RenderLimiter(1, 4, 1000);
  const held = await limiter.acquire();
  assert.ok(held);

  held.slot.release();
  held.slot.release();

  assert.equal(limiter.stats.active, 0, "et non -1, qui accorderait une place de trop");
});
