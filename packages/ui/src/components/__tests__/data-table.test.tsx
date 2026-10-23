// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type ColumnDef,
  DataTable,
  type DataTableProps,
  type PaginationState,
} from '../data-table'
import { DataTableBulkActions } from '../data-table-bulk-actions'
import { DataTableColumnHeader } from '../data-table-column-header'
import { DataTableSearch } from '../data-table-search'

// jsdom lacks it; the table measures its container on mount.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type Item = { id: string; name: string; status: string; qty: number }
type TableInstance = Parameters<
  NonNullable<DataTableProps<Item, unknown>['toolbar']>
>[0]

// 25 rows: item-01…item-25, qty = 100 - n, status alternates draft/published.
const DATA: Item[] = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  name: `item-${String(i + 1).padStart(2, '0')}`,
  status: i % 2 === 0 ? 'draft' : 'published',
  qty: 100 - i,
}))

const COLUMNS: ColumnDef<Item>[] = [
  { id: 'select', header: () => null, cell: () => null },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: 'status',
    header: () => 'Status',
    cell: ({ row }) => row.original.status,
  },
  {
    accessorKey: 'qty',
    header: () => 'Qty',
    cell: ({ row }) => row.original.qty,
  },
  { id: 'actions', header: () => 'Actions', cell: () => 'act' },
]

afterEach(cleanup)

// Renders a client-mode table and captures the TanStack instance via the toolbar slot.
const renderTable = (
  props: Partial<DataTableProps<Item, unknown>> = {},
): { table: () => TableInstance } => {
  let instance: TableInstance | undefined
  render(
    <DataTable<Item, unknown>
      columns={COLUMNS}
      data={DATA}
      toolbar={t => {
        instance = t
        return null
      }}
      {...(props as object)}
    />,
  )
  return {
    table: () => {
      if (!instance) throw new Error('table not rendered')
      return instance
    },
  }
}

const bodyRows = () => {
  const [, body] = screen.getAllByRole('rowgroup')
  return within(body as HTMLElement).getAllByRole('row')
}
const firstCellTexts = (column: number) =>
  bodyRows().map(r => within(r).getAllByRole('cell')[column]?.textContent)
const headerTexts = () =>
  screen.getAllByRole('columnheader').map(th => th.textContent)

