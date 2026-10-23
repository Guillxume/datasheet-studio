'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { z } from 'zod'

import {
  SettingsContext,
  type Settings,
  type TableLayout,
  type Theme,
} from '../hooks/use-settings'
import { DEFAULT_SETTINGS_STORAGE_KEY } from '../lib/settings-storage'

// Zod schema -- permissive with fallbacks so corrupt data never breaks the app
const tableLayoutSchema = z.object({
  columnVisibility: z.record(z.string(), z.boolean()).optional(),
  // Layouts saved before TanStack Table 9 used physical `left` / `right` keys;
  // read them as the logical `start` / `end` sides.
  columnPinning: z
    .object({
      start: z.array(z.string()).optional(),
      end: z.array(z.string()).optional(),
      left: z.array(z.string()).optional(),
      right: z.array(z.string()).optional(),
    })
    .transform(({ start, end, left, right }) => {
      const pinning: { start?: string[]; end?: string[] } = {}
      const s = start ?? left
      const e = end ?? right
      if (s) pinning.start = s
      if (e) pinning.end = e
      return pinning
    })
    .optional(),
  columnOrder: z.array(z.string()).optional(),
  displayMode: z.enum(['table', 'card', 'calendar']).optional(),
})

// Parse each table layout on its own: a malformed one is dropped, the others kept.
const tablesSchema = z
  .record(z.string(), z.unknown())
  .transform(raw => {
    const tables: Record<string, z.output<typeof tableLayoutSchema>> = {}
    for (const [tableId, layout] of Object.entries(raw)) {
      const parsed = tableLayoutSchema.safeParse(layout)
      if (parsed.success) tables[tableId] = parsed.data
    }
    return tables
  })
  .catch({})

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).catch('system'),
  locale: z.string().catch(''),
  tables: tablesSchema,
})

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  locale: '',
  tables: {},
}

const getSystemTheme = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const applyTheme = (resolved: 'light' | 'dark') => {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

const readSettings = (storageKey: string): Settings => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return DEFAULT_SETTINGS
    return settingsSchema.parse(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

const writeSettings = (storageKey: string, settings: Settings) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export const SettingsProvider = ({
  children,
  storageKey = DEFAULT_SETTINGS_STORAGE_KEY,
}: {
  children: React.ReactNode
  /**
   * localStorage key holding the settings. Pass the same key to
   * `buildThemeScript` and `buildLocaleRedirectScript` so they read the same
   * settings. Must stay constant for the app's lifetime: it is only read on
   * mount, so changing it later would write to a key that was never loaded.
   */
  storageKey?: string
}) => {
  const [settings, setSettings] = useState<Settings>(() =>
    typeof window === 'undefined' ? DEFAULT_SETTINGS : readSettings(storageKey),
  )
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const initial = readSettings(storageKey)
    const resolved =
      initial.theme === 'system' ? getSystemTheme() : initial.theme
    applyTheme(resolved)
    return resolved
  })

  // Re-sync dark class after every render — Next.js RSC navigation can reset
  // <html> className during reconciliation, stripping the imperatively-added class.
  useLayoutEffect(() => {
    applyTheme(resolvedTheme)
  })

  // Listen for OS preference changes when theme is 'system'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    const onChange = () => {
      if (settings.theme !== 'system') return
      const resolved = getSystemTheme()
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }

    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const updateSettings = useCallback(
    (updater: (prev: Settings) => Settings) => {
      setSettings(prev => {
        const next = updater(prev)
        writeSettings(storageKey, next)
        return next
      })
    },
    [storageKey],
  )

  const setTheme = useCallback(
    (theme: Theme) => {
      const resolved = theme === 'system' ? getSystemTheme() : theme
      setResolvedTheme(resolved)
      applyTheme(resolved)
      updateSettings(prev => ({ ...prev, theme }))
    },
    [updateSettings],
  )

  const setLocale = useCallback(
    (locale: string) => {
      updateSettings(prev => ({ ...prev, locale }))
    },
    [updateSettings],
  )

  const getTableLayout = useCallback(
    (tableId: string): TableLayout | null => settings.tables[tableId] ?? null,
    [settings.tables],
  )

  const saveTableLayout = useCallback(
    (tableId: string, layout: TableLayout) => {
      updateSettings(prev => ({
        ...prev,
        tables: { ...prev.tables, [tableId]: layout },
      }))
    },
    [updateSettings],
  )

  const clearTableLayout = useCallback(
    (tableId: string) => {
      updateSettings(prev => {
        const { [tableId]: _, ...rest } = prev.tables
        return { ...prev, tables: rest }
      })
    },
    [updateSettings],
  )

  const value = useMemo(
    () => ({
      theme: settings.theme,
      setTheme,
      resolvedTheme,
      locale: settings.locale,
      setLocale,
      getTableLayout,
      saveTableLayout,
      clearTableLayout,
    }),
    [
      settings.theme,
      settings.locale,
      setTheme,
      resolvedTheme,
      setLocale,
      getTableLayout,
      saveTableLayout,
      clearTableLayout,
    ],
  )

  return <SettingsContext value={value}>{children}</SettingsContext>
}
