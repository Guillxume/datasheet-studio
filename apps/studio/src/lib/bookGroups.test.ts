import { test } from "node:test";
import assert from "node:assert/strict";
import { bookSections, initialGroups, moveToGroup, removeFiche, reorderInGroup, type Divider, type GroupedFiche } from "./bookGroups";

const fiche = (value: string, name: string, category: string): GroupedFiche => ({ value, name, productId: value, category });
const dividers: Divider[] = [
  { id: "bureaux", title: "Bureaux", categories: ["Bureaux d'entreprise"] },
  { id: "entrepot", title: "Mobilier d'entrepôt et d'atelier", categories: ["Mobilier d'entrepôt et d'atelier", "Mobilier d' Atelier"] },
  { id: "accessoires", title: "Accessoires", categories: ["Accessoires et aménagement bureau"] },
];
const fiches = [
  fiche("fr:2", "Établi", "Mobilier d' Atelier"),
  fiche("fr:1", "Bureau droit", "Bureaux d'entreprise"),
  fiche("fr:3", "Banque d'accueil", "Meuble d'accueil"),
  fiche("fr:4", "Armoire d'atelier", "Mobilier d'entrepôt et d'atelier"),
];
const names = (groups: ReturnType<typeof initialGroups>) =>
  groups.map((group) => `${group.dividerId ?? "suite"}[${group.fiches.map((item) => item.name).join(",")}]`).join(" ");

test("chaque fiche va sous l'intercalaire de sa categorie, les autres a la suite", () => {
  assert.equal(
    names(initialGroups(fiches, dividers)),
    "bureaux[Bureau droit] entrepot[Armoire d'atelier,Établi] accessoires[] suite[Banque d'accueil]"
  );
});

test("une fiche sans intercalaire peut passer sous la banniere d'un autre", () => {
  const groups = moveToGroup(initialGroups(fiches, dividers), "fr:3", "accessoires");
  assert.equal(names(groups), "bureaux[Bureau droit] entrepot[Armoire d'atelier,Établi] accessoires[Banque d'accueil] suite[]");
});

test("deplacer, reordonner, retirer : aucune fiche perdue ni dupliquee", () => {
  let groups = initialGroups(fiches, dividers);
  groups = moveToGroup(groups, "fr:1", "entrepot");
  groups = reorderInGroup(groups, "entrepot", 2, 0);
  assert.equal(names(groups), "bureaux[] entrepot[Bureau droit,Armoire d'atelier,Établi] accessoires[] suite[Banque d'accueil]");
  assert.equal(groups.flatMap((group) => group.fiches).length, fiches.length);
  groups = removeFiche(groups, "fr:2");
  assert.equal(groups.flatMap((group) => group.fiches).length, fiches.length - 1);
});

test("un deplacement vers un groupe inconnu ne fait rien", () => {
  const groups = initialGroups(fiches, dividers);
  assert.equal(moveToGroup(groups, "fr:1", "inexistant"), groups);
});

test("le book n'imprime que les sections non vides, la suite en dernier", () => {
  const sections = bookSections(moveToGroup(initialGroups(fiches, dividers), "fr:3", "bureaux"));
  assert.deepEqual(sections, [
    { divider: "bureaux", fiches: ["fr:1", "fr:3"], printDivider: true },
    { divider: "entrepot", fiches: ["fr:4", "fr:2"], printDivider: true },
  ]);
});

test("un intercalaire peut etre saute sans deplacer ses fiches", () => {
  const sections = bookSections(initialGroups(fiches, dividers), new Set(["entrepot"]));
  assert.deepEqual(
    sections.map((section) => [section.divider, section.printDivider, section.fiches.length]),
    [
      ["bureaux", true, 1],
      ["entrepot", false, 2],
      [null, true, 1],
    ]
  );
});

test("une categorie listee par deux intercalaires va sous le premier", () => {
  const doublon: Divider[] = [...dividers, { id: "autre", title: "Autre", categories: ["Bureaux d'entreprise"] }];
  assert.equal(initialGroups(fiches, doublon)[0].fiches.length, 1);
});
