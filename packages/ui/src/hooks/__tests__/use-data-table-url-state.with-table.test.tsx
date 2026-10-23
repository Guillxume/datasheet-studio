// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react'
import {
  type OnUrlUpdateFunction,
  withNuqsTestingAdapter,
} from 'nuqs/adapters/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type ColumnDef,
  DataTable,
  type DataTableProps,
} from '../../components/data-table'
import { useDataTableUrlState } from '../use-data-table-url-state'

// jsdom lacks it; the table measures its container on mount.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type Item = {
  id: string
  name: string
  status: string
  qty: number
  created_at: string
}
type TableInstance = Parameters<
  NonNullable<DataTableProps<Item, unknown>['toolbar']>
>[0]

const DATA: Item[] = Array.from({ length: 5 }, (_, i) => ({
  id: String(i + 1),
  name: `item-${i + 1}`,
  status: 'draft',
  qty: i,
  created_at: '2026-01-01T00:00:00.000Z',
}))

const COLUMNS: ColumnDef<Item>[] = ['name', 'status', 'qty', 'created_at'].map(
  key => ({
    accessorKey: key,
    header: () => key,
    cell: ({ getValue }) => String(getValue()),
  }),
)

const Harness = ({ onTable }: { onTable: (t: TableInstance) => void }) => {
  const url = useDataTableUrlState({
    defaultPageSize: 5,
    filters: {
      status: { type: 'faceted' },
      qty: { type: 'number' },
      created_at: { type: 'date', paramName: 'created' },
    },
  })
  return (
    <DataTable<Item, unknown>
      columns={COLUMNS}
      data={DATA}
      manualMode
      rowCount={50}
      pagination={url.pagination}
      onPaginationChange={url.onPaginationChange}
      sorting={url.sorting}
      onSortingChange={url.onSortingChange}
      columnFilters={url.columnFilters}
      onColumnFiltersChange={url.onColumnFiltersChange}
      toolbar={t => {
        onTable(t)
        return null
      }}
    />
  )
}

afterEach(cleanup)

const renderWithUrl = (searchParams: string) => {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>()
  let instance: TableInstance | undefined
  render(
    <Harness
      onTable={t => {
        instance = t
      }}
    />,
    {
      wrapper: withNuqsTestingAdapter({
        searchParams,
        onUrlUpdate,
        hasMemory: true,
      }),
    },
  )
  const lastParams = () =>
    onUrlUpdate.mock.lastCall?.[0].searchParams ?? new URLSearchParams()
  return { table: () => instance as TableInstance, onUrlUpdate, lastParams }
}

describe('useDataTableUrlState wired to DataTable', () => {
  it('hydrates sorting, filters and pagination from the URL', () => {
    const { table } = renderWithUrl(
      '?page=3&sort=name.desc&status=draft,published&qty_min=10&created_from=2026-01-01T00:00:00.000Z',
    )
    expect(table().getColumn('name')?.getIsSorted()).toBe('desc')
    expect(table().getColumn('status')?.getFilterValue()).toEqual([
      'draft',
      'published',
    ])
    expect(table().getColumn('qty')?.getFilterValue()).toEqual([10, undefined])
    expect(table().getColumn('created_at')?.getFilterValue()).toEqual([
      '2026-01-01T00:00:00.000Z',
      undefined,
    ])
    expect(table().getCanPreviousPage()).toBe(true)
    expect(table().getPageCount()).toBe(10)
  })

  it('writes page navigation to a 1-indexed page param', async () => {
    const { table, lastParams } = renderWithUrl('?page=3')
    act(() => table().nextPage())
    await waitFor(() => expect(lastParams().get('page')).toBe('4'))

    act(() => table().firstPage())
    await waitFor(() => expect(lastParams().has('page')).toBe(false))

    act(() => table().setPageSize(20))
    await waitFor(() => expect(lastParams().get('pageSize')).toBe('20'))
  })

  it('writes sorting and resets the page when it changes', async () => {
    const { table, lastParams } = renderWithUrl('?page=3')
    act(() => table().getColumn('qty')?.toggleSorting(true))
    await waitFor(() => expect(lastParams().get('sort')).toBe('qty.desc'))
    expect(lastParams().has('page')).toBe(false)
  })

  it('writes faceted, number and date filters and resets the page', async () => {
    const { table, lastParams } = renderWithUrl('?page=2')
    act(() => table().getColumn('status')?.setFilterValue(['published']))
    await waitFor(() => expect(lastParams().get('status')).toBe('published'))
    expect(lastParams().has('page')).toBe(false)

    act(() => table().getColumn('qty')?.setFilterValue([undefined, 7]))
    await waitFor(() => expect(lastParams().get('qty_max')).toBe('7'))

    act(() =>
      table()
        .getColumn('created_at')
        ?.setFilterValue([
          '2026-02-01T00:00:00.000Z',
          '2026-02-28T00:00:00.000Z',
        ]),
    )
    await waitFor(() =>
      expect(lastParams().get('created_to')).toBe('2026-02-28T00:00:00.000Z'),
    )
    expect(lastParams().get('created_from')).toBe('2026-02-01T00:00:00.000Z')
    expect(lastParams().get('status')).toBe('published')

    act(() => table().resetColumnFilters(true))
    await waitFor(() => expect(lastParams().has('status')).toBe(false))
    expect(lastParams().has('created_from')).toBe(false)
  })
})
