import { test } from "node:test";
import assert from "node:assert/strict";
import { TemplateResolver, templateRulesSchema } from "./templateRules";
import type { CollectedProduct } from "./types";

const rules = new TemplateResolver(
  templateRulesSchema.parse({
    default: "fiche-technique-01",
    rules: [
      { category: ["Manutention", "Transpalettes"], template: "fiche-transpalette" },
      { category: ["Manutention"], template: "fiche-manutention" },
      { brand: "Fabrikam", template: "fiche-atelier" },
      { ref: "^ETA-", template: "fiche-etabli" },
    ],
  })
);

const product = (
  categoryPath: string[],
  over: Partial<CollectedProduct["data"]["product"]> = {},
  ref = "REF-1"
): CollectedProduct => ({
  ref,
  data: { product: { name: "P", category_path: categoryPath, ...over } },
});

/**
 * Le choix du template appartient au collecteur : le Studio lit
 * `payload.template` a chaque requete et ne memorise rien. Ce qui se joue ici,
 * c'est l'heritage vers les parents — une categorie nouvelle doit tomber sur le
 * template de sa branche, pas sur le defaut.
 */

test("la regle la plus profonde gagne, quel que soit l'ordre de declaration", () => {
  assert.equal(rules.resolve(product(["Manutention", "Transpalettes"])), "fiche-transpalette");
});

test("une categorie fille herite du template de son parent", () => {
  // "Gerbeurs" n'a pas de regle : elle doit prendre celle de "Manutention".
  assert.equal(rules.resolve(product(["Manutention", "Gerbeurs"])), "fiche-manutention");
  assert.equal(
    rules.resolve(product(["Manutention", "Transpalettes", "Peseurs"])),
    "fiche-transpalette"
  );
});

test("hors de toute branche, le defaut s'applique", () => {
  assert.equal(rules.resolve(product(["Bureautique"])), "fiche-technique-01");
  assert.equal(rules.resolve(product([])), "fiche-technique-01");
});

test("casse et accents ne font pas rater une regle", () => {
  // Un export ecrit "MANUTENTION" ou "Manutention" selon l'humeur du BO.
  assert.equal(rules.resolve(product(["MANUTENTION", "transpalettes"])), "fiche-transpalette");
});

test("un template impose par la source court-circuite les regles", () => {
  const forced = { ...product(["Manutention", "Transpalettes"]), template: "fiche-speciale" };
  assert.equal(rules.resolve(forced), "fiche-speciale");
});

test("les criteres marque et reference s'appliquent aussi", () => {
  assert.equal(rules.resolve(product([], { brand: "Fabrikam" })), "fiche-atelier");
  assert.equal(rules.resolve(product([], {}, "ETA-05")), "fiche-etabli");
});

test("une regle a plusieurs criteres bat une regle a un seul", () => {
  const resolver = new TemplateResolver(
    templateRulesSchema.parse({
      default: "defaut",
      rules: [
        { category: ["Levage"], template: "generique" },
        { category: ["Levage"], brand: "Liftmax", template: "specifique" },
      ],
    })
  );
  assert.equal(resolver.resolve(product(["Levage"], { brand: "Liftmax" })), "specifique");
  assert.equal(resolver.resolve(product(["Levage"], { brand: "Autre" })), "generique");
});

test("sans regle ni defaut, on renvoie null plutot que de deviner", () => {
  // Envoyer un slug au hasard donnerait un 404 par produit, apres coup.
  const nu = new TemplateResolver(templateRulesSchema.parse({ rules: [] }));
  assert.equal(nu.resolve(product(["Manutention"])), null);
});

test("--template sert de defaut quand le fichier de regles n'en donne pas", () => {
  const resolver = new TemplateResolver(
    templateRulesSchema.parse({ rules: [{ category: ["Levage"], template: "fiche-levage" }] }),
    "repli"
  );
  assert.equal(resolver.resolve(product(["Bureautique"])), "repli");
  assert.deepEqual(resolver.targets().sort(), ["fiche-levage", "repli"]);
});

test("une regle sans critere est refusee : elle s'appliquerait a tout", () => {
  const parsed = templateRulesSchema.safeParse({ rules: [{ template: "partout" }] });
  assert.equal(parsed.success, false);
});

test("category_any attrape une liste de categories qui n'est pas un fil d'ariane", () => {
  // Un export PrestaShop liste toutes les categories associees, dans un ordre
  // qui n'est pas hierarchique : "Promo,Bureaux d'entreprise,Gammes de
  // Bureaux..." commence par une categorie transversale. Aucune regle de
  // prefixe ne peut alors s'appliquer.
  const resolver = new TemplateResolver(
    templateRulesSchema.parse({
      default: "defaut",
      rules: [
        { category: ["Bureaux d'entreprise"], template: "par-prefixe" },
        { category_any: ["Bureaux Droits Individuels"], template: "par-appartenance" },
      ],
    })
  );

  const prestashop = product([
    "Promo",
    "Bureaux d'entreprise",
    "Gammes de Bureaux",
    "Bureaux Droits Individuels",
  ]);
  assert.equal(resolver.resolve(prestashop), "par-appartenance");

  // La regle de prefixe reste inapplicable ici, et c'est bien le probleme.
  assert.equal(resolver.resolve(product(["Promo", "Autre chose"])), "defaut");
  // Mais elle gagne quand le fil d'ariane est reel.
  assert.equal(resolver.resolve(product(["Bureaux d'entreprise", "Caissons"])), "par-prefixe");
});
