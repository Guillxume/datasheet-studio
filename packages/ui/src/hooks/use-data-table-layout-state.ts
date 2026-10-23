'use client'

import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnVisibilityState as VisibilityState,
} from '@tanstack/react-table'
import { useCallback, useRef, useState } from 'react'

import type { DisplayMode, TableLayout } from './use-settings'
import { useSettings } from './use-settings'

type UseDataTableLayoutStateOptions = {
  /** Unique identifier for this table — each table stores its own layout. */
  tableId: string
  /** Default column visibility used when no saved layout exists. */
  defaultColumnVisibility?: VisibilityState
  /** Default column pinning used when no saved layout exists. */
  defaultColumnPinning?: Partial<ColumnPinningState>
  /** Default column order used when no saved layout exists. */
  defaultColumnOrder?: ColumnOrderState
  /** Default display mode used when no saved layout exists. */
  defaultDisplayMode?: DisplayMode
}

type UseDataTableLayoutStateReturn = {
  /** Spread these onto `<DataTable>` to wire up layout persistence. */
  initialColumnVisibility: VisibilityState
  onColumnVisibilityChange: (visibility: VisibilityState) => void
  initialColumnPinning: Partial<ColumnPinningState>
  onColumnPinningChange: (pinning: ColumnPinningState) => void
  initialColumnOrder: ColumnOrderState
  onColumnOrderChange: (columnOrder: string[]) => void
  /** Display mode from localStorage (or default). Use as `defaultDisplayMode` for the URL state hook. */
  displayMode: DisplayMode
  /** Persist display mode to localStorage. */
  onDisplayModeChange: (mode: DisplayMode) => void
  /** Whether the current layout differs from the last saved one. */
  isDirty: boolean
  /** Whether a saved layout exists in localStorage for this table. */
  hasSavedLayout: boolean
  /** Persist the current layout to localStorage. */
  saveLayout: () => void
  /** Remove the saved layout from localStorage and reset to defaults. */
  clearSavedLayout: () => void
  /**
   * Key that changes when the layout is cleared.
   * Pass as `<DataTable key={layoutState.resetKey} ...>` so the table
   * remounts with default initial values after clearing.
   */
  resetKey: number
}

const useDataTableLayoutState = ({
  tableId,
  defaultColumnVisibility = {},
  defaultColumnPinning = {},
  defaultColumnOrder = [],
  defaultDisplayMode,
}: UseDataTableLayoutStateOptions): UseDataTableLayoutStateReturn => {
  const { getTableLayout, saveTableLayout, clearTableLayout } = useSettings()

  const [saved, setSaved] = useState<TableLayout | null>(() =>
    getTableLayout(tableId),
  )
  const currentRef = useRef<TableLayout>(saved ?? {})
  const savedRef = useRef<TableLayout>(saved ?? {})
  const [isDirty, setIsDirty] = useState(false)
  const [hasSavedLayout, setHasSavedLayout] = useState(saved !== null)
  const [resetKey, setResetKey] = useState(0)

  const onColumnVisibilityChange = useCallback(
    (visibility: VisibilityState) => {
      currentRef.current = {
        ...currentRef.current,
        columnVisibility: visibility,
      }
      setIsDirty(true)
    },
    [],
  )

  const onColumnPinningChange = useCallback((pinning: ColumnPinningState) => {
    currentRef.current = { ...currentRef.current, columnPinning: pinning }
    setIsDirty(true)
  }, [])

  const onColumnOrderChange = useCallback((columnOrder: string[]) => {
    currentRef.current = { ...currentRef.current, columnOrder }
    setIsDirty(true)
  }, [])

  const onDisplayModeChange = useCallback(
    (mode: DisplayMode) => {
      currentRef.current.displayMode = mode
      saveTableLayout(tableId, { ...savedRef.current, displayMode: mode })
      savedRef.current = { ...savedRef.current, displayMode: mode }
      setSaved(prev => ({ ...prev, displayMode: mode }))
      setHasSavedLayout(true)
    },
    [tableId, saveTableLayout],
  )

  const saveLayout = useCallback(() => {
    saveTableLayout(tableId, currentRef.current)
    savedRef.current = currentRef.current
    setSaved(currentRef.current)
    setIsDirty(false)
    setHasSavedLayout(true)
  }, [tableId, saveTableLayout])

  const clearSavedLayout = useCallback(() => {
    clearTableLayout(tableId)
    currentRef.current = {}
    savedRef.current = {}
    setSaved(null)
    setIsDirty(false)
    setHasSavedLayout(false)
    setResetKey(k => k + 1)
  }, [tableId, clearTableLayout])

  return {
    initialColumnVisibility: saved?.columnVisibility ?? defaultColumnVisibility,
    onColumnVisibilityChange,
    initialColumnPinning: saved?.columnPinning ?? defaultColumnPinning,
    onColumnPinningChange,
    initialColumnOrder: saved?.columnOrder ?? defaultColumnOrder,
    onColumnOrderChange,
    displayMode: saved?.displayMode ?? defaultDisplayMode ?? 'table',
    onDisplayModeChange,
    isDirty,
    hasSavedLayout,
    saveLayout,
    clearSavedLayout,
    resetKey,
  }
}

export { useDataTableLayoutState }
export type { UseDataTableLayoutStateOptions, UseDataTableLayoutStateReturn }
