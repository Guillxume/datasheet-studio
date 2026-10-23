/**
 * Regle ESLint : ne pas importer une VALEUR depuis un module « use client »
 * dans un module serveur.
 *
 * LE DEFAUT QU'ELLE ATTRAPE, ET POURQUOI IL EST INVISIBLE AUTREMENT.
 *
 * Dans le modele des React Server Components, un module marque « use client »
 * n'est pas execute cote serveur : le bundler le remplace, pour le graphe
 * serveur, par une REFERENCE de module client. Rendre un composant importe
 * ainsi fonctionne — c'est le mecanisme prevu. Mais lire une constante ou
 * appeler une fonction exportee par ce meme module ne fonctionne pas : cote
 * serveur, la constante vaut `undefined`.
 *
 * Cas reel, livre en production dans ce depot : src/app/layout.tsx importait
 * THEME_KEY depuis ThemeToggle.tsx, marque « use client ». Le script de
 * pre-peinture partait en `localStorage.getItem(undefined)` et le theme choisi
 * n'etait restaure a aucun chargement de page.
 *
 * Ni `tsc --noEmit` ni `next build` ne le signalent — c'est justement ce qui
 * justifie une regle : le seul controle possible est structurel.
 *
 * COMMENT ELLE DECIDE. La convention React separe les deux cas sans ambiguite :
 * un composant s'ecrit en PascalCase, tout le reste non. La regle laisse donc
 * passer les identifiants PascalCase — c'est le motif normal, « rendre un
 * composant client depuis un composant serveur » — et signale les autres.
 *
 * Elle ajoute un seul controle au-dela de cette convention : lire une propriete
 * sur un import client (`Module.CLE`) est signale meme en PascalCase, parce que
 * React leve alors une erreur explicite (« Cannot access ... on the server »).
 *
 * CE QU'ELLE NE VOIT PAS, ecrit ici pour ne pas donner une fausse assurance :
 *  - une constante nommee en PascalCase (`export const Colors = ...`) passe ;
 *  - un module resolu hors du projet (dependance) n'est pas inspecte ;
 *  - un module SANS directive importe uniquement depuis du client est traite
 *    comme serveur, donc signale. La reponse correcte est de lui donner la
 *    directive : un module vraiment client doit la porter.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];

/**
 * Retire les commentaires d'un JSON avec commentaires (tsconfig en autorise).
 *
 * Le passage en machine a etats est necessaire : une simple expression
 * reguliere sur `//` couperait au milieu d'une chaine, et `"paths"` contient
 * des valeurs comme `"./src/*"` — pas de `//` ici, mais un chemin d'URL dans
 * un autre champ suffirait a tronquer le fichier sans rien signaler.
 */
function stripJsonComments(text) {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];

    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === "*" && next === "/") {
        inBlock = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 1;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") {
      inLine = true;
      i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlock = true;
      i += 1;
      continue;
    }
    out += c;
  }

  return out;
}

/**
 * Alias de chemins, lus dans tsconfig.json.
 *
 * Lus, et non recopies dans la configuration ESLint : deux listes d'alias qui
 * doivent rester identiques finissent par diverger, et le jour ou elles
 * divergent la regle cesse silencieusement de couvrir les imports aliases.
 *
 * L'echec est VOLONTAIREMENT bruyant. Une regle de lint qui ne verifie plus
 * rien est pire qu'une regle absente : elle donne une assurance fausse.
 */
function readAliases(tsconfigPath) {
  let raw;
  try {
    raw = readFileSync(tsconfigPath, "utf8");
  } catch (cause) {
    throw new Error(
      `no-client-value-in-server : tsconfig introuvable a « ${tsconfigPath} ». ` +
        "Corriger l'option `tsconfigPath` de la regle.",
      { cause },
    );
  }

  const { compilerOptions } = JSON.parse(stripJsonComments(raw));
  const paths = compilerOptions?.paths ?? {};
  const baseUrl = compilerOptions?.baseUrl ?? ".";
  const base = resolve(dirname(tsconfigPath), baseUrl);

  // « @/* » -> « ./src/* » devient { prefix: "@/", target: "<base>/src/" }.
  return Object.entries(paths)
    .filter(([from, to]) => from.endsWith("/*") && Array.isArray(to) && to[0]?.endsWith("/*"))
    .map(([from, to]) => ({
      prefix: from.slice(0, -1),
      target: join(base, to[0].slice(0, -1)),
    }));
}

