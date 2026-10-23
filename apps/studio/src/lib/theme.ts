import { buildThemeScript } from "@guillxume/ui/lib/settings-storage";

/**
 * THEME CLAIR / SOMBRE — celui du design system partage.
 *
 * Le SettingsProvider du package garde le choix (clair, sombre, systeme) sous
 * cette clef et pose la classe `.dark` sur <html>. Le menu utilisateur et la
 * bascule de l'editeur l'ecrivent par useSettings().
 *
 * MODULE SANS « use client », et c'est la raison de son existence : layout.tsx,
 * composant serveur, y lit la clef et le script. Une constante importee d'un
 * module client y arriverait `undefined` (voir editorTheme.test.ts).
 */
export const SETTINGS_STORAGE_KEY = "ds-settings";

/** Clef du Studio avant le design system partage : "light" ou "dark", absente pour « systeme ». */
export const LEGACY_THEME_KEY = "ds-theme";

/**
 * REPRISE DE L'ANCIEN CHOIX, une fois par navigateur : sans elle, qui avait
 * choisi « Sombre » retomberait sur le theme du systeme au premier passage.
 * Elle ne remplace jamais un choix deja fait dans le nouveau stockage.
 */
const REPRISE =
  `(function(){try{var a=localStorage.getItem(${JSON.stringify(LEGACY_THEME_KEY)});` +
  `if((a==="light"||a==="dark")&&!localStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)}))` +
  `localStorage.setItem(${JSON.stringify(SETTINGS_STORAGE_KEY)},JSON.stringify({theme:a}));` +
  `localStorage.removeItem(${JSON.stringify(LEGACY_THEME_KEY)})}catch(e){}})();`;

/**
 * Script de PRE-PEINTURE, a poser en ligne dans le <head> : il pose `.dark`
 * avant la premiere peinture, sans quoi un choix « Sombre » sur un systeme en
 * clair montrerait une page claire puis un basculement.
 */
export const THEME_PREPAINT_SCRIPT = REPRISE + buildThemeScript(SETTINGS_STORAGE_KEY);
