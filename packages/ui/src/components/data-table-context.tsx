'use client'

import type { RowData } from '@tanstack/react-table'
import { createContext, useContext, useMemo, useRef } from 'react'

import type { Table } from './data-table-types'

// Holds the <DataTable>'s `Table<TData>`; TanStack Table 9 types are invariant in
// TData, so the row type is erased here and restored by useDataTable<TData>().
const DataTableContext = createContext<unknown>(null)

const useDataTable = <TData extends RowData = RowData>(): Table<TData> => {
  const context = useContext(DataTableContext)
  if (!context) {
    throw new Error('useDataTable must be used within a <DataTable> component')
  }
  // Unchecked: TData must be the row type of the enclosing <DataTable>.
  return context as Table<TData>
}

/**
 * Resolve a TanStack column by ID, or create a virtual column proxy
 * that reads/writes columnFilters state on the table directly.
 * Used by filter components to support the `columnId` prop.
 *
 * When `columnId` is `undefined`, returns `null` so the caller can
 * fall back to a directly-provided `column` prop.
 */
const useResolveColumn = <TData extends RowData = RowData>(
  columnId: string | undefined,
) => {
  const table = useDataTable<TData>()
  // Use getAllColumns().find rather than table.getColumn(id): the latter logs a
  // console.error when the id isn't a real table column. Filter-only columns
  // (server-driven filters with no rendered column) are a supported case here,
  // so we look them up silently and fall through to the virtual proxy below.
  const realColumn = columnId
    ? table.getAllColumns().find(c => c.id === columnId)
    : undefined
  // useTable hands out a new table object every render; the proxy reads the
  // latest one through a ref so it stays referentially stable.
  const tableRef = useRef(table)
  tableRef.current = table

  return useMemo(() => {
    // No columnId provided — caller will use its own column prop
    if (!columnId) return null
    // Real column exists on the table — use it directly
    if (realColumn) return realColumn

    // Build a virtual proxy with the subset of Column methods filters use
    return {
      id: columnId,
      columnDef: { meta: undefined },
      getFilterValue: () => {
        return tableRef.current.atoms.columnFilters
          .get()
          .find(f => f.id === columnId)?.value
      },
      setFilterValue: (value: unknown) => {
        tableRef.current.setColumnFilters(prev => {
          const next = prev.filter(f => f.id !== columnId)
          if (value !== undefined && value !== null) {
            next.push({ id: columnId, value })
          }
          return next
        })
      },
      getIsFiltered: () => {
        return tableRef.current.atoms.columnFilters
          .get()
          .some(f => f.id === columnId)
      },
      getFacetedUniqueValues: () => new Map<string, number>(),
    }
  }, [columnId, realColumn])
}

export { DataTableContext, useDataTable, useResolveColumn }
