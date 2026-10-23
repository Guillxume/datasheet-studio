import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { datasheetConfig } from "./registry";

/**
 * Le filet vertical des fiches faites a la main, entre « Choix des finitions »
 * et « Informations principales ». Sans lui, les deux moities flottent dans le
 * meme aplat gris et rien ne dit ou l'une finit.
 */

const Vide = () => null;

const rendre = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(
    datasheetConfig.components.Columns.render({
      ratio: "1fr 1fr",
      gap: 6,
      contentGap: 4,
      left: Vide,
      right: Vide,
      third: Vide,
      puck: { renderDropZone: Vide, metadata: {} },
      id: "test",
      ...props,
    } as never) as ReactElement,
  );

test("sans filet, le rendu est celui d'avant", () => {
  // Les templates deja publies n'en demandent pas : leur HTML ne doit pas bouger.
  assert.doesNotMatch(rendre({ divider: false }), /border-left/);
});

test("le filet borde les colonnes qui suivent la premiere", () => {
  const sortie = rendre({ divider: true, dividerColor: "#d9d9d9" });

  // Une seule bordure : a gauche de la deuxieme colonne, pas autour du bloc.
  assert.equal((sortie.match(/border-left/g) ?? []).length, 1);
  assert.match(sortie, /border-left:0\.2mm solid #d9d9d9/);
});