/** Ajoute les extensions et les index, comme le ferait le resolveur du bundler. */
function firstExisting(base) {
  const candidates = [
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ];
  if (existsSync(base)) {
    try {
      if (statSync(base).isFile()) candidates.unshift(base);
    } catch {
      // Course entre existsSync et statSync : le fichier a disparu, on continue.
    }
  }
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function resolveImport(specifier, fromFile, aliases) {
  if (specifier.startsWith(".")) return firstExisting(resolve(dirname(fromFile), specifier));
  if (isAbsolute(specifier)) return firstExisting(specifier);

  const alias = aliases.find((entry) => specifier.startsWith(entry.prefix));
  if (!alias) return undefined; // dependance : hors perimetre
  return firstExisting(join(alias.target, specifier.slice(alias.prefix.length)));
}

/**
 * Le fichier commence-t-il par la directive « use client » ?
 *
 * Un prologue de directive peut etre precede de commentaires et d'espaces, mais
 * d'aucune instruction. On saute donc les commentaires puis on exige une chaine
 * litterale — plutot que de chercher « use client » n'importe ou dans le
 * fichier, ce qui matcherait ce commentaire-ci.
 */
function hasUseClientDirective(text) {
  let i = 0;
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i);
      if (end === -1) return false;
      i = end + 1;
      continue;
    }
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i);
      if (end === -1) return false;
      i = end + 2;
      continue;
    }
    break;
  }
  return /^["']use client["']/.test(text.slice(i));
}

const directiveCache = new Map();
function isClientModule(file) {
  let cached = directiveCache.get(file);
  if (cached === undefined) {
    try {
      // 4 Kio : la directive est en tete par definition du langage. Lire le
      // fichier entier a chaque import couterait pour rien sur un gros module.
      cached = hasUseClientDirective(readFileSync(file, "utf8").slice(0, 4096));
    } catch {
      cached = false;
    }
    directiveCache.set(file, cached);
  }
  return cached;
}

/**
 * Convention React : un composant est en PascalCase, une valeur ne l'est pas.
 *
 * Les TROIS conditions sont necessaires, et l'oubli de la deuxieme est le piege.
 * Une premiere version testait seulement la majuscule initiale : `THEME_KEY`
 * passait donc pour un composant, et la regle laissait filer exactement le
 * defaut qu'elle existe pour attraper. Ce sont les tests qui l'ont montre.
 *
 *   ThemeToggle -> composant : majuscule, au moins une minuscule, pas de « _ »
 *   THEME_KEY   -> valeur    : contient « _ »
 *   APIKEY      -> valeur    : aucune minuscule
 */
const looksLikeComponent = (name) => /^[A-Z]/.test(name) && /[a-z]/.test(name) && !name.includes("_");

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Interdit d'importer une valeur (constante, fonction) depuis un module « use client » " +
        "dans un module serveur : le bundler n'en transmet pas la valeur.",
    },
    schema: [
      {
        type: "object",
        properties: {
          tsconfigPath: {
            type: "string",
            description: "Chemin du tsconfig d'ou lire les alias. Relatif au repertoire de travail.",
          },
          allowedNames: {
            type: "array",
            items: { type: "string" },
            description: "Identifiants tolerés malgre la regle, a justifier au cas par cas.",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      valueFromClientModule:
        "« {{name}} » est importe depuis « {{source}} », qui porte la directive « use client ». " +
        "Un module serveur ne recoit pas la valeur mais une reference de module client : une constante y vaut " +
        "`undefined` et une fonction n'est pas appelable, sans erreur ni avertissement. " +
        "Deplacer ce qui est partage dans un module SANS directive, importe par les deux cotes.",
      memberOfClientModule:
        "Lecture de « .{{property}} » sur « {{name}} », importe depuis le module client « {{source}} ». " +
        "React leve « Cannot access {{name}}.{{property}} on the server » : une reference de module client " +
        "n'expose aucune propriete cote serveur.",
    },
  },

  create(context) {
    const [options = {}] = context.options;
    const aliases = readAliases(resolve(context.cwd ?? process.cwd(), options.tsconfigPath ?? "tsconfig.json"));
    const allowed = new Set(options.allowedNames ?? []);

    const filename = context.filename ?? context.getFilename();
    // Un module client peut importer ce qu'il veut d'un autre module client.
    if (hasUseClientDirective(context.sourceCode.getText())) return {};

    return {
      ImportDeclaration(node) {
        // Les types sont effaces a la compilation : ils ne traversent aucune
        // frontiere d'execution.
        if (node.importKind === "type") return;

        const source = node.source.value;
        if (typeof source !== "string" || source.endsWith(".css")) return;

        const resolved = resolveImport(source, filename, aliases);
        if (!resolved || !isClientModule(resolved)) return;

        for (const specifier of node.specifiers) {
          if (specifier.importKind === "type") continue;

          const name = specifier.local.name;
          if (allowed.has(name)) continue;

          if (!looksLikeComponent(name)) {
            context.report({
              node: specifier,
              messageId: "valueFromClientModule",
              data: { name, source },
            });
            continue;
          }

          // PascalCase : c'est probablement un composant, donc le rendre est
          // legitime. Reste le seul usage qui casse a coup sur, lire dedans.
          const variable = context.sourceCode
            .getScope(node)
            .variables.find((candidate) => candidate.name === name);

          for (const reference of variable?.references ?? []) {
            const parent = reference.identifier.parent;
            if (
              parent?.type === "MemberExpression" &&
              parent.object === reference.identifier &&
              !parent.computed
            ) {
              context.report({
                node: parent,
                messageId: "memberOfClientModule",
                data: { name, source, property: parent.property.name },
              });
            }
          }
        }
      },
    };
  },
};
