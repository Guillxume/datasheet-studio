/**
 * Tests de la regle no-client-value-in-server.
 *
 * Les cas VALIDES comptent autant que les invalides : une regle qui signale le
 * motif normal (« rendre un composant client depuis un composant serveur ») sera
 * desactivee dans la semaine, et on perdra la couverture du vrai defaut.
 *
 * Les fixtures sont ecrites sur disque parce que la regle resout et LIT les
 * modules importes — c'est la seule facon de connaitre leur directive. Un
 * RuleTester avec du code en memoire ne testerait donc rien de reel.
 */

import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import rule from "./no-client-value-in-server.mjs";

const root = mkdtempSync(join(tmpdir(), "rsc-rule-"));
mkdirSync(join(root, "src/app"), { recursive: true });
mkdirSync(join(root, "src/lib"), { recursive: true });

const write = (relative, content) => writeFileSync(join(root, relative), content);

// Le module client : un composant PascalCase ET des valeurs exportees a cote.
write(
  "src/app/ThemeToggle.tsx",
  `"use client";
export const THEME_KEY = "ds-theme";
export function applyTheme() {}
export default function ThemeToggle() { return null; }
`,
);

// Meme chose, mais la directive est precedee d'un commentaire : legal en JS,
// et un detecteur naif qui teste seulement le premier caractere la manquerait.
write(
  "src/app/Commented.tsx",
  `// Un commentaire avant la directive est autorise par le langage.
"use client";
export const OTHER_KEY = "x";
export default function Commented() { return null; }
`,
);

// Module partage SANS directive : la solution correcte au defaut.
write(
  "src/lib/theme.ts",
  `export const THEME_KEY = "ds-theme";
export function applyTheme() {}
`,
);

// Un module qui mentionne « use client » dans un commentaire seulement : il
// n'est PAS client, et le signaler serait un faux positif.
write(
  "src/lib/mentions.ts",
  `// Ce fichier explique la directive "use client" sans la porter.
export const SAFE = 1;
`,
);

write(
  "tsconfig.json",
  JSON.stringify({
    // Commentaire volontaire : tsconfig est du JSON avec commentaires, et la
    // regle doit savoir les retirer avant de lire les alias.
    compilerOptions: { paths: { "@/*": ["./src/*"] } },
  }),
);
write(
  "tsconfig-commente.json",
  `{
  // Alias du projet.
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] } // le seul alias
  }
}`,
);

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
  },
});

const serverFile = join(root, "src/app/layout.tsx");

/**
 * Chaque cas recoit un `tsconfigPath` ABSOLU.
 *
 * Par defaut la regle lit « tsconfig.json » relativement au repertoire de
 * travail — ce qui est correct quand ESLint est lance a la racine du projet,
 * et faux ici puisque les fixtures vivent dans un repertoire temporaire.
 * L'injecter explicitement evite de faire dependre le test du dossier depuis
 * lequel on l'a lance.
 */
// Note : quand un cas fournit `data`, RuleTester exige TOUS les substituts du
// message, pas seulement celui qu'on veut verifier — sinon il compare le
// message brut, avec ses « {{source}} » non remplaces.
const cas = (entry) => ({
  ...entry,
  options: [{ tsconfigPath: join(root, "tsconfig.json"), ...(entry.options?.[0] ?? {}) }],
});

