import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { datasheetConfig } from "./registry";

/**
 * UNE ABSENCE N'EST PAS UNE FINITION.
 *
 * Le catalogue Acme declare « Sans cloison », « Sans socle banc », « Sans
 * option » : des choix legitimes au moment de commander, mais qui n'ont rien a
 * faire dans un nuancier. La regle « pas de code hexadecimal, pas de pastille »
 * les ecartait toutes — sauf « Sans cloison », a laquelle la boutique a associe
 * une image de croix rouge (img/co/181.jpg). Elle s'imprimait donc parmi les
 * coloris disponibles, barree, sur les fiches de bureaux.
 */

const rendre = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(datasheetConfig.components.SwatchGroups.render(props as never) as ReactElement);

const COLORIS = [
  {
    label: "Coloris",
    options: [
      { label: "Sans cloison", image: "/assets/shared/croix" },
      { label: "Tissu Gris", color: "#a1a1a1" },
    ],
  },
];

test("sans consigne, la valeur d'absence s'imprime — le defaut ne change rien", () => {
  const sortie = rendre({ source: COLORIS, mapping: [], swatchSize: 7 });

  assert.match(sortie, /Sans cloison/);
});

test("la valeur d'absence est ecartee quand on la masque", () => {
  const sortie = rendre({ source: COLORIS, mapping: [], swatchSize: 7, exclude: "Sans" });

  assert.doesNotMatch(sortie, /Sans cloison/, "la croix rouge s'imprime encore");
  assert.match(sortie, /Tissu Gris/, "les vraies couleurs doivent rester");
});

test("le masque s'arrete sur une espace, jamais au milieu d'un mot", () => {
  // « Sans » ne doit pas ecarter une couleur qui s'appellerait « Sansone ».
  const source = [{ label: "Coloris", options: [{ label: "Sansone", color: "#123456" }] }];

  assert.match(rendre({ source, mapping: [], exclude: "Sans" }), /Sansone/);
});

test("un groupe entierement masque disparait, titre compris", () => {
  // Sinon la fiche annoncerait « Coloris » suivi de rien.
  const source = [{ label: "Coloris", options: [{ label: "Sans cloison", image: "/x" }] }];

  assert.equal(rendre({ source, mapping: [], exclude: "Sans" }).includes("Coloris"), false);
});
