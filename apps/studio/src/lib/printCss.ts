/**
 * Feuille de base du document imprime, en morceaux reutilisables.
 *
 * Module a part, et sans aucune dependance, pour une raison de bundle : la
 * feuille est consommee par le canvas de l'editeur, cote NAVIGATEUR. La lire
 * depuis src/lib/html.ts y aurait entraine `sanitize-html`, plusieurs dizaines de
 * kilooctets dont l'editeur n'a aucun usage.
 *
 * Le partage lui-meme n'est pas cosmetique. La hauteur d'un bloc de texte depend
 * de la police, du corps et de l'interligne : un canvas en `system-ui` 15px ne
 * peut pas montrer ou coupera une page d'un document en Arial 10pt. C'etait la
 * divergence la plus insidieuse entre l'editeur et le PDF, parce qu'elle ne se
 * voit pas — elle se mesure. Deux feuilles distinctes divergeraient a la premiere
 * retouche ; il n'y en a donc qu'une.
 */

/** Typographie du document, en DECLARATIONS seules (sans selecteur). */
export const PRINT_TYPOGRAPHY = `
  font-family: var(--font-body, Arial, Helvetica, sans-serif);
  font-size: 10pt;
  line-height: 1.4;
  color: var(--color-text, #1a1a1a);
`;

/**
 * Regles visant les ELEMENTS du document, donc imbricables sous la surface de
 * page du canvas. Tout ce qui vise `html` ou `body` est volontairement reste
 * dans src/lib/html.ts, qui construit le document complet.
 */
export const PRINT_ELEMENT_CSS = `
*, *::before, *::after { box-sizing: border-box; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; }

/* Repeter l'en-tete d'un tableau de caracteristiques qui deborde sur
   plusieurs pages, et ne jamais couper une ligne en deux. */
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr, li, figure { break-inside: avoid; }
h1, h2, h3, h4, h5, h6 { break-after: avoid; }

/* Une image seule ne doit pas se retrouver orpheline en bas de page. */
.ds-gallery, .ds-schema { break-inside: avoid; }

.ds-pagebreak { break-after: page; }

/* Une page commence sur une nouvelle feuille — SAUF la premiere.
   Le selecteur de frere adjacent, et non un break-after porte par chaque
   page : une page conditionnelle qui ne s'imprime pas n'est pas dans le
   document, elle ne peut donc pas laisser derriere elle une coupure vers une
   page qui n'existe plus. Et la derniere page ne produit aucune feuille
   blanche, puisqu'elle n'a pas de suivante. */
.ds-page + .ds-page { break-before: page; }
`;
