/**
 * Configuration ESLint (format « plat », ESLint 9).
 *
 * POURQUOI CE FICHIER APPARAIT MAINTENANT. Le depot n'avait aucune
 * configuration ESLint, et le script `"lint": "next lint"` de package.json ne
 * fonctionnait plus : `next lint` a ete retire de Next 16 — la commande
 * interprete « lint » comme un repertoire de projet et echoue sur
 * « Invalid project directory provided, no such directory: ./lint ». Verifie
 * sur next@16.2.12.
 *
 * INSTALLATION (a lancer sur votre machine) :
 *
 *     npm i -D eslint@9 @typescript-eslint/parser@8 eslint-plugin-react-hooks
 *
 * puis remplacer dans package.json le script devenu inoperant :
 *
 *     "lint": "eslint ."
 *
 * PERIMETRE : deux jeux de regles, pas un de plus. Chacune est justifiee par un
 * defaut CONSTATE dans ce depot, pas par une liste de bonnes pratiques. Un jeu
 * de regles de style produirait des centaines de signalements sur du code qui
 * fonctionne, et une liste qu'on ne lit plus ne protege de rien.
 *
 * CE QUI A ETE ESSAYE PUIS ECARTE : `@next/eslint-plugin-next`. Mesure sur ce
 * depot, sa configuration recommandee produit 9 signalements, dont 7 sont
 * `no-img-element` dans src/blocks/registry.tsx. Or ce fichier est rendu AUSSI
 * par le chemin PDF, via une instance distincte de `react-dom/server.node`,
 * hors du runtime Next : `next/image` y produirait des URL d'optimisation que
 * Chromium ne saurait pas resoudre, alors que le pipeline repose sur des images
 * en ligne. Ces `<img>` sont donc structurels. Une regle qui se trompe 7 fois
 * sur 9 dans le fichier central apprend a ignorer le linter.
 */

import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import noClientValueInServer from "./eslint-rules/no-client-value-in-server.mjs";

export default [
  {
    ignores: ["node_modules/**", ".next/**", "fixtures/**", "next-env.d.ts"],
  },

  {
    /*
     * `tests/**` a ete ajoute a cette liste apres coup, et pour une raison
     * concrete : sans lui, ESLint traitait tests/multisite.integration.test.ts
     * avec son analyseur par defaut, qui ne connait pas la syntaxe TypeScript.
     * `npm run lint` echouait donc sur « Parsing error: Unexpected token > » a
     * la premiere generique rencontree — un echec qui n'apprend rien et qui
     * rend la commande inutilisable en integration continue.
     */
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "collectors/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      // « rsc » pour React Server Components : le prefixe se lit dans les
      // messages, il doit donc dire de quoi la regle parle.
      rsc: { rules: { "no-client-value-in-server": noClientValueInServer } },
      "react-hooks": reactHooks,
    },
    rules: {
      // ERREUR et non avertissement : le defaut qu'elle attrape ne casse ni le
      // build ni les types, et ne se voit qu'en lisant le HTML servi. Un
      // avertissement se noierait exactement la ou il faut qu'il arrete.
      "rsc/no-client-value-in-server": "error",

      // Retenu sur mesure. Sur ce depot, `set-state-in-effect` a signale deux
      // endroits : un VRAI defaut dans ThemeToggle.tsx (un `setState` synchrone
      // dans un effet, corrige en passant a `useSyncExternalStore`) et un FAUX
      // POSITIF dans AssetManager.tsx, ou la regle suit l'appel dans un
      // `useCallback` asynchrone sans modeliser les `await` qui precedent le
      // `setState` — verifie sur un cas minimal, l'exception y est documentee.
      // Un pour un : la regle reste en erreur, elle a montre qu'elle trouvait.
      // Le code portait par ailleurs deja une directive `exhaustive-deps`,
      // donc ce jeu de regles etait attendu.
      ...reactHooks.configs.recommended.rules,
    },
  },

  {
    /*
     * Les fichiers de test sont executes par Node (`tsx --test`), pas par le
     * bundler : la frontiere serveur/client n'existe pas pour eux, et importer
     * une fonction depuis un module « use client » y fonctionne parfaitement.
     *
     * Constate, et non suppose : la regle signalait
     * src/blocks/previewConfig.test.ts, qui importe `buildEditorConfig` et
     * `containerHasContent` depuis un module client — et ce test passe.
     */
    files: ["**/*.test.{ts,tsx}"],
    rules: { "rsc/no-client-value-in-server": "off" },
  },
];
