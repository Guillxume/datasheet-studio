import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { datasheetConfig } from "./registry";

/**
 * UN POURCENTAGE DE LARGEUR NE BORNE PAS UNE HAUTEUR.
 *
 * Le champ « Largeur » du schema est en POURCENTAGE de la colonne. Un dessin
 * haut et etroit demande a 92 % occupait donc 92 % de 186 mm de large — et la
 * hauteur que son rapport imposait, soit une feuille entiere, avec un
 * debordement sur la suivante. Constate sur le vestiaire 474 de la boutique
 * Acme, dont la fiche sortait sur quatre pages dont deux quasi vides.
 *
 * Le bloc Image portait deja ce plafond. Celui-ci ne l'avait pas.
 */

const rendre = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(datasheetConfig.components.SchemaImage.render(props as never) as ReactElement);

const SRC = "/assets/shared/schema-vestiaire";

test("sans plafond, la largeur en pourcentage pilote — comportement d'origine", () => {
  const sortie = rendre({ source: SRC, width: 92, maxHeight: 0, align: "center" });

  assert.match(sortie, /width:92%/, "la largeur en pourcentage doit rester appliquee");
  assert.doesNotMatch(sortie, /max-height/, "aucun plafond ne doit etre pose");
});

test("avec un plafond, c'est la hauteur qui pilote", () => {
  const sortie = rendre({ source: SRC, width: 92, maxHeight: 90, align: "center" });

  assert.match(sortie, /max-height:90mm/, "le plafond demande n'est pas applique");
  // `width:auto` laisse le rapport de l'image choisir la largeur qui tient dans
  // cette hauteur. Sans cela, l'image serait etiree a 92 % et deborderait.
  assert.match(sortie, /width:auto/, "la largeur doit suivre le rapport de l'image");
  assert.match(sortie, /max-width:92%/, "la largeur demandee reste une borne superieure");
});

test("un schema absent ne laisse aucune trace", () => {
  // Le cas courant : la plupart des produits n'ont pas de schema. Un conteneur
  // vide ajouterait un espacement dans la colonne, visible sur le document.
  assert.equal(rendre({ source: "", width: 92, maxHeight: 90, align: "center" }), "");
});
