// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDataTableLayoutState } from '../use-data-table-layout-state'
import { SettingsContext, type SettingsContextValue } from '../use-settings'

const createMockSettings = (
  tableLayouts: Record<string, Record<string, unknown>> = {},
) => {
  const savedLayouts = new Map(Object.entries(tableLayouts))

  const value: SettingsContextValue = {
    theme: 'system',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
    locale: 'en',
    setLocale: vi.fn(),
    getTableLayout: vi.fn(
      (tableId: string) => savedLayouts.get(tableId) ?? null,
    ),
    saveTableLayout: vi.fn((tableId: string, layout) => {
      savedLayouts.set(tableId, layout)
    }),
    clearTableLayout: vi.fn((tableId: string) => {
      savedLayouts.delete(tableId)
    }),
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsContext value={value}>{children}</SettingsContext>
  )

  return { value, wrapper }
}

describe('useDataTableLayoutState', () => {
  it('returns defaults when no saved layout exists', () => {
    const { wrapper } = createMockSettings()
    const { result } = renderHook(
      () =>
        useDataTableLayoutState({
          tableId: 'orders',
          defaultColumnVisibility: { id: false },
          defaultColumnPinning: { start: ['select'] },
          defaultColumnOrder: ['select', 'name'],
        }),
      { wrapper },
    )

    expect(result.current.initialColumnVisibility).toEqual({ id: false })
    expect(result.current.initialColumnPinning).toEqual({ start: ['select'] })
    expect(result.current.initialColumnOrder).toEqual(['select', 'name'])
    expect(result.current.hasSavedLayout).toBe(false)
    expect(result.current.isDirty).toBe(false)
  })

  it('returns saved layout when one exists', () => {
    const { wrapper } = createMockSettings({
      orders: {
        columnVisibility: { id: true, name: false },
        columnPinning: { end: ['actions'] },
        columnOrder: ['name', 'actions'],
      },
    })
    const { result } = renderHook(
      () =>
        useDataTableLayoutState({
          tableId: 'orders',
          defaultColumnVisibility: { id: false },
        }),
      { wrapper },
    )

    expect(result.current.initialColumnVisibility).toEqual({
      id: true,
      name: false,
    })
    expect(result.current.initialColumnPinning).toEqual({ end: ['actions'] })
    expect(result.current.initialColumnOrder).toEqual(['name', 'actions'])
    expect(result.current.hasSavedLayout).toBe(true)
  })

  it('onColumnVisibilityChange sets isDirty to true', () => {
    const { wrapper } = createMockSettings()
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    expect(result.current.isDirty).toBe(false)
    act(() => {
      result.current.onColumnVisibilityChange({ id: true })
    })
    expect(result.current.isDirty).toBe(true)
  })

  it('onColumnPinningChange sets isDirty to true', () => {
    const { wrapper } = createMockSettings()
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    act(() => {
      result.current.onColumnPinningChange({ start: ['select'], end: [] })
    })
    expect(result.current.isDirty).toBe(true)
  })

  it('onColumnOrderChange sets isDirty to true', () => {
    const { wrapper } = createMockSettings()
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    act(() => {
      result.current.onColumnOrderChange(['a', 'b'])
    })
    expect(result.current.isDirty).toBe(true)
  })

  it('saveLayout persists current layout and resets isDirty', () => {
    const { wrapper, value } = createMockSettings()
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    act(() => {
      result.current.onColumnVisibilityChange({ id: true })
    })
    expect(result.current.isDirty).toBe(true)

    act(() => {
      result.current.saveLayout()
    })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.hasSavedLayout).toBe(true)
    expect(value.saveTableLayout).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({ columnVisibility: { id: true } }),
    )
  })

  it('clearSavedLayout removes layout and increments resetKey', () => {
    const { wrapper, value } = createMockSettings({
      orders: { columnVisibility: { id: true } },
    })
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    const initialResetKey = result.current.resetKey

    act(() => {
      result.current.clearSavedLayout()
    })

    expect(result.current.hasSavedLayout).toBe(false)
    expect(result.current.isDirty).toBe(false)
    expect(result.current.resetKey).toBe(initialResetKey + 1)
    expect(value.clearTableLayout).toHaveBeenCalledWith('orders')
  })

  it('supports calendar display mode', () => {
    const { wrapper } = createMockSettings()
    const { result } = renderHook(
      () =>
        useDataTableLayoutState({
          tableId: 'orders',
          defaultDisplayMode: 'calendar',
        }),
      { wrapper },
    )

    expect(result.current.displayMode).toBe('calendar')
  })

  it('auto-saves calendar display mode to localStorage', () => {
    const { wrapper, value } = createMockSettings()
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    act(() => {
      result.current.onDisplayModeChange('calendar')
    })

    expect(result.current.displayMode).toBe('calendar')
    expect(value.saveTableLayout).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({ displayMode: 'calendar' }),
    )
  })

  it('returns saved displayMode from localStorage', () => {
    const { wrapper } = createMockSettings({
      orders: { displayMode: 'calendar' },
    })
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    expect(result.current.displayMode).toBe('calendar')
  })

  it('defaults displayMode to "table" when no saved layout and no default', () => {
    const { wrapper } = createMockSettings()
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    expect(result.current.displayMode).toBe('table')
  })

  it('onDisplayModeChange does not affect displayMode of other consumers reading from URL', () => {
    // displayMode is now derived from saved state — calling onDisplayModeChange
    // persists to localStorage but the URL state hook owns the live reactive value.
    // This test verifies onDisplayModeChange only writes to localStorage.
    const { wrapper, value } = createMockSettings()
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    act(() => {
      result.current.onDisplayModeChange('calendar')
    })

    // Persisted to localStorage
    expect(value.saveTableLayout).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({ displayMode: 'calendar' }),
    )
    // Layout state reflects the persisted value
    expect(result.current.displayMode).toBe('calendar')
  })

  it('clearSavedLayout resets displayMode to defaultDisplayMode', () => {
    const { wrapper } = createMockSettings({
      orders: { displayMode: 'calendar' },
    })
    const { result } = renderHook(
      () =>
        useDataTableLayoutState({
          tableId: 'orders',
          defaultDisplayMode: 'card',
        }),
      { wrapper },
    )

    expect(result.current.displayMode).toBe('calendar')

    act(() => {
      result.current.clearSavedLayout()
    })

    // Falls back to defaultDisplayMode after clearing
    expect(result.current.displayMode).toBe('card')
  })

  it('clearSavedLayout resets displayMode to "table" when no defaultDisplayMode', () => {
    const { wrapper } = createMockSettings({
      orders: { displayMode: 'calendar' },
    })
    const { result } = renderHook(
      () => useDataTableLayoutState({ tableId: 'orders' }),
      { wrapper },
    )

    expect(result.current.displayMode).toBe('calendar')

    act(() => {
      result.current.clearSavedLayout()
    })

    expect(result.current.displayMode).toBe('table')
  })
})
