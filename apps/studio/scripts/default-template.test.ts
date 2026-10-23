import { test } from "node:test";
import assert from "node:assert/strict";
import { BODY, HEADER, FOOTER, CSS } from "./default-template";
import { VARIABLES } from "../src/lib/variables";
import { componentNames } from "../src/blocks/registry";

/**
 * Le template par defaut est un arbre ecrit a la main : un bloc mal orthographie
 * ou un token invente ne leve aucune erreur, il produit un trou dans le PDF que
 * seul l'apercu montre. Ce test ferme les deux portes, et verifie qu'aucune
 * couleur de marque ne s'y est glissee.
 */

const zones = { corps: BODY, entete: HEADER, pied: FOOTER };

function parcourir(valeur: unknown, visite: (noeud: { type: string; props: Record<string, unknown> }) => void): void {
  if (Array.isArray(valeur)) return valeur.forEach((v) => parcourir(v, visite));
  if (valeur && typeof valeur === "object") {
    const o = valeur as Record<string, unknown>;
    if (typeof o.type === "string" && o.props) visite(o as never);
    Object.values(o).forEach((v) => parcourir(v, visite));
  }
}

test("tous les blocs du template existent dans le registre", () => {
  for (const [zone, arbre] of Object.entries(zones)) {
    parcourir(arbre, (n) => assert.ok(componentNames.includes(n.type), `${zone} : bloc inconnu « ${n.type} »`));
  }
});

test("les identifiants de noeuds sont uniques", () => {
  const ids: string[] = [];
  for (const arbre of Object.values(zones)) parcourir(arbre, (n) => ids.push(String(n.props.id)));
  assert.equal(new Set(ids).size, ids.length);
});

test("tous les tokens de donnees appartiennent au vocabulaire declare", () => {
  const connus = VARIABLES.map((v) => v.token.replace(/[{}\s]/g, ""));
  const trouves = new Set<string>();
  for (const m of JSON.stringify(zones).matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)) trouves.add(m[1]);
  assert.ok(trouves.size > 0);
  for (const t of trouves) {
    // « images.0.src » decrit « images » : un indice ou un segment de plus
    // n'est pas un autre token, c'est une lecture de la meme liste.
    assert.ok(
      connus.some((c) => t === c || t.startsWith(`${c}.`)),
      `token inconnu : ${t}`
    );
  }
});

test("aucune couleur de marque en dur : l'accent vient de --color-primary", () => {
  const json = JSON.stringify(zones) + CSS;
  assert.match(json, /--color-primary/);
  assert.doesNotMatch(json.replace(/#ffffff/gi, ""), /"#[0-9a-f]{3,6}"/i);
});