describe('DataTable (client mode)', () => {
  it('paginates rows client-side with a default page size of 10', () => {
    const { table } = renderTable()
    expect(bodyRows()).toHaveLength(10)
    expect(firstCellTexts(1)[0]).toBe('item-01')

    act(() => table().nextPage())
    expect(firstCellTexts(1)[0]).toBe('item-11')
    expect(table().getPageCount()).toBe(3)

    act(() => table().lastPage())
    expect(bodyRows()).toHaveLength(5)
  })

  it('sorts when the column header is clicked, then via the API', () => {
    const { table } = renderTable()
    act(() => screen.getByRole('button', { name: 'Name' }).click())
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveProperty(
      'ariaSort',
      'ascending',
    )
    act(() => screen.getByRole('button', { name: 'Name' }).click())
    expect(firstCellTexts(1)[0]).toBe('item-25')

    act(() => table().setSorting([{ id: 'qty', desc: false }]))
    expect(firstCellTexts(3)[0]).toBe('76')
  })

  it('filters rows and exposes faceted unique values', () => {
    const { table } = renderTable()
    const facets = table().getColumn('status')?.getFacetedUniqueValues()
    expect(facets?.get('draft')).toBe(13)
    expect(facets?.get('published')).toBe(12)

    act(() => table().getColumn('status')?.setFilterValue('published'))
    expect(table().getFilteredRowModel().rows).toHaveLength(12)
    expect(new Set(firstCellTexts(2))).toEqual(new Set(['published']))
    expect(table().getColumn('status')?.getIsFiltered()).toBe(true)

    act(() => table().getColumn('qty')?.setFilterValue([90, 95]))
    expect(firstCellTexts(3)).toEqual(['95', '93', '91'])
  })

  it('selects rows and drives the bulk-actions checkbox (indeterminate, then all)', () => {
    const { table } = renderTable({
      bulkActions: () => <DataTableBulkActions<Item> actions={[]} />,
    })
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()

    act(() => table().getRowModel().rows[0]?.toggleSelected(true))
    const selectAll = screen.getByRole('checkbox', { name: 'Select all' })
    expect(selectAll.getAttribute('aria-checked')).toBe('mixed')
    expect(bodyRows()[0]?.getAttribute('aria-selected')).toBe('true')

    act(() => table().toggleAllPageRowsSelected(true))
    expect(
      screen
        .getByRole('checkbox', { name: 'Select all' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(table().getFilteredSelectedRowModel().rows).toHaveLength(10)

    act(() => table().toggleAllRowsSelected(false))
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
  })

  it('applies initial column visibility and reports changes', () => {
    const onColumnVisibilityChange = vi.fn()
    const { table } = renderTable({
      initialColumnVisibility: { qty: false },
      onColumnVisibilityChange,
    })
    expect(headerTexts()).not.toContain('Qty')

    act(() => table().getColumn('qty')?.toggleVisibility(true))
    expect(headerTexts()).toContain('Qty')
    expect(onColumnVisibilityChange).toHaveBeenLastCalledWith({ qty: true })
  })

  it('reorders columns and reports the new order', () => {
    const onColumnOrderChange = vi.fn()
    const { table } = renderTable({ onColumnOrderChange })
    const order = ['select', 'qty', 'name', 'status', 'actions']
    act(() => table().setColumnOrder(order))
    expect(headerTexts()[1]).toBe('Qty')
    expect(headerTexts()[2]).toMatch(/^Name/)
    expect(onColumnOrderChange).toHaveBeenLastCalledWith(order)
  })

  it('pins the select column to the start and initial pinned columns as sticky', () => {
    const onColumnPinningChange = vi.fn()
    const { table } = renderTable({
      initialColumnPinning: { end: ['actions'] },
      onColumnPinningChange,
    })
    const select = screen.getAllByRole('columnheader')[0] as HTMLElement
    const actions = screen.getByRole('columnheader', { name: 'Actions' })
    expect(select.style.position).toBe('sticky')
    expect(select.style.left).toBe('0px')
    expect(actions.style.position).toBe('sticky')
    expect(actions.style.right).toBe('0px')
    expect(table().getColumn('actions')?.getIsPinned()).toBe('end')

    act(() => table().getColumn('name')?.pin('start'))
    expect(onColumnPinningChange).toHaveBeenLastCalledWith({
      start: ['select', 'name'],
      end: ['actions'],
    })
    const name = screen.getByRole('columnheader', { name: /Name/ })
    expect(name.style.position).toBe('sticky')
  })

  it('offsets pinned columns by the measured widths of the ones before them', () => {
    const widths: Record<string, number> = {
      select: 40,
      name: 120,
      status: 90,
      qty: 70,
      actions: 80,
    }
    const rect = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        const id = (this as HTMLElement).dataset?.columnId
        return { width: id ? (widths[id] ?? 0) : 0 } as DOMRect
      })
    try {
      renderTable({
        initialColumnPinning: { start: ['name'], end: ['qty', 'actions'] },
      })
      const th = (id: string) =>
        document.querySelector(
          `th[data-column-id="${id}"]`,
        ) as HTMLTableCellElement
      expect(th('select').style.left).toBe('0px')
      expect(th('name').style.left).toBe('40px')
      expect(th('actions').style.right).toBe('0px')
      expect(th('qty').style.right).toBe('80px')
      expect(th('status').style.position).toBe('')
    } finally {
      rect.mockRestore()
    }
  })

  it('keeps one ResizeObserver across re-renders that do not change the layout', () => {
    const created = vi.fn()
    const disconnected = vi.fn()
    const Original = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor() {
        created()
      }
      observe() {}
      unobserve() {}
      disconnect() {
        disconnected()
      }
    }
    try {
      const { table } = renderTable()
      expect(created).toHaveBeenCalledTimes(1)
      act(() => table().getRowModel().rows[0]?.toggleSelected(true))
      act(() => table().nextPage())
      act(() => table().setSorting([{ id: 'qty', desc: true }]))
      expect(created).toHaveBeenCalledTimes(1)
      expect(disconnected).not.toHaveBeenCalled()
    } finally {
      globalThis.ResizeObserver = Original
    }
  })
})

