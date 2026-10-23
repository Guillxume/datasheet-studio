/**
 * localStorage key used by `SettingsProvider`, `buildThemeScript` and
 * `buildLocaleRedirectScript` when the app does not pass its own `storageKey`.
 *
 * Kept outside `settings-provider.tsx` on purpose: that module is
 * `'use client'`, so a constant exported from it reaches server components as
 * a client reference, not as a string — and both inline scripts are built on
 * the server.
 */
export const DEFAULT_SETTINGS_STORAGE_KEY = 'internal-ui-settings'

/**
 * Builds the inline script that runs before paint to prevent a flash of the
 * wrong theme: reads the theme saved by `SettingsProvider`, falls back to the
 * OS preference. No user input involved.
 *
 * `storageKey` must match the one given to `SettingsProvider`.
 */
export function buildThemeScript(
  storageKey: string = DEFAULT_SETTINGS_STORAGE_KEY,
) {
  const storageKeyJson = JSON.stringify(storageKey).replace(/</g, '\\u003c')
  return `(function(){try{var s=JSON.parse(localStorage.getItem(${storageKeyJson})||"{}");var t=s.theme}catch(e){}if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")})()`
}
