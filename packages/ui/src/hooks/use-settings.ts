'use client'

import { createContext, useContext } from 'react'

type Theme = 'light' | 'dark' | 'system'

type DisplayMode = 'table' | 'card' | 'calendar'

type TableLayout = {
  columnVisibility?: Record<string, boolean>
  columnPinning?: { start?: string[]; end?: string[] }
  columnOrder?: string[]
  displayMode?: DisplayMode
}

type Settings = {
  theme: Theme
  locale: string
  tables: Record<string, TableLayout>
}

type SettingsContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
  locale: string
  setLocale: (locale: string) => void
  getTableLayout: (tableId: string) => TableLayout | null
  saveTableLayout: (tableId: string, layout: TableLayout) => void
  clearTableLayout: (tableId: string) => void
}

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
)

export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

export type { DisplayMode, Settings, SettingsContextValue, TableLayout, Theme }