describe('DataTable (manual mode)', () => {
  const renderManual = (
    overrides: { rowCount?: number | null; pagination?: PaginationState } = {},
  ) => {
    const onPaginationChange = vi.fn()
    const onSortingChange = vi.fn()
    const onColumnFiltersChange = vi.fn()
    const pageRows = DATA.slice(0, 5)
    let instance: TableInstance | undefined
    const pagination = overrides.pagination ?? { pageIndex: 3, pageSize: 5 }
    const element = (rowCount: number | null) => (
      <DataTable<Item, unknown>
        columns={COLUMNS}
        data={pageRows}
        manualMode
        rowCount={rowCount}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={[]}
        onSortingChange={onSortingChange}
        columnFilters={[{ id: 'status', value: ['published'] }]}
        onColumnFiltersChange={onColumnFiltersChange}
        toolbar={t => {
          instance = t
          return null
        }}
      />
    )
    const view = render(
      element(overrides.rowCount === undefined ? 25 : overrides.rowCount),
    )
    const table = () => instance as TableInstance
    const rerenderWithRowCount = (rowCount: number | null) =>
      view.rerender(element(rowCount))
    return {
      table,
      rerenderWithRowCount,
      onPaginationChange,
      onSortingChange,
      onColumnFiltersChange,
    }
  }

  it('renders server data as-is (no client filtering, sorting or slicing)', () => {
    const { table } = renderManual()
    expect(firstCellTexts(1)).toEqual([
      'item-01',
      'item-02',
      'item-03',
      'item-04',
      'item-05',
    ])
    expect(table().getPageCount()).toBe(5)
    expect(table().getRowCount()).toBe(25)
  })

  it('keeps the page index while rowCount is unknown', () => {
    const { table, onPaginationChange } = renderManual({ rowCount: null })
    expect(onPaginationChange).not.toHaveBeenCalled()
    expect(table().getCanNextPage()).toBe(true)
  })

  it('picks up the row count once it loads, without clamping the page', () => {
    const { table, rerenderWithRowCount, onPaginationChange } = renderManual({
      rowCount: null,
    })
    rerenderWithRowCount(25)
    expect(table().getPageCount()).toBe(5)
    expect(table().getRowCount()).toBe(25)
    expect(table().state.pagination.pageIndex).toBe(3)
    expect(table().getCanNextPage()).toBe(true)
    expect(onPaginationChange).not.toHaveBeenCalled()
  })

  it('routes pagination, sorting and filter changes to the callbacks', () => {
    const {
      table,
      onPaginationChange,
      onSortingChange,
      onColumnFiltersChange,
    } = renderManual()

    act(() => table().nextPage())
    const pageUpdater = onPaginationChange.mock.lastCall?.[0]
    expect(
      typeof pageUpdater === 'function'
        ? pageUpdater({ pageIndex: 3, pageSize: 5 })
        : pageUpdater,
    ).toEqual({ pageIndex: 4, pageSize: 5 })

    act(() => table().setSorting([{ id: 'qty', desc: true }]))
    expect(onSortingChange).toHaveBeenCalled()
    expect(firstCellTexts(1)[0]).toBe('item-01')

    act(() => table().getColumn('status')?.setFilterValue(undefined))
    const filterUpdater = onColumnFiltersChange.mock.lastCall?.[0]
    expect(
      typeof filterUpdater === 'function'
        ? filterUpdater([{ id: 'status', value: ['published'] }])
        : filterUpdater,
    ).toEqual([])
  })
})

describe('DataTableSearch (controlled)', () => {
  // The search box sits in the toolbar of a manual-mode table, as on the list pages.
  const renderSearch = (onValueChange: (value: string) => void) => {
    const element = (value: string, rowCount: number) => (
      <DataTable<Item, unknown>
        columns={COLUMNS}
        data={DATA.slice(0, 5)}
        manualMode
        rowCount={rowCount}
        pagination={{ pageIndex: 0, pageSize: 5 }}
        onPaginationChange={() => {}}
        sorting={[]}
        onSortingChange={() => {}}
        columnFilters={[]}
        onColumnFiltersChange={() => {}}
        toolbar={() => (
          <DataTableSearch
            columns={[{ id: 'name', label: 'Name' }]}
            value={value}
            onValueChange={onValueChange}
            activeColumn='name'
          />
        )}
      />
    )
    const view = render(element('', 25))
    return {
      rerender: (value: string, rowCount: number) =>
        view.rerender(element(value, rowCount)),
    }
  }

  it('reports a typed search once and stays silent across table re-renders', () => {
    vi.useFakeTimers()
    try {
      const onValueChange = vi.fn()
      const { rerender } = renderSearch(onValueChange)

      // Every render hands the search box a new table object: an unchanged
      // search must not be reported again (it used to rewrite the URL in a loop).
      act(() => vi.advanceTimersByTime(250))
      rerender('', 26)
      act(() => vi.advanceTimersByTime(250))
      rerender('', 27)
      act(() => vi.advanceTimersByTime(250))
      expect(onValueChange).not.toHaveBeenCalled()

      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'abc' },
      })
      act(() => vi.advanceTimersByTime(250))
      expect(onValueChange).toHaveBeenCalledTimes(1)
      expect(onValueChange).toHaveBeenLastCalledWith('abc')

      rerender('abc', 28)
      act(() => vi.advanceTimersByTime(250))
      expect(onValueChange).toHaveBeenCalledTimes(1)

      fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
      act(() => vi.advanceTimersByTime(250))
      expect(onValueChange).toHaveBeenCalledTimes(2)
      expect(onValueChange).toHaveBeenLastCalledWith('')
    } finally {
      vi.useRealTimers()
    }
  })
})
