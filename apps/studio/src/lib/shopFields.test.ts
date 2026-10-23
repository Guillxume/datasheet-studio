import test from "node:test";
import assert from "node:assert/strict";
import { shopSchema } from "./payload";
import { SHOP_FIELDS, shopFieldsFrom, shopSeed } from "./shopFields";

/**
 * L'ALLER-RETOUR EST LA SEULE CHOSE QUI COMPTE ICI. Chacune des deux
 * conversions prise seule « marche » toujours ; ce qui casse, c'est leur
 * desaccord — un champ present dans un sens et absent dans l'autre. Le defaut
 * ne leve rien : il produit quatre cents PDF sans adresse.
 */

/** Une valeur distincte par champ, pour qu'aucune confusion ne passe inapercue. */
function tousLesChamps(): Record<string, string> {
  return Object.fromEntries(SHOP_FIELDS.map(({ key }, index) => [key, `valeur-${index}-${key}`]));
}

test("l'aller-retour conserve TOUS les champs declares", () => {
  const depart = tousLesChamps();
  const imbrique = shopSeed(depart);

  // shopFieldsFrom attend le nom a part, comme il vient de la base.
  const { name, ...settings } = imbrique as { name: string };
  const retour = shopFieldsFrom({ name, settings });

  assert.deepEqual(retour, depart);
});

test("chaque cle de SHOP_FIELDS ressort de shopFieldsFrom", () => {
  /*
   * Le test qui attrape le defaut redoute : une ligne ajoutee a SHOP_FIELDS que
   * l'une des conversions ignore. Il echouerait aussi si l'on remplacait la
   * derivation par une enumeration a la main et qu'on en oubliait une.
   */
  const imbrique = shopSeed(tousLesChamps());
  const { name, ...settings } = imbrique as { name: string };
  const retour = shopFieldsFrom({ name, settings });

  for (const { key } of SHOP_FIELDS) {
    assert.ok(key in retour, `${key} est perdu dans la conversion`);
  }
});

test("shopSeed produit la forme imbriquee du contrat", () => {
  const shop = shopSeed({
    name: "Contoso Equipment",
    url: "https://exemple.fr",
    "colors.primary": "#0b5ea8",
    "company.phone": "03 26 00 00 00",
  });

  assert.deepEqual(shop, {
    name: "Contoso Equipment",
    url: "https://exemple.fr",
    colors: { primary: "#0b5ea8" },
    company: { phone: "03 26 00 00 00" },
  });
});

test("le resultat de shopSeed satisfait le schema du payload", () => {
  // La verification qui compte vraiment : ce que cette fonction produit part
  // TEL QUEL dans le bloc `shop` d'une requete de rendu.
  const parse = shopSchema.safeParse(shopSeed(tousLesChamps()));
  assert.equal(parse.success, true, JSON.stringify(parse.error?.issues));
});

test("les champs vides sont ecartes, pas envoyes a vide", () => {
  /*
   * Le contrat traite l'absence et la chaine vide differemment : un `company`
   * peuple de quatre chaines vides ferait imprimer un bloc de coordonnees vide
   * au lieu de l'effacer.
   */
  const shop = shopSeed({
    name: "Boutique",
    url: "",
    "company.phone": "   ",
    "company.email": "contact@exemple.fr",
  });

  assert.deepEqual(shop, { name: "Boutique", company: { email: "contact@exemple.fr" } });
  assert.equal("url" in shop, false);
});

test("un groupe entierement vide ne cree pas de conteneur", () => {
  const shop = shopSeed({ name: "Boutique", "colors.primary": "", "colors.secondary": "" });
  assert.equal("colors" in shop, false);
});

test("shopFieldsFrom tolere des reglages absents ou nuls", () => {
  assert.deepEqual(shopFieldsFrom({ name: "Boutique" }), { name: "Boutique" });
  assert.deepEqual(shopFieldsFrom({ name: "Boutique", settings: null }), { name: "Boutique" });
  assert.deepEqual(shopFieldsFrom({ name: "Boutique", settings: {} }), { name: "Boutique" });
});

test("shopFieldsFrom ignore ce qui n'est pas une chaine", () => {
  // Une colonne jsonb abimee a la main ne doit pas faire remonter un objet dans
  // un champ de formulaire.
  const fields = shopFieldsFrom({
    name: "Boutique",
    settings: { url: 42, colors: { primary: { profond: true } }, company: { phone: "03" } },
  } as never);

  assert.deepEqual(fields, { name: "Boutique", "company.phone": "03" });
});

test("shopFieldsFrom ignore les reglages hors de la liste", () => {
  // `backoffice` existe dans shopSettingsSchema mais n'est PAS un champ de
  // fiche : il documente le parc, il n'a rien a faire dans le payload.
  const fields = shopFieldsFrom({
    name: "Boutique",
    settings: { url: "https://exemple.fr", backoffice: { kind: "medusa" }, erp: { entity: "9" } },
  });

  assert.deepEqual(fields, { name: "Boutique", url: "https://exemple.fr" });
});
