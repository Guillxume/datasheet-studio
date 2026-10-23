/**
 * Chromatic modes: every theme in light and dark. The values are the toolbar
 * globals read by the decorator in preview.tsx.
 *
 * Applied only to the stories that show theme colors (see
 * `chromatic: { modes: themeModes }`): components use the same CSS variables
 * in every theme, so these stories are enough to catch a broken theme without
 * snapshotting every story four times. Each mode has its own baseline, keyed by
 * its name: renaming a mode starts a new baseline.
 */
export const themeModes = {
  'neutral light': { brand: 'neutral', mode: 'light' },
  'neutral dark': { brand: 'neutral', mode: 'dark' },
  'datasheet-studio light': { brand: 'datasheet-studio', mode: 'light' },
  'datasheet-studio dark': { brand: 'datasheet-studio', mode: 'dark' },
}
