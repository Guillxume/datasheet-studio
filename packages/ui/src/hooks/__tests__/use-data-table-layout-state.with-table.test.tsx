// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  type ColumnDef,
  DataTable,
  type DataTableProps,
} from '../../components/data-table'
import { SettingsProvider } from '../../components/settings-provider'
import { DEFAULT_SETTINGS_STORAGE_KEY } from '../../lib/settings-storage'
import {
  type UseDataTableLayoutStateReturn,
  useDataTableLayoutState,
} from '../use-data-table-layout-state'

// jsdom lacks it; the table measures its container on mount.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom lacks it; the settings provider reads it to resolve the "system" theme.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

type Item = { id: string; name: string; qty: number }
type TableInstance = Parameters<
  NonNullable<DataTableProps<Item, unknown>['toolbar']>
>[0]

// An app's own settings key (see SettingsProvider `storageKey`): v8-era layouts
// saved there must keep loading after the TanStack Table 9 upgrade.
const STORAGE_KEY = 'my-app-settings'
const TABLE_ID = 'items'

const COLUMNS: ColumnDef<Item>[] = [
  {
    accessorKey: 'name',
    header: () => 'Name',
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: 'qty',
    header: () => 'Qty',
    cell: ({ row }) => row.original.qty,
  },
  { id: 'actions', header: () => 'Actions', cell: () => 'act' },
]
const DATA: Item[] = [{ id: '1', name: 'a', qty: 1 }]

type Captured = {
  table?: TableInstance
  layout?: UseDataTableLayoutStateReturn
}

const Harness = ({ captured }: { captured: Captured }) => {
  const layout = useDataTableLayoutState({
    tableId: TABLE_ID,
    defaultColumnVisibility: { qty: false },
  })
  captured.layout = layout
  return (
    <DataTable<Item, unknown>
      key={layout.resetKey}
      columns={COLUMNS}
      data={DATA}
      initialColumnVisibility={layout.initialColumnVisibility}
      onColumnVisibilityChange={layout.onColumnVisibilityChange}
      initialColumnPinning={layout.initialColumnPinning}
      onColumnPinningChange={layout.onColumnPinningChange}
      initialColumnOrder={layout.initialColumnOrder}
      onColumnOrderChange={layout.onColumnOrderChange}
      toolbar={t => {
        captured.table = t
        return null
      }}
    />
  )
}

// `null` renders the provider without a storageKey, i.e. with its default key.
const mount = (storageKey: string | null = STORAGE_KEY) => {
  const captured: Captured = {}
  const view = render(
    <SettingsProvider {...(storageKey === null ? {} : { storageKey })}>
      <Harness captured={captured} />
    </SettingsProvider>,
  )
  return {
    view,
    table: () => captured.table as TableInstance,
    layout: () => captured.layout as UseDataTableLayoutStateReturn,
  }
}

const headerTexts = () =>
  screen.getAllByRole('columnheader').map(th => th.textContent)
const storedTables = (storageKey: string = STORAGE_KEY) =>
  JSON.parse(localStorage.getItem(storageKey) ?? '{}').tables ?? {}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('useDataTableLayoutState wired to DataTable', () => {
  it('starts from the defaults when nothing is saved', () => {
    const { layout } = mount()
    expect(headerTexts()).toEqual(['Name', 'Actions'])
    expect(layout().hasSavedLayout).toBe(false)
    expect(layout().isDirty).toBe(false)
  })

  it('saves visibility, pinning and order, and restores them on the next mount', () => {
    const first = mount()
    act(() => first.table().getColumn('qty')?.toggleVisibility(true))
    act(() => first.table().getColumn('actions')?.pin('end'))
    act(() => first.table().setColumnOrder(['qty', 'name', 'actions']))
    expect(first.layout().isDirty).toBe(true)

    act(() => first.layout().saveLayout())
    expect(first.layout().isDirty).toBe(false)
    expect(first.layout().hasSavedLayout).toBe(true)
    expect(storedTables()[TABLE_ID]).toEqual({
      columnVisibility: { qty: true },
      columnPinning: { start: [], end: ['actions'] },
      columnOrder: ['qty', 'name', 'actions'],
    })

    first.view.unmount()
    const second = mount()
    expect(headerTexts()).toEqual(['Qty', 'Name', 'Actions'])
    expect(second.table().getColumn('actions')?.getIsPinned()).toBe('end')
    expect(
      screen.getByRole('columnheader', { name: 'Actions' }).style.position,
    ).toBe('sticky')
  })

  it('reads layouts saved with the pre-v9 left / right pinning keys', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: 'system',
        locale: '',
        tables: {
          [TABLE_ID]: { columnPinning: { left: ['name'], right: ['actions'] } },
        },
      }),
    )
    const { table, layout } = mount()
    expect(layout().hasSavedLayout).toBe(true)
    expect(layout().initialColumnPinning).toEqual({
      start: ['name'],
      end: ['actions'],
    })
    expect(table().getColumn('name')?.getIsPinned()).toBe('start')
    expect(table().getColumn('actions')?.getIsPinned()).toBe('end')

    // Saving rewrites the layout with the logical keys only.
    act(() => layout().saveLayout())
    expect(storedTables()[TABLE_ID].columnPinning).toEqual({
      start: ['name'],
      end: ['actions'],
    })
  })

  it('drops a malformed saved layout without losing the other tables', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: 'system',
        locale: '',
        tables: {
          broken: { columnOrder: 'not-an-array' },
          [TABLE_ID]: { columnVisibility: { qty: true } },
        },
      }),
    )
    const { layout } = mount()
    expect(layout().hasSavedLayout).toBe(true)
    expect(headerTexts()).toEqual(['Name', 'Qty', 'Actions'])
  })

  it('clears the saved layout and remounts the table with the defaults', () => {
    const { table, layout } = mount()
    act(() => table().getColumn('qty')?.toggleVisibility(true))
    act(() => layout().saveLayout())
    expect(headerTexts()).toContain('Qty')

    act(() => layout().clearSavedLayout())
    expect(storedTables()[TABLE_ID]).toBeUndefined()
    expect(layout().hasSavedLayout).toBe(false)
    expect(headerTexts()).toEqual(['Name', 'Actions'])
  })

  it('persists under the default storage key when none is given', () => {
    const { table, layout } = mount(null)
    act(() => table().getColumn('name')?.pin('start'))
    act(() => layout().saveLayout())
    expect(
      storedTables(DEFAULT_SETTINGS_STORAGE_KEY)[TABLE_ID].columnPinning,
    ).toEqual({ start: ['name'], end: [] })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
