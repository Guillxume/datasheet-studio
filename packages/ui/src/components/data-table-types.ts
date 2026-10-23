import type {
  ColumnDef as BaseColumnDef,
  Column as BaseColumn,
  Row as BaseRow,
  CellData,
  ReactTable,
  RowData,
} from '@tanstack/react-table'
import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from '@tanstack/react-table'
import type * as React from 'react'

type DataTableColumnMeta = {
  /** Human-readable label for this column (used in view options, exports, etc.). */
  label?: string
  reorderable?: boolean
  pinnable?: boolean
  filterable?: 'faceted' | 'number' | 'date' | 'switch'
  renderFilterValue?: (value: unknown) => React.ReactNode
}

/**
 * The TanStack Table features every `<DataTable>` registers (v9 only exposes the
 * APIs of registered features). The full built-in filter / sort registries keep
 * v8's `'auto'` resolution for client-side tables; `columnMeta` types
 * `column.columnDef.meta` as {@link DataTableColumnMeta}.
 */
const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnFacetingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filterFns,
  sortFns,
  columnMeta: metaHelper<DataTableColumnMeta>(),
})

type DataTableFeatures = typeof dataTableFeatures

/** The `<DataTable>` instance (TanStack `useTable` result) handed to slots and context consumers. */
type Table<TData extends RowData> = ReactTable<DataTableFeatures, TData>
type Row<TData extends RowData> = BaseRow<DataTableFeatures, TData>
type Column<
  TData extends RowData,
  TValue extends CellData = CellData,
> = BaseColumn<DataTableFeatures, TData, TValue>

type FilterValueMap = {
  faceted: string[]
  number: [number | undefined, number | undefined]
  date: [string | undefined, string | undefined]
  switch: boolean
}

// Single centralized assertion for column filter values
const getTypedFilterValue = <T extends keyof FilterValueMap>(
  column: { getFilterValue: () => unknown },
  _type: T,
): FilterValueMap[T] | undefined =>
  column.getFilterValue() as FilterValueMap[T] | undefined

type WithStrictHeader<C> = C extends { header?: infer H }
  ? Omit<C, 'header' | 'meta'> & {
      header?: Exclude<H, string>
      meta?: DataTableColumnMeta
    }
  : C & { meta?: DataTableColumnMeta }

type ColumnDef<TData extends RowData, TValue = unknown> = WithStrictHeader<
  BaseColumnDef<DataTableFeatures, TData, TValue>
>

type DataTableLabels = {
  selectRow?: string
  dragHint?: string
}

export { dataTableFeatures, getTypedFilterValue }
export type {
  Column,
  ColumnDef,
  DataTableColumnMeta,
  DataTableFeatures,
  DataTableLabels,
  FilterValueMap,
  Row,
  Table,
}