const suite = {
  valid: [
    {
      name: "rendre un composant client depuis un composant serveur — le motif normal",
      filename: serverFile,
      code: `import ThemeToggle from "./ThemeToggle";
export default function Layout() { return <ThemeToggle />; }`,
    },
    {
      name: "passer un composant client en prop reste permis",
      filename: serverFile,
      code: `import ThemeToggle from "./ThemeToggle";
export default function Layout() { return <Slot render={ThemeToggle} />; }`,
    },
    {
      name: "un import de TYPE ne traverse aucune frontiere d'execution",
      filename: serverFile,
      code: `import type { THEME_KEY } from "./ThemeToggle";
export const x: typeof THEME_KEY = "" as never;`,
    },
    {
      name: "un specificateur marque type dans un import mixte est ignore",
      filename: serverFile,
      code: `import ThemeToggle, { type THEME_KEY } from "./ThemeToggle";
export default function Layout() { return <ThemeToggle />; }`,
    },
    {
      name: "la meme valeur importee d'un module SANS directive : c'est la correction attendue",
      filename: serverFile,
      code: `import { THEME_KEY, applyTheme } from "@/lib/theme";
export const s = THEME_KEY + String(applyTheme);`,
    },
    {
      name: "un module qui cite la directive en commentaire n'est pas un module client",
      filename: serverFile,
      code: `import { SAFE } from "@/lib/mentions";
export const s = SAFE;`,
    },
    {
      name: "un fichier CLIENT peut importer ce qu'il veut d'un autre module client",
      filename: join(root, "src/app/Autre.tsx"),
      code: `"use client";
import { THEME_KEY } from "./ThemeToggle";
export const s = THEME_KEY;`,
    },
    {
      name: "une dependance externe n'est pas inspectee",
      filename: serverFile,
      code: `import { useMemo } from "react";
export const s = useMemo;`,
    },
    {
      name: "un import de feuille de style est ignore",
      filename: serverFile,
      code: `import "./globals.css";
export const s = 1;`,
    },
    {
      name: "identifiant explicitement tolere par la configuration",
      filename: serverFile,
      code: `import { THEME_KEY } from "./ThemeToggle";
export const s = THEME_KEY;`,
      options: [{ allowedNames: ["THEME_KEY"] }],
    },
    {
      name: "les alias se lisent dans un tsconfig commente",
      filename: serverFile,
      code: `import { THEME_KEY } from "@/lib/theme";
export const s = THEME_KEY;`,
      options: [{ tsconfigPath: join(root, "tsconfig-commente.json") }],
    },
  ],

  invalid: [
    {
      name: "LE DEFAUT REEL : une constante importee d'un module client",
      filename: serverFile,
      code: `import { THEME_KEY } from "./ThemeToggle";
export const script = \`localStorage.getItem(\${JSON.stringify(THEME_KEY)})\`;`,
      errors: [{ messageId: "valueFromClientModule", data: { name: "THEME_KEY", source: "./ThemeToggle" } }],
    },
    {
      name: "une fonction importee d'un module client",
      filename: serverFile,
      code: `import { applyTheme } from "./ThemeToggle";
applyTheme();`,
      errors: [{ messageId: "valueFromClientModule" }],
    },
    {
      name: "le composant passe, la valeur a cote est signalee — un seul rapport",
      filename: serverFile,
      code: `import ThemeToggle, { THEME_KEY } from "./ThemeToggle";
export default function Layout() { return <ThemeToggle data-k={THEME_KEY} />; }`,
      errors: [{ messageId: "valueFromClientModule", data: { name: "THEME_KEY", source: "./ThemeToggle" } }],
    },
    {
      name: "via un alias de chemin",
      filename: join(root, "src/lib/serveur.ts"),
      code: `import { THEME_KEY } from "@/app/ThemeToggle";
export const s = THEME_KEY;`,
      errors: [{ messageId: "valueFromClientModule" }],
    },
    {
      name: "directive precedee d'un commentaire : le module reste client",
      filename: serverFile,
      code: `import { OTHER_KEY } from "./Commented";
export const s = OTHER_KEY;`,
      errors: [{ messageId: "valueFromClientModule", data: { name: "OTHER_KEY", source: "./Commented" } }],
    },
    {
      name: "lire une propriete sur un import client, meme en PascalCase",
      filename: serverFile,
      code: `import ThemeToggle from "./ThemeToggle";
export const s = ThemeToggle.displayName;`,
      errors: [
        {
          messageId: "memberOfClientModule",
          data: { name: "ThemeToggle", source: "./ThemeToggle", property: "displayName" },
        },
      ],
    },
    {
      name: "deux valeurs importees : deux rapports, un par identifiant",
      filename: serverFile,
      code: `import { THEME_KEY, applyTheme } from "./ThemeToggle";
export const s = THEME_KEY + String(applyTheme);`,
      errors: [{ messageId: "valueFromClientModule" }, { messageId: "valueFromClientModule" }],
    },
  ],
};

tester.run("no-client-value-in-server", rule, {
  valid: suite.valid.map(cas),
  invalid: suite.invalid.map(cas),
});

console.log(
  `no-client-value-in-server : ${suite.valid.length} cas valides et ${suite.invalid.length} cas invalides passent.`,
);
