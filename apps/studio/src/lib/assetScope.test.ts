import { test } from "node:test";
import assert from "node:assert/strict";
import { partitionAssetRefs, RENDER_SCOPE_ANY } from "./assetScope";

/**
 * Portee des assets au rendu — isolation entre les sites du parc.
 *
 * LE DEFAUT QUE CES TESTS VERROUILLENT. La portee d'un asset vit dans son URL
 * (`/assets/<portee>/<cle>`), donc dans le TEMPLATE ; la boutique qui demande le
 * rendu n'est connue que de la requete. Rien ne rapprochait les deux. Un
 * template de bibliotheque referencant `/assets/contoso-equipment/logo.png`
 * faisait sortir le logo d'un site sur les fiches de TOUS les autres, sans
 * erreur ni avertissement : un PDF valide, avec la mauvaise marque dessus.
 *
 * C'est le genre de defaut qu'aucun test de rendu ne trouve, parce que le rendu
 * reussit. Il ne se voit qu'en confrontant deux boutiques — d'ou ces cas.
 */

const REFS = [
  "/assets/shared/picto-garantie",
  "/assets/contoso-equipment/logo",
  "/assets/fabrikam/logo",
];

test("la bibliotheque commune est lisible par toutes les boutiques", () => {
  for (const boutique of ["contoso-equipment", "fabrikam", "northwind"]) {
    const { readable } = partitionAssetRefs(REFS, boutique);
    assert.ok(readable.includes("/assets/shared/picto-garantie"), `illisible depuis ${boutique}`);
  }
});

test("une boutique lit ses propres assets", () => {
  const { readable } = partitionAssetRefs(REFS, "fabrikam");
  assert.ok(readable.includes("/assets/fabrikam/logo"));
});

test("ISOLATION : une boutique ne lit pas les assets d'une autre", () => {
  const { readable, foreign } = partitionAssetRefs(REFS, "fabrikam");
  assert.equal(
    readable.includes("/assets/contoso-equipment/logo"),
    false,
    "c'est exactement le defaut corrige : le logo d'un site sur la fiche d'un autre",
  );
  assert.deepEqual(foreign, ["/assets/contoso-equipment/logo"]);
});

test("ISOLATION : une boutique inconnue ne lit que la bibliotheque", () => {
  // Cas d'une boutique creee apres l'ecriture du template : rien de ce qui est
  // nomme explicitement ne doit lui etre accessible.
  const { readable, foreign } = partitionAssetRefs(REFS, "boutique-nouvelle");
  assert.deepEqual(readable, ["/assets/shared/picto-garantie"]);
  assert.equal(foreign.length, 2);
});

test("l'apercu de l'editeur ne restreint rien, deliberement", () => {
  // Regler un template suppose de voir ce qu'il contient vraiment, y compris ce
  // que la production refusera. Voir le commentaire dans la route d'apercu.
  const { readable, foreign } = partitionAssetRefs(REFS, RENDER_SCOPE_ANY);
  assert.equal(readable.length, REFS.length);
  assert.deepEqual(foreign, []);
});

test("une portee encodee dans l'URL est comparee decodee", () => {
  // `assetUrl()` passe la portee par encodeURIComponent : sans decodage, une
  // boutique dont le slug contient un caractere encode ne se reconnaitrait pas.
  const { readable, foreign } = partitionAssetRefs(["/assets/ma%20boutique/logo"], "ma boutique");
  assert.deepEqual(readable, ["/assets/ma%20boutique/logo"]);
  assert.deepEqual(foreign, []);
});

test("une chaine qui n'est pas une reference d'asset est ignoree des deux cotes", () => {
  // `/assets/x` sans cle, ou un chemin a trois segments, ne sont pas des
  // references : ni lisibles, ni etrangeres — simplement hors sujet.
  const { readable, foreign } = partitionAssetRefs(
    ["/assets/incomplet", "/assets/a/b/c", "https://exemple.fr/logo.png", ""],
    "fabrikam",
  );
  assert.deepEqual(readable, []);
  assert.deepEqual(foreign, []);
});

test("aucune reference : aucune des deux listes n'est peuplee", () => {
  const { readable, foreign } = partitionAssetRefs([], "fabrikam");
  assert.deepEqual(readable, []);
  assert.deepEqual(foreign, []);
});

test("un slug de boutique ne peut pas se faire passer pour la bibliotheque", () => {
  // Une boutique dont le slug serait litteralement « shared » lirait la
  // bibliotheque, ce qui est le comportement voulu ; l'inverse — une portee
  // « shared » traitee comme une boutique — ne doit pas arriver.
  const { readable } = partitionAssetRefs(["/assets/shared/x"], "shared");
  assert.deepEqual(readable, ["/assets/shared/x"]);
});
