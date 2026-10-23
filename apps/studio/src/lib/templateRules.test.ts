import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_TEMPLATE,
  MAX_REF_LENGTH,
  TemplateResolver,
  templateRulesSchema,
  unsafePattern,
  type MatchInput,
} from "./templateRules";

/**
 * Le moteur est desormais partage entre les collecteurs et le Studio. Ses onze
 * tests d'origine vivent toujours dans collectors/core/templateRules.test.ts et
 * couvrent la correspondance elle-meme — heritage de categorie, score de
 * specificite, accents.
 *
 * CE FICHIER COUVRE CE QUE LE PARTAGE AJOUTE : la forme d'entree reduite
 * (MatchInput), la validation du jeu de regles, et le fait que le template
 * impose n'est PLUS traite par le moteur — c'est le changement qui pouvait
 * casser silencieusement les deux appelants.
 */

const produit = (categoryPath: string[], extra: Partial<MatchInput> = {}): MatchInput => ({
  categoryPath,
  brand: null,
  ref: "REF-1",
  ...extra,
});

const jeu = new TemplateResolver({
  default: "fiche-01",
  rules: [
    { category: ["Manutention", "Transpalettes"], template: "fiche-transpalette" },
    { category: ["Manutention"], template: "fiche-manutention" },
    { category_any: ["Poufs"], template: "fiche-simple" },
    { ref: "^RAY-", template: "fiche-rayonnage" },
  ],
});

test("le moteur travaille sur MatchInput, pas sur un produit collecte", () => {
  // C'est ce qui permet au Studio (qui a un payload) et au collecteur (qui a un
  // CollectedProduct) d'obtenir le meme resultat sans se connaitre.
  assert.equal(jeu.resolve(produit(["Manutention", "Transpalettes"])), "fiche-transpalette");
  assert.equal(jeu.resolve(produit(["Manutention", "Gerbeurs"])), "fiche-manutention");
  assert.equal(jeu.resolve(produit(["Bureautique"])), "fiche-01");
});

test("LE TEMPLATE IMPOSE N'EST PLUS TRAITE PAR LE MOTEUR", () => {
  /*
   * Le changement le plus dangereux du demenagement. La version collecteur
   * commencait par `if (product.template) return product.template`. Si le moteur
   * l'avait garde, le Studio n'aurait jamais pu appeler `resolve` — le payload
   * porte TOUJOURS un `template`, qui vaut « auto » justement pour demander une
   * resolution. Le moteur aurait rendu « auto », et le rendu aurait cherche un
   * template nomme « auto ».
   *
   * Chaque appelant decide donc s'il POSE la question : le collecteur teste
   * `product.template`, la route de rendu teste `=== AUTO_TEMPLATE`.
   */
  const avecTemplate = { ...produit(["Bureautique"]), template: "fiche-imposee" } as MatchInput;
  assert.equal(jeu.resolve(avecTemplate), "fiche-01", "le moteur ne doit lire aucun champ template");
});

test("les criteres non hierarchiques attrapent ce que le prefixe ne peut pas", () => {
  // Le cas PrestaShop : "Promo,Bureaux,Gammes" ne commence pas par la categorie
  // utile, donc aucune regle de prefixe ne s'applique.
  assert.equal(jeu.resolve(produit(["Promo", "Mobilier", "Poufs"])), "fiche-simple");
  assert.equal(jeu.resolve(produit(["Rayonnage"], { ref: "RAY-77" })), "fiche-rayonnage");
});

test("sans regle ni defaut, le moteur rend null plutot que de deviner", () => {
  const nu = new TemplateResolver({ rules: [] });
  assert.equal(nu.resolve(produit(["Quoi que ce soit"])), null);
});

test("le repli passe en second argument sert quand le jeu n'a pas de defaut", () => {
  const avecRepli = new TemplateResolver({ rules: [] }, "fiche-de-secours");
  assert.equal(avecRepli.resolve(produit([])), "fiche-de-secours");

  // Et le defaut du jeu l'emporte sur le repli de l'appelant.
  const avecLesDeux = new TemplateResolver({ default: "fiche-du-jeu", rules: [] }, "fiche-de-secours");
  assert.equal(avecLesDeux.resolve(produit([])), "fiche-du-jeu");
});

