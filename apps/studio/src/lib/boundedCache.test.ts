import test from "node:test";
import assert from "node:assert/strict";
import { BoundedCache } from "./boundedCache";

/**
 * Un cache qui se trompe sert du contenu perime, ou grossit sans fin. Les deux
 * echouent en silence — d'ou ces tests, qui pilotent l'horloge plutot que
 * d'attendre.
 */

function horloge(depart = 1_000) {
  let maintenant = depart;
  return { lire: () => maintenant, avancer: (ms: number) => { maintenant += ms; } };
}

test("rend ce qu'on y a mis", () => {
  const cache = new BoundedCache<string>(1000, 60_000);
  cache.set("a", "valeur", 10);
  assert.equal(cache.get("a"), "valeur");
  assert.equal(cache.get("absent"), undefined);
});

test("une entree perimee n'est plus rendue", () => {
  const t = horloge();
  const cache = new BoundedCache<string>(1000, 60_000, t.lire);

  cache.set("a", "valeur", 10);
  t.avancer(59_999);
  assert.equal(cache.get("a"), "valeur");

  t.avancer(2);
  assert.equal(cache.get("a"), undefined);
  // Et la place est bien rendue, sinon le cache se remplit de fantomes.
  assert.equal(cache.stats.bytes, 0);
});

test("le plafond est tenu en octets", () => {
  const cache = new BoundedCache<string>(100, 60_000);

  cache.set("a", "x", 60);
  cache.set("b", "y", 60); // evince "a"

  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), "y");
  assert.ok(cache.stats.bytes <= 100);
});

test("l'eviction suit l'ordre d'insertion", () => {
  const cache = new BoundedCache<string>(100, 60_000);
  cache.set("a", "1", 30);
  cache.set("b", "2", 30);
  cache.set("c", "3", 30);

  cache.set("d", "4", 30); // 120 > 100 : "a" part

  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), "2");
  assert.equal(cache.get("d"), "4");
});

test("une entree plus grosse que le plafond n'est pas stockee", () => {
  // La garder viderait tout le cache pour un seul element.
  const cache = new BoundedCache<string>(100, 60_000);
  cache.set("a", "petit", 50);
  cache.set("enorme", "x", 200);

  assert.equal(cache.get("enorme"), undefined);
  assert.equal(cache.get("a"), "petit", "l'entree existante ne doit pas avoir ete evincee");
});

test("reecrire une cle ne compte pas deux fois", () => {
  const cache = new BoundedCache<string>(1000, 60_000);
  cache.set("a", "1", 100);
  cache.set("a", "2", 100);

  assert.equal(cache.stats.entries, 1);
  assert.equal(cache.stats.bytes, 100);
  assert.equal(cache.get("a"), "2");
});

test("delete et clear rendent la place", () => {
  const cache = new BoundedCache<string>(1000, 60_000);
  cache.set("a", "1", 100);
  cache.set("b", "2", 100);

  cache.delete("a");
  assert.equal(cache.stats.bytes, 100);

  cache.clear();
  assert.deepEqual(cache.stats, { entries: 0, bytes: 0 });
});

test("supprimer une cle absente ne fausse pas le compteur", () => {
  const cache = new BoundedCache<string>(1000, 60_000);
  cache.set("a", "1", 100);
  cache.delete("inconnue");
  assert.equal(cache.stats.bytes, 100);
});
