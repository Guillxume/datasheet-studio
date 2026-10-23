import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * UN DEFAUT DU COMPILATEUR, PAS DU CODE — et c'est pour cela qu'il faut un test.
 *
 * Next 16 compile le JSX avec SWC. Quand un texte JSX contient une ENTITE HTML
 * (`&apos;`, `&quot;`, `&#39;`…) ET s'etend sur plusieurs lignes, SWC supprime
 * l'espace de TETE de ce texte — celle que Babel conservait, et que la
 * specification JSX demande de garder puisqu'elle n'est pas en debut de ligne.
 *
 * Le resultat est visible a l'ecran et invisible dans le source :
 *
 *     {users.length} compte(s).      ->  « 3compte(s). »
 *     <code>"auto"</code> en 409     ->  « "auto"en 409 »
 *
 * CE QUI A ETE MESURE, cas par cas, contre le build de production :
 *
 *   plusieurs lignes + entite       espace de tete PERDUE
 *   plusieurs lignes, sans entite   conservee
 *   une seule ligne + entite        conservee
 *   espace de QUEUE, tous les cas   conservee
 *
 * Ni `tsc`, ni `eslint`, ni `next build` ne le signalent : le source est
 * correct. Rien d'autre qu'un test de source ou une relecture au pixel ne peut
 * l'attraper — et il reapparaitra a chaque paragraphe ecrit, tant que SWC n'est
 * pas corrige.
 *
 * LE CORRECTIF est un `{" "}` explicite a la place de l'espace fragile : il
 * devient une expression JSX, que rien ne peut plus rogner.
 */

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTITE = /&#?\w+;/;

function fichiersTsx(repertoire: string, trouves: string[] = []): string[] {
  for (const entree of readdirSync(repertoire, { withFileTypes: true })) {
    const chemin = join(repertoire, entree.name);
    if (entree.isDirectory()) fichiersTsx(chemin, trouves);
    else if (entree.name.endsWith(".tsx")) trouves.push(chemin);
  }
  return trouves;
}

test("aucun texte JSX ne confie une espace significative a SWC", () => {
  const fichiers = fichiersTsx(src);
  assert.ok(fichiers.length > 10, "aucun fichier lu : le chemin est faux");

  const fautes: string[] = [];

  for (const fichier of fichiers) {
    const source = ts.createSourceFile(
      fichier,
      readFileSync(fichier, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const visiter = (node: ts.Node): void => {
      if (ts.isJsxText(node)) {
        const texte = node.getFullText();
        // Une espace de tete VRAIE : sur la premiere ligne du texte, donc
        // significative. Celle qui suit un retour a la ligne est rognee de
        // toute facon, par tous les compilateurs, et personne ne s'en plaint.
        if (/^[ \t]/.test(texte) && texte.includes("\n") && ENTITE.test(texte)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          const apercu = texte.trim().slice(0, 56).replace(/\s+/g, " ");
          fautes.push(`${relative(src, fichier)}:${line + 1} « ${apercu}… »`);
        }
      }
      ts.forEachChild(node, visiter);
    };
    visiter(source);
  }

  assert.deepEqual(
    fautes,
    [],
    `${fautes.length} texte(s) JSX perdront leur espace de tete a la compilation.\n` +
      `Remplacer l'espace fautive par {" "} :\n  ` +
      fautes.join("\n  "),
  );
});
