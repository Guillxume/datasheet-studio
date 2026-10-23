import { test } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_THEME_KEY, SETTINGS_STORAGE_KEY, THEME_PREPAINT_SCRIPT } from "./theme";

/**
 * Le script de pre-peinture execute pour de vrai, contre un faux document :
 * c'est la seule facon de savoir ce qu'il fait d'un stockage donne.
 */
function executer(stockage: Record<string, string>, systemeSombre = false) {
  const classes = new Set<string>();
  const localStorage = {
    getItem: (k: string) => (k in stockage ? stockage[k] : null),
    setItem: (k: string, v: string) => {
      stockage[k] = v;
    },
    removeItem: (k: string) => {
      delete stockage[k];
    },
  };
  const document = { documentElement: { classList: { add: (c: string) => classes.add(c) } } };
  const window = { matchMedia: () => ({ matches: systemeSombre }) };
  new Function("localStorage", "document", "window", THEME_PREPAINT_SCRIPT)(localStorage, document, window);
  return { sombre: classes.has("dark"), stockage };
}

test("un choix « Sombre » enregistre pose .dark, meme sur un systeme clair", () => {
  const { sombre } = executer({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ theme: "dark" }) });
  assert.equal(sombre, true);
});

test("sans choix, le systeme decide", () => {
  assert.equal(executer({}, true).sombre, true);
  assert.equal(executer({}, false).sombre, false);
});

test("l'ancien choix du Studio est repris une fois, puis efface", () => {
  const { sombre, stockage } = executer({ [LEGACY_THEME_KEY]: "dark" });
  assert.equal(sombre, true);
  assert.deepEqual(JSON.parse(stockage[SETTINGS_STORAGE_KEY]), { theme: "dark" });
  assert.equal(stockage[LEGACY_THEME_KEY], undefined);
});

test("l'ancien choix ne remplace pas un choix deja fait dans le nouveau stockage", () => {
  const { sombre, stockage } = executer({
    [LEGACY_THEME_KEY]: "dark",
    [SETTINGS_STORAGE_KEY]: JSON.stringify({ theme: "light" }),
  });
  assert.equal(sombre, false);
  assert.deepEqual(JSON.parse(stockage[SETTINGS_STORAGE_KEY]), { theme: "light" });
});

test("un stockage bloque ne fait pas echouer le script", () => {
  const bloque = new Proxy(
    {},
    {
      get() {
        throw new Error("SecurityError");
      },
    },
  );
  const document = { documentElement: { classList: { add: () => {} } } };
  const window = { matchMedia: () => ({ matches: false }) };
  assert.doesNotThrow(() =>
    new Function("localStorage", "document", "window", THEME_PREPAINT_SCRIPT)(bloque, document, window),
  );
});
