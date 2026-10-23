# SettingsProvider

Client-side settings manager that persists theme, locale, and data table layout preferences to `localStorage`. Provides a React context consumed via the `useSettings` hook.

## Import

```tsx
import { SettingsProvider } from '@guillxume/ui/components/settings-provider'
import { useSettings } from '@guillxume/ui/hooks/use-settings'
```

## Setup

Wrap your app with `<SettingsProvider>` near the root:

```tsx
<SettingsProvider>
  {children}
</SettingsProvider>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `storageKey` | `string` | `'internal-ui-settings'` | localStorage key holding the settings |

Three pieces read this key and must all receive the same value: `SettingsProvider`, the theme script (`buildThemeScript`, see below) and the root locale redirect (`buildLocaleRedirectScript` from `@guillxume/ui/components/client-redirect`). Define it once per app:

```tsx
// src/lib/settings.ts
export const SETTINGS_STORAGE_KEY = 'my-app-settings'
```

## Theme script

`SettingsProvider` applies the theme after hydration. To avoid a flash of the wrong theme on first paint, inline the script built by `buildThemeScript` in the root layout's `<head>`:

```tsx
import { buildThemeScript } from '@guillxume/ui/lib/settings-storage'
import { SETTINGS_STORAGE_KEY } from '@/lib/settings'

const themeScript = buildThemeScript(SETTINGS_STORAGE_KEY)

// The script adds the `dark` class before React hydrates, so <html> needs
// suppressHydrationWarning to avoid a hydration mismatch warning.
<html lang={locale} suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
  </head>
```

## Hook: `useSettings`

Returns the current settings and setters. Must be called within a `<SettingsProvider>`.

| Property | Type | Description |
|----------|------|-------------|
| `theme` | `'light' \| 'dark' \| 'system'` | Current theme preference |
| `setTheme` | `(theme: Theme) => void` | Update theme (applies immediately to `<html>`) |
| `resolvedTheme` | `'light' \| 'dark'` | Resolved theme after evaluating `'system'` against OS preference |
| `locale` | `string` | Stored locale preference (e.g. `'en'`, `'fr'`) |
| `setLocale` | `(locale: string) => void` | Update stored locale |
| `getTableLayout` | `(tableId: string) => TableLayout \| null` | Retrieve saved table layout |
| `saveTableLayout` | `(tableId: string, layout: TableLayout) => void` | Persist a table layout |
| `clearTableLayout` | `(tableId: string) => void` | Remove a saved table layout |

### TableLayout

```tsx
type TableLayout = {
  columnVisibility?: Record<string, boolean>
  columnPinning?: { start?: string[]; end?: string[] }
  columnOrder?: string[]
  displayMode?: 'table' | 'card' | 'calendar'
}
```

Column pinning uses TanStack Table 9's logical `start` / `end` sides. Layouts saved before the TanStack Table 9 upgrade used `left` / `right`; they are read as `start` / `end` and rewritten with the new keys on the next save, so users keep their pinned columns.

## Storage

All settings are stored under the `storageKey` localStorage key (`'internal-ui-settings'` by default) as a single JSON object. The schema uses Zod with `.catch()` fallbacks so corrupt data never breaks the app. Each table layout under `tables` is parsed on its own: a malformed layout is dropped while the other tables' layouts are kept.

## Examples

### Theme switching

```tsx
const { theme, setTheme } = useSettings()

<select value={theme} onChange={e => setTheme(e.target.value as Theme)}>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
  <option value="system">System</option>
</select>
```

### Locale switching

```tsx
const { locale, setLocale } = useSettings()
const router = useRouter()
const pathname = usePathname()

const changeLanguage = (lng: string) => {
  setLocale(lng)
  router.replace(pathname, { locale: lng })
}
```

### Table layout persistence

`useSettings` powers `useDataTableLayoutState` under the hood — you typically don't call these methods directly. See the [Data Table docs](data-table.md#with-layout-persistence-usedatatablelayoutstate) for the recommended API.
