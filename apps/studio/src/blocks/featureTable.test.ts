import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { datasheetConfig } from "./registry";

/**
 * Un nombre impair de caracteristiques sur deux colonnes laisse la colonne de
 * droite une ligne plus courte. Elle etait comblee d'une case filetee et zebree :
 * sur la fiche, une caracteristique vide sous la derniere.
 */

const render = (source: unknown): string =>
  renderToStaticMarkup(
    (datasheetConfig.components.FeatureTable.render as (props: unknown) => ReactElement)({
      source,
      pairs: 2,
    })
  );

const cellules = (html: string): string[] => html.match(/<td[^>]*>/g) ?? [];

test("deux colonnes, nombre impair : pas de case fantome a droite", () => {
  const html = render([
    { name: "Gamme", value: "Actéa" },
    { name: "Chants", value: "Chant droit" },
    { name: "Option", value: "Cloison\nGoulotte" },
  ]);

  // Deux lignes. Ligne 1 : paire, gouttiere, paire. Ligne 2 : paire, gouttiere,
  // et une seule cellule nue pour la place restante.
  const nues = cellules(html).filter((td) => !td.includes("style"));
  assert.equal(nues.length, 3, "deux gouttieres et une place vide, toutes sans style");
  assert.match(html, /<td colspan="2"><\/td>/i, "la place restante n'a ni filet ni fond");
  assert.equal(cellules(html).filter((td) => td.includes("style")).length, 6, "trois paires mises en forme, pas quatre");
});

test("deux colonnes, nombre pair : rien ne change", () => {
  const html = render([
    { name: "Gamme", value: "Actéa" },
    { name: "Chants", value: "Chant droit" },
  ]);

  assert.doesNotMatch(html, /colspan/);
});
