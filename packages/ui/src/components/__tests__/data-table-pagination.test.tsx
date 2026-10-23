// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { type ColumnDef, DataTable } from '../data-table'
import { DataTablePagination } from '../data-table-pagination'

// jsdom lacks it; the table measures its container on mount.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type Row = { name: string }

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: () => 'Name' },
]
const data: Row[] = Array.from({ length: 42 }, (_, i) => ({
  name: `Row ${i + 1}`,
}))

const renderTable = (pageSizeOptions?: number[]) =>
  render(
    <DataTable
      columns={columns}
      data={data}
      footer={() => <DataTablePagination pageSizeOptions={pageSizeOptions} />}
    />,
  )

describe('DataTablePagination', () => {
  it('shows the current page size when the options do not include it', () => {
    renderTable()

    // TanStack starts at 10 rows, which is not among the default options.
    expect(screen.getByRole('combobox')).toHaveTextContent('10')
    expect(screen.getByText('1-10')).toBeInTheDocument()
  })

  it('keeps the options as given when they include the current size', () => {
    renderTable([10, 20])

    expect(screen.getByRole('combobox')).toHaveTextContent('10')
  })
})
