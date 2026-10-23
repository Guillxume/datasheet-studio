import { test } from "node:test";
import assert from "node:assert/strict";
import { datasheetConfig } from "./registry";

/**
 * Saut de page conditionnel.
 *
 * CE QUE CES CAS VERROUILLENT. Un meme template sert des produits de longueurs
 * differentes. Un saut inconditionnel place pour loger une description longue
 * produit une deuxieme page VIDE sur tous les produits qui n'en ont pas — et
 * une page vide part a l'impression comme les autres.
 *
 * Le piege est dans la resolution des tokens : `onlyIf` arrive au bloc DEJA
 * resolu. Un champ laisse vide et un token qui se resout en vide sont alors la
 * meme chaine. C'est pour cela que le mode est un champ separe, et c'est ce que
 * le premier cas ci-dessous protege — sans lui, on retomberait sur un champ
 * unique qui ne peut pas distinguer les deux situations.
 */

const bloc = datasheetConfig.components.PageBreak;

/** Le bloc rend-il quelque chose, ou s'efface-t-il ? */
function coupe(props: { mode?: string; onlyIf?: string }): boolean {
  const rendu = (bloc.render as (p: unknown) => { props?: { className?: string } })({
    ...bloc.defaultProps,
    ...props,
  });
  return rendu?.props?.className === "ds-pagebreak";
}

test("par defaut, le saut est inconditionnel", () => {
  // Le comportement d'avant l'ajout de la condition : les templates deja
  // composes ne doivent pas changer de rendu.
  assert.equal(coupe({}), true);
});

test("mode « toujours » : coupe meme si le champ testé est vide", () => {
  assert.equal(coupe({ mode: "always", onlyIf: "" }), true);
});

test("mode conditionnel, champ rempli : la page suivante existe", () => {
  assert.equal(coupe({ mode: "ifFilled", onlyIf: "Une description longue." }), true);
});

test("mode conditionnel, champ vide : AUCUNE page vide", () => {
  // Le cas qui justifie toute la fonctionnalite.
  assert.equal(coupe({ mode: "ifFilled", onlyIf: "" }), false);
});

test("mode conditionnel, champ absent du payload : aucune page", () => {
  // Un token qui ne resout rien laisse la prop indefinie, pas vide.
  assert.equal(coupe({ mode: "ifFilled", onlyIf: undefined }), false);
});

test("un champ ne contenant que des espaces ne vaut pas du contenu", () => {
  // Espaces, retour a la ligne, tabulation, espace INSECABLE : une description
  // faite de blancs ne doit pas couter une page.
  assert.equal(coupe({ mode: "ifFilled", onlyIf: " \n\t\u00a0 " }), false);
});

test("le bloc reste declare dans le groupe Structure", () => {
  // Le « + » du canvas insere « PageBreak » par son nom : si le composant est
  // renomme, le bouton echoue en silence.
  assert.ok(Object.keys(datasheetConfig.components).includes("PageBreak"));
});

/* ------------------------------------------------------------------ Pages */

/**
 * Le bloc « Page » sur le CHEMIN PDF.
 *
 * L'editeur, lui, rend une surface complete — c'est verifie dans un navigateur,
 * pas ici : `PageCanvas` n'a de sens qu'avec un contexte Puck. Ce qui se
 * verrouille ici est ce qui part a l'impression.
 */
const bloc2 = datasheetConfig.components.Page;

/** Rendu PDF d'une page : element racine, ou rien. */
function rendu(props: { mode?: string; onlyIf?: string }): { className?: string } | null {
  const sortie = (bloc2.render as (p: unknown) => { props?: { className?: string } })({
    ...bloc2.defaultProps,
    ...props,
    // Puck substitue un COMPOSANT au tableau d'un slot : le chemin PDF fait de
    // meme (voir renderNode dans src/lib/render.tsx).
    content: () => null,
  });
  return sortie?.props ?? null;
}

test("une page s'imprime dans un element porteur de la classe de coupure", () => {
  // Sans cette classe, la regle `.ds-page + .ds-page` ne s'applique a rien et
  // toutes les pages se suivent sur la meme feuille.
  assert.equal(rendu({})?.className, "ds-page");
});

test("une page conditionnelle non remplie ne rend RIEN a l'impression", () => {
  // Et pas un element vide : un element vide serait un frere pour la regle de
  // coupure, qui couperait donc vers une page absente.
  assert.equal(rendu({ mode: "ifFilled", onlyIf: "" })?.className, undefined);
});

test("une page conditionnelle remplie s'imprime normalement", () => {
  assert.equal(rendu({ mode: "ifFilled", onlyIf: "Une description." })?.className, "ds-page");
});

test("le bloc Page reste declare sous ce nom : le « + » l'insere par son nom", () => {
  assert.ok(Object.keys(datasheetConfig.components).includes("Page"));
});