test("targets liste tout ce que le jeu peut produire, defaut compris", () => {
  // C'est ce qui permet de verifier d'avance que les slugs existent, plutot que
  // de le decouvrir au 300e produit.
  const cibles = jeu.targets().sort();
  assert.deepEqual(cibles, [
    "fiche-01",
    "fiche-manutention",
    "fiche-rayonnage",
    "fiche-simple",
    "fiche-transpalette",
  ]);
});

test("un fil d'ariane absent ou vide ne fait pas lever", () => {
  assert.equal(jeu.resolve({ categoryPath: [] }), "fiche-01");
  assert.equal(jeu.resolve({ categoryPath: [], brand: null, ref: null }), "fiche-01");
});

test("une regle sans aucun critere est refusee par le schema", () => {
  // Elle s'appliquerait a tout, ce qui est le role du template par defaut.
  const parse = templateRulesSchema.safeParse({ rules: [{ template: "fiche-01" }] });
  assert.equal(parse.success, false);
  assert.match(JSON.stringify(parse.error?.issues), /sans critere/);
});

test("le schema accepte un jeu vide", () => {
  // Une boutique sans regle est un etat legitime : elle n'a qu'un defaut.
  assert.equal(templateRulesSchema.safeParse({ default: "fiche-01" }).success, true);
  assert.equal(templateRulesSchema.safeParse({}).success, true);
});

test("« auto » est la valeur reservee du contrat", () => {
  // Fige la constante : c'est une valeur PUBLIQUE, ecrite dans les modules des
  // boutiques. La changer casserait chaque appelant.
  assert.equal(AUTO_TEMPLATE, "auto");
});

test("unsafePattern refuse les motifs a retour arriere exponentiel", () => {
  for (const piege of ["(a+)+$", "(a*)*b", "(a|aa)+$", "(\\d+)*X", "([A-Z]+-?)+$", "(a{1,})+", "(x+x+)+y", "(a)\\1", "(?<n>a)\\k<n>"]) {
    assert.ok(unsafePattern(piege), piege);
  }
  assert.match(unsafePattern("(")!, /invalide/);
});

test("unsafePattern accepte ce qu'on ecrit pour une reference produit", () => {
  for (const sur of ["^TR-\\d+$", "^(PAL|TRP)-", "^[A-Z]{2,3}-\\d{4}$", "(ab){3}", "^VS\\d+(-[A-Z])?$", "\\.(png|jpg)$", "^(?:BU|TA)\\d*"]) {
    assert.equal(unsafePattern(sur), null, sur);
  }
});

test("une regle dangereuse deja en base ne bloque pas le processus", () => {
  // Saisie avant le controle : elle ne correspond plus a rien, sans planter.
  const resolver = new TemplateResolver({ rules: [{ ref: "(a+)+$", template: "piege" }], default: "defaut" });
  const debut = Date.now();
  assert.equal(resolver.resolve({ categoryPath: [], ref: "a".repeat(40) + "!" }), "defaut");
  assert.ok(Date.now() - debut < 100);
});

test("une reference demesuree n'est pas comparee", () => {
  const resolver = new TemplateResolver({ rules: [{ ref: "^A", template: "a" }], default: "defaut" });
  assert.equal(resolver.resolve({ categoryPath: [], ref: "A".repeat(MAX_REF_LENGTH) }), "a");
  assert.equal(resolver.resolve({ categoryPath: [], ref: "A".repeat(MAX_REF_LENGTH + 1) }), "defaut");
});

test("le schema des fichiers de regles refuse un motif dangereux", () => {
  const verdict = templateRulesSchema.safeParse({ rules: [{ ref: "(a+)+$", template: "x" }] });
  assert.ok(!verdict.success);
});
