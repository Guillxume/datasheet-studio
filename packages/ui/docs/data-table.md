# Data Table

Full-featured table built on [TanStack Table](https://tanstack.com/table) v9 (`@tanstack/react-table` ^9, a peer dependency) with sorting, filtering, row selection, pagination, column visibility, column reordering, column pinning, and export.

## Import

```tsx
// Core
import { type ColumnDef, type Row, DataTable } from '@guillxume/ui/components/data-table'
import { DataTableColumnHeader } from '@guillxume/ui/components/data-table-column-header'
import { DataTablePagination } from '@guillxume/ui/components/data-table-pagination'
import { DataTableViewOptions } from '@guillxume/ui/components/data-table-view-options'
import { DataTableSearch } from '@guillxume/ui/components/data-table-search'
import { DataTableDisplayModeToggle } from '@guillxume/ui/components/data-table-display-mode-toggle'
import { DataTableFilterPresets } from '@guillxume/ui/components/data-table-filter-presets'

// Filters
import { DataTableFacetedFilter } from '@guillxume/ui/components/data-table-faceted-filter'
import { DataTableNumberFilter } from '@guillxume/ui/components/data-table-number-filter'
import { DataTableDateFilter } from '@guillxume/ui/components/data-table-date-filter'
import { DataTableSwitchFilter } from '@guillxume/ui/components/data-table-switch-filter'

// Actions & export
import { DataTableRowActions } from '@guillxume/ui/components/data-table-row-actions'
import { DataTableBulkActions } from '@guillxume/ui/components/data-table-bulk-actions'
import { DataTableExport, exportRows } from '@guillxume/ui/components/data-table-export'

// Hooks
import { useDataTableLayoutState } from '@guillxume/ui/hooks/use-data-table-layout-state'
import { useDataTableUrlState } from '@guillxume/ui/hooks/use-data-table-url-state'
import { useUrlFilterBoolean } from '@guillxume/ui/hooks/use-url-filter-boolean'
```

### Type exports

`@guillxume/ui/components/data-table` exports, so consumers rarely need to import from `@tanstack/react-table` themselves:

- `ColumnDef`, `DataTableProps`, `DataTableColumnMeta`, `DataTableLabels`, `FilterValueMap`.
- `Table<TData>`, `Row<TData>` and `Column<TData, TValue>`: the TanStack Table 9 instance types bound to the feature set every `<DataTable>` registers (`DataTableFeatures`). Use these, not TanStack's own `Table` / `Row` / `Column`, which in v9 take the feature set as an extra first type parameter.
- `DataTableFeatures`: that feature set's type (filtering, faceting, ordering, pinning, sizing, visibility, pagination, row selection, sorting).
- Common TanStack state types: `ColumnFiltersState`, `ColumnOrderState`, `ColumnPinningState` (`{ start: string[]; end: string[] }`), `ColumnVisibilityState` (and its v8 name `VisibilityState`, kept as an alias), `OnChangeFn`, `PaginationState`, `SortingState`.

Each component and hook also exports its own prop/option types:

```tsx
// Component prop types
import type { DataTableProps, DataTableColumnMeta } from '@guillxume/ui/components/data-table'
import type { DataTableSearchProps, DataTableSearchLabels, SearchableColumn } from '@guillxume/ui/components/data-table-search'
import type { DataTableFacetedFilterProps, DataTableFacetedFilterLabels, FilterOption } from '@guillxume/ui/components/data-table-faceted-filter'
import type { DataTableNumberFilterProps, DataTableNumberFilterLabels, NumberRange } from '@guillxume/ui/components/data-table-number-filter'
import type { DataTableDateFilterProps, DataTableDateFilterLabels } from '@guillxume/ui/components/data-table-date-filter'
import type { DataTableSwitchFilterProps } from '@guillxume/ui/components/data-table-switch-filter'
import type { DataTableFilterPresetsProps, DataTableFilterPresetsLabels } from '@guillxume/ui/components/data-table-filter-presets'
import type { DataTableColumnHeaderProps, DataTableColumnHeaderLabels } from '@guillxume/ui/components/data-table-column-header'
import type { DataTableRowActionsProps, RowAction } from '@guillxume/ui/components/data-table-row-actions'
import type { DataTableBulkActionsProps, DataTableBulkActionsLabels, BulkAction } from '@guillxume/ui/components/data-table-bulk-actions'
import type { DataTableExportProps, DataTableExportLabels, ExportColumn, ExportFormat, ExportRowsOptions } from '@guillxume/ui/components/data-table-export'
import type { DataTableViewOptionsProps, DataTableViewOptionsLabels } from '@guillxume/ui/components/data-table-view-options'
import type { DataTablePaginationProps, DataTablePaginationLabels } from '@guillxume/ui/components/data-table-pagination'

// Hook types
import type { UseDataTableLayoutStateOptions, UseDataTableLayoutStateReturn } from '@guillxume/ui/hooks/use-data-table-layout-state'
import type { UseDataTableUrlStateOptions, UseDataTableUrlStateReturn, FilterParamConfig, FilterParamType, DataTableFilterPreset } from '@guillxume/ui/hooks/use-data-table-url-state'
import type { UseUrlFilterBooleanOptions } from '@guillxume/ui/hooks/use-url-filter-boolean'
```

## Context

`DataTable` provides the table instance via React Context. All sub-components (`DataTablePagination`, `DataTableViewOptions`, `DataTableSearch`, `DataTableExport`, `DataTableBulkActions`, `DataTableColumnHeader`) automatically read the table instance from context — no need to pass `table` as a prop.

For custom components that need the table instance, use the `useDataTable` hook:

```tsx
import { useDataTable } from '@guillxume/ui/components/data-table'

const MyCustomToolbar = () => {
  const table = useDataTable()
  return <span>{table.getRowCount()} rows</span>
}
```

## Components

### DataTable

The core wrapper. Manages sorting, filtering, column visibility, row selection, column reordering, and column pinning state internally.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `ColumnDef<TData, TValue>[]` | **required** | TanStack Table column definitions |
| `data` | `TData[]` | **required** | Array of row data |
| `toolbar` | `(table: Table<TData>) => ReactNode` | — | Toolbar above the table. Use `_` when you don't need the table instance. |
| `footer` | `(table: Table<TData>) => ReactNode` | — | Footer below the table (e.g. pagination) |
| `bulkActions` | `(table: Table<TData>) => ReactNode` | — | Bulk action bar (shown when rows selected) |
| `enableColumnReordering` | `boolean` | `false` | Enable drag-to-reorder columns |
| `initialColumnOrder` | `ColumnOrderState` | — | Initial column order (array of column IDs) |
| `onColumnOrderChange` | `(columnOrder: string[]) => void` | — | Callback when column order changes |
| `initialColumnVisibility` | `VisibilityState` | — | Initial column visibility state |
| `onColumnVisibilityChange` | `(visibility: VisibilityState) => void` | — | Callback when column visibility changes |
| `initialColumnPinning` | `Partial<ColumnPinningState>` | — | Initial column pinning (e.g. `{ start: ['id'] }`). A `select` column is always pinned to the start. |
| `onColumnPinningChange` | `(pinning: ColumnPinningState) => void` | — | Callback when column pinning changes |
| `fixedHeight` | `boolean \| string` | — | Lock table to a fixed height. `true` auto-computes, string for custom (e.g. `'400px'`) |
| `className` | `string` | — | Additional CSS classes on the root wrapper |
| `renderCard` | `(row: Row<TData>) => ReactNode` | — | Card renderer. When provided alongside `displayMode='card'`, swaps the table for a responsive card grid. |
| `calendarConfig` | `DataTableCalendarConfig<TData>` | — | Calendar config. When provided alongside `displayMode='calendar'`, renders a month grid view. Import type from `@guillxume/ui/components/data-table-calendar-view`. |
| `displayMode` | `DisplayMode` | `'table'` | Active display mode (`'table' \| 'card' \| 'calendar'`). Card mode requires `renderCard`, calendar mode requires `calendarConfig`. |
| `onDisplayModeChange` | `(mode: DisplayMode) => void` | — | Callback when display mode changes (auto-persisted by `useDataTableLayoutState`) |
| `loading` | `boolean` | — | When `true` and in card/calendar mode with no data, shows skeleton loading |
| `manualMode` | `boolean` | `false` | Enable server-side mode: disables client-side sorting, filtering, and pagination. When `true`, all props below are required. |
| `rowCount` | `number \| null` | — | Total server rows. Pass `null` while loading to prevent page index clamping. |
| `pagination` | `PaginationState` | — | Controlled pagination state (`{ pageIndex, pageSize }`) |
| `onPaginationChange` | `OnChangeFn<PaginationState>` | — | Called when pagination state changes |
| `sorting` | `SortingState` | — | Controlled sorting state |
| `onSortingChange` | `OnChangeFn<SortingState>` | — | Called when sorting state changes |
| `columnFilters` | `ColumnFiltersState` | — | Controlled column filters state |
| `onColumnFiltersChange` | `OnChangeFn<ColumnFiltersState>` | — | Called when column filters change |

### Column meta

Columns support a `meta` field for DataTable-specific features:

```tsx
meta: {
  reorderable?: boolean     // allow column to be reordered (default: true when reordering enabled)
  pinnable?: boolean        // allow column to be pinned (default: true)
  filterable?: 'faceted' | 'number' | 'date' | 'switch'  // enable inline filter in column header
  renderFilterValue?: (value: unknown) => ReactNode       // custom render for filter badge values
}
```

### DataTableColumnHeader

Sortable column header with click-to-sort and a dropdown menu for sort direction, column moving, pinning, hiding, and inline filtering.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `column` | `Column<TData, TValue>` | **required** | TanStack Table column instance |
| `title` | `string` | **required** | Display title for the column |
| `labels` | `DataTableColumnHeaderLabels` | — | Custom labels for i18n (keys: `columnOptions`, `columnOptionsFiltered`, `sortAscending`, `sortDescending`, `moveLeft`, `moveRight`, `unpinColumn`, `pinLeft`, `pinRight`, `hideColumn`, `filter`, `clearFilter`, `search`, `from`, `to`, `min`, `max`, `numberMinLabel`, `numberMaxLabel`, `only`) |
| `className` | `string` | — | Additional CSS classes |

### DataTablePagination

Pagination controls with page size selector, row range display, and navigation buttons.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pageSizeOptions` | `number[]` | `[15, 30, 50, 100]` | Available page size options. The current page size is always listed, so a table left on TanStack's default of 10 rows shows `10` in the select. |
| `labels` | `DataTablePaginationLabels` | — | Custom labels for i18n (keys: `rowsPerPage`, `of`, `page`, `goToFirstPage`, `goToPreviousPage`, `goToNextPage`, `goToLastPage`) |

### DataTableViewOptions

Dropdown menu for toggling column visibility with search and reset. Optionally integrates with `useDataTableLayoutState` to show save/clear layout actions in the same dropdown.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | — | Additional CSS classes |
| `layoutState` | `Pick<UseDataTableLayoutStateReturn, 'isDirty' \| 'hasSavedLayout' \| 'saveLayout' \| 'clearSavedLayout'>` | — | Layout persistence state from `useDataTableLayoutState`. When provided, adds "Save layout" and "Clear saved layout" items to the dropdown. |
| `labels` | `DataTableViewOptionsLabels` | — | Custom labels for i18n (keys: `view`, `toggleColumns`, `searchColumns`, `resetColumns`, `noColumns`, `saveLayout`, `clearSavedLayout`) |

### DataTableSearch

Searchable input with column selector dropdown. Filters a single column at a time. Supports both uncontrolled mode (manages its own state via `column.setFilterValue()`) and controlled mode (delegates state to the caller, e.g. URL state).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `{ id: string; label: string }[]` | **required** | Searchable columns |
| `placeholder` | `string` | — | Input placeholder |
| `labels` | `DataTableSearchLabels` | — | Custom labels for i18n (keys: `searchIn`) |
| `className` | `string` | — | Additional CSS classes |
| `value` | `string` | — | Controlled search value (from URL state) |
| `onValueChange` | `(value: string) => void` | — | Called with the debounced search value. Providing this enables controlled mode. |
| `activeColumn` | `string` | — | Controlled active column ID (from URL state) |
| `onActiveColumnChange` | `(columnId: string) => void` | — | Called when the user switches the search column |

### DataTableFacetedFilter

Multi-select faceted filter for enum-like columns. Automatically extracts unique values from the column data. Either `column` or `columnId` must be provided (discriminated union).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `column` | `Column<TData, TValue>` | — | TanStack Table column instance. Alternative to `columnId`. |
| `columnId` | `string` | — | Column ID resolved from DataTable context. Alternative to `column` prop. Works with both real columns and virtual/API-only filters. |
| `title` | `string` | **required** | Filter label |
| `options` | `FilterOption[]` | — | Custom options (auto-detected if omitted). `FilterOption` is `{ label: string; value: string; icon?: ReactNode; render?: ReactNode }`. When `render` is provided it replaces the default `icon + label` display. |
| `icon` | `ReactNode` | — | Icon displayed in the trigger button |
| `labels` | `DataTableFacetedFilterLabels` | — | Custom labels for i18n (keys: `noResults`, `clearFilters`, `selected`) |
| `className` | `string` | — | Additional CSS classes |
| `onFilterChange` | `(values: string[]) => void` | — | Callback when filter values change |

### DataTableNumberFilter

Range-based numeric filter with min/max inputs and 200ms debounce. Either `column` or `columnId` must be provided (discriminated union).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `column` | `Column<TData, TValue>` | — | TanStack Table column instance. Alternative to `columnId`. |
| `columnId` | `string` | — | Column ID resolved from DataTable context. Alternative to `column` prop. Works with both real columns and virtual/API-only filters. |
| `title` | `string` | **required** | Filter label |
| `icon` | `ReactNode` | — | Icon displayed in the trigger button |
| `labels` | `DataTableNumberFilterLabels` | — | Custom labels for i18n (keys: `from`, `to`, `min`, `max`, `clearFilter`) |
| `className` | `string` | — | Additional CSS classes |
| `onFilterChange` | `(range: NumberRange \| undefined) => void` | — | Callback when range changes. `NumberRange` is `{ min?: number; max?: number }` |

### DataTableDateFilter

Datetime range picker filter with separate DatePicker and TimePicker (HH:mm) pairs for "From" and "To". The filter value is stored as a tuple of ISO 8601 strings (`[from, to]`). Default times are 00:00 (from) and 23:59 (to). Either `column` or `columnId` must be provided (discriminated union).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `column` | `Column<TData, TValue>` | — | TanStack Table column instance. Alternative to `columnId`. |
| `columnId` | `string` | — | Column ID resolved from DataTable context. Alternative to `column` prop. Works with both real columns and virtual/API-only filters. |
| `title` | `string` | **required** | Filter label |
| `icon` | `ReactNode` | — | Icon displayed in the trigger button |
| `labels` | `DataTableDateFilterLabels` | — | Custom labels for i18n (keys: `from`, `to`, `clearFilter`) |
| `className` | `string` | — | Additional CSS classes |
| `formatStr` | `string` | `'LLL dd, y HH:mm'` | Date format string (date-fns) |
| `onFilterChange` | `(range: DateRange \| undefined) => void` | — | Callback when date range changes. `DateRange` is `{ from: Date \| undefined; to: Date \| undefined }` from `react-day-picker`. |

### DataTableSwitchFilter

Toggle button for boolean column filtering. Works with both real column definitions and virtual/API-only filters. Either `column` or `columnId` must be provided (discriminated union).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `column` | `Column<TData, TValue>` | — | TanStack Table column instance. Alternative to `columnId`. |
| `columnId` | `string` | — | Column ID resolved from DataTable context. Alternative to `column` prop. Works with both real columns and virtual/API-only filters. |
| `label` | `string` | **required** | Filter label |
| `icon` | `ReactNode` | — | Icon displayed in the button |
| `className` | `string` | — | Additional CSS classes |
| `onFilterChange` | `(active: boolean) => void` | — | Callback when toggle changes |

### DataTableFilterPresets

Dropdown button for applying predefined filter combinations. Presets replace all active filters and hide the filter bar when active. See [dedicated docs](./data-table-filter-presets.md) for full details.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `presets` | `DataTableFilterPreset[]` | **required** | Available preset definitions. Renders nothing when empty. |
| `activePreset` | `string \| null` | **required** | ID of the currently active preset (from `urlState.preset`) |
| `onPresetChange` | `(presetId: string \| null) => void` | **required** | Callback to apply or clear a preset (from `urlState.onPresetChange`) |
| `labels` | `{ trigger?: string; clear?: string }` | — | Custom labels for the dropdown trigger and clear button aria-label (i18n) |

### DataTableRowActions

Per-row action dropdown menu.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `row` | `Row<TData>` | **required** | TanStack Table row instance |
| `actions` | `RowAction<TData>[]` | **required** | Action definitions |
| `quickActions` | `ReactNode` | — | Quick action buttons displayed inline before the dropdown |
| `className` | `string` | — | Additional CSS classes |

**RowAction shape:**

```tsx
{
  label: string
  icon?: ReactNode
  onClick: (row: Row<TData>) => void
  color?: 'default' | 'destructive'
  separator?: boolean  // add a separator before this action
}
```

### DataTableBulkActions

Floating action bar shown when rows are selected.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `actions` | `BulkAction<TData>[]` | **required** | Action definitions |
| `labels` | `DataTableBulkActionsLabels` | — | Custom labels for i18n (keys: `selectAll`, `selected`, `deselect`) |
| `className` | `string` | — | Additional CSS classes |

**BulkAction shape:**

```tsx
{
  label: string
  icon?: ReactNode
  onClick: (rows: Row<TData>[]) => void
  color?: 'default' | 'destructive'
}
```

### DataTableExport

Export button for downloading filtered table data as CSV or JSON.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `ExportColumn[]` | — | Columns to export (defaults to all with accessors). `ExportColumn` is `{ id: string; header: string }` |
| `filename` | `string` | — | Base filename (auto-timestamped) |
| `formats` | `('csv' \| 'json')[]` | `['csv', 'json']` | Available export formats |
| `onExport` | `(format: ExportFormat, rowCount: number) => void` | — | Callback after export with format and number of rows exported |
| `labels` | `DataTableExportLabels` | — | Custom labels for i18n (keys: `export`, `exportCsv`, `exportJson`) |
| `className` | `string` | — | Additional CSS classes |

#### `exportRows` utility

Standalone function for exporting rows outside of the `DataTableExport` component (e.g. from bulk actions).

```tsx
import { exportRows } from '@guillxume/ui/components/data-table-export'

exportRows(table.getSelectedRowModel().rows, {
  columns: [{ id: 'id', header: 'ID' }, { id: 'status', header: 'Status' }],
  format: 'csv',
  filename: 'selected-orders',
})
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `columns` | `ExportColumn[]` | auto-detected | Columns to include in the export |
| `format` | `'csv' \| 'json'` | `'csv'` | Export format |
| `filename` | `string` | `'export-{timestamp}'` | Base filename (auto-timestamped) |
| `onExport` | `(format: ExportFormat, rowCount: number) => void` | — | Callback after export |

## Examples

### Basic

The simplest usage — just columns and data. Note: the `header` prop must be a function (plain strings are not allowed by the strict `ColumnDef` type).

```tsx
import type { ColumnDef } from '@guillxume/ui/components/data-table'
import { DataTable } from '@guillxume/ui/components/data-table'

type User = { name: string; email: string }

const columns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: () => 'Name' },
  { accessorKey: 'email', header: () => 'Email' },
]

<DataTable columns={columns} data={users} />
```

### With sorting and pagination

```tsx
import type { ColumnDef } from '@guillxume/ui/components/data-table'
import { DataTable } from '@guillxume/ui/components/data-table'
import { DataTableColumnHeader } from '@guillxume/ui/components/data-table-column-header'
import { DataTablePagination } from '@guillxume/ui/components/data-table-pagination'

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Order' />
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
  },
]

<DataTable
  columns={columns}
  data={orders}
  footer={_ => <DataTablePagination />}
/>
```

### With row selection

```tsx
import { Checkbox } from '@guillxume/ui/components/checkbox'

const selectColumn: ColumnDef<Order> = {
  id: 'select',
  size: 40,
  header: ({ table }) => (
    <Checkbox
      checked={
        table.getIsAllPageRowsSelected() ||
        (table.getIsSomePageRowsSelected() && 'indeterminate')
      }
      onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
      aria-label='Select all'
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={value => row.toggleSelected(!!value)}
      aria-label='Select row'
    />
  ),
  enableSorting: false,
  enableHiding: false,
}
```

### With faceted filter

```tsx
import { DataTableFacetedFilter } from '@guillxume/ui/components/data-table-faceted-filter'

// 1. Set meta.filterable on the column
const statusColumn: ColumnDef<Order> = {
  accessorKey: 'status',
  meta: { filterable: 'faceted' },
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title='Status' />
  ),
  filterFn: (row, id, values: string[]) => values.includes(row.getValue(id)),
}

// 2. Add the filter in the toolbar
<DataTable
  columns={columns}
  data={orders}
  toolbar={() => (
    <>
      {/* Preferred: context-resolved */}
      <DataTableFacetedFilter columnId="status" title='Status' />

      {/* Also works: direct column ref */}
      {/* <DataTableFacetedFilter column={table.getColumn('status')!} title='Status' /> */}
    </>
  )}
/>
```

### With row actions

```tsx
import { DataTableRowActions } from '@guillxume/ui/components/data-table-row-actions'

const actionsColumn: ColumnDef<Order> = {
  id: 'actions',
  size: 40,
  cell: ({ row }) => (
    <DataTableRowActions
      row={row}
      actions={[
        { label: 'View', onClick: r => console.log(r.original.id) },
        { label: 'Delete', onClick: r => {}, color: 'destructive', separator: true },
      ]}
    />
  ),
  enableSorting: false,
  enableHiding: false,
}
```

### With quick actions

Display inline quick-action buttons next to the dropdown menu:

```tsx
import { PencilIcon } from 'lucide-react'
import { Button } from '@guillxume/ui/components/button'

const actionsColumn: ColumnDef<Order> = {
  id: 'actions',
  size: 80,
  cell: ({ row }) => (
    <DataTableRowActions
      row={row}
      quickActions={
        <Button
          variant='ghost'
          size='icon'
          className='size-8 opacity-0 group-hover/row:opacity-100'
          onClick={() => console.log('edit', row.original.id)}>
          <PencilIcon />
        </Button>
      }
      actions={[
        { label: 'View', onClick: r => console.log(r.original.id) },
        { label: 'Delete', onClick: r => {}, color: 'destructive', separator: true },
      ]}
    />
  ),
  enableSorting: false,
  enableHiding: false,
}
```

### With column pinning and reordering

```tsx
<DataTable
  columns={columns}
  data={orders}
  enableColumnReordering
  initialColumnPinning={{ start: ['id'] }}
/>
```

### With export

```tsx
import { DataTableExport } from '@guillxume/ui/components/data-table-export'

<DataTable
  columns={columns}
  data={orders}
  toolbar={_ => <DataTableExport filename='orders' />}
/>
```

### With fixed height

Auto-compute height based on page size:

```tsx
<DataTable columns={columns} data={orders} fixedHeight />
```

When `fixedHeight={true}`, the height is calculated as `HEADER_HEIGHT + BORDER_HEIGHT + pageSize × ROW_HEIGHT` using the constants defined at the top of the component (`HEADER_HEIGHT = 40`, `ROW_HEIGHT = 49`, `BORDER_HEIGHT = 2`).

Or provide a custom height:

```tsx
<DataTable columns={columns} data={orders} fixedHeight='400px' />
```

### With server-side pagination, sorting and filtering

Set `manualMode` to delegate pagination, sorting, and filtering to the API. Pass `rowCount={null}` while loading to prevent the table from clamping the page index to 0.

```tsx
import {
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  DataTable,
} from '@guillxume/ui/components/data-table'

const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 30 })
const [sorting, setSorting] = useState<SortingState>([])
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
const [rowCount, setRowCount] = useState<number | null>(null)

// Fetch data from API using the state above
const { data } = useQuery(...)

<DataTable
  manualMode
  columns={columns}
  data={data}
  rowCount={rowCount}
  pagination={pagination}
  onPaginationChange={setPagination}
  sorting={sorting}
  onSortingChange={setSorting}
  columnFilters={columnFilters}
  onColumnFiltersChange={setColumnFilters}
  footer={_ => <DataTablePagination />}
/>
```

### With layout persistence (`useDataTableLayoutState`)

Persist column visibility, pinning, and order to `localStorage` so layouts survive page reloads. The hook returns props you spread onto `<DataTable>` plus state for the `DataTableViewOptions` save/clear UI.

```tsx
import { useDataTableLayoutState } from '@guillxume/ui/hooks/use-data-table-layout-state'

const layoutState = useDataTableLayoutState({
  tableId: 'orders-table',
  defaultColumnVisibility: { newCustomer: false },
  defaultColumnPinning: { start: ['id'] },
})

<DataTable
  key={layoutState.resetKey}
  columns={columns}
  data={orders}
  enableColumnReordering
  initialColumnVisibility={layoutState.initialColumnVisibility}
  onColumnVisibilityChange={layoutState.onColumnVisibilityChange}
  initialColumnPinning={layoutState.initialColumnPinning}
  onColumnPinningChange={layoutState.onColumnPinningChange}
  initialColumnOrder={layoutState.initialColumnOrder}
  onColumnOrderChange={layoutState.onColumnOrderChange}
  toolbar={_ => <DataTableViewOptions layoutState={layoutState} />}
  footer={_ => <DataTablePagination />}
/>
```

#### Hook options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tableId` | `string` | **required** | Unique identifier per table — each table stores its own layout under the `tables` record of the `SettingsProvider` storage key |
| `defaultColumnVisibility` | `VisibilityState` | `{}` | Default column visibility when no saved layout exists |
| `defaultColumnPinning` | `Partial<ColumnPinningState>` | `{}` | Default column pinning when no saved layout exists (`{ start?: string[]; end?: string[] }`) |
| `defaultColumnOrder` | `ColumnOrderState` | `[]` | Default column order when no saved layout exists |
| `defaultDisplayMode` | `DisplayMode` | `'table'` | Default display mode when no saved layout exists (`'table' \| 'card' \| 'calendar'`) |

#### Return value

| Property | Type | Description |
|----------|------|-------------|
| `initialColumnVisibility` | `VisibilityState` | Saved or default visibility — spread onto `<DataTable>` |
| `onColumnVisibilityChange` | `(visibility: VisibilityState) => void` | Tracks changes — spread onto `<DataTable>` |
| `initialColumnPinning` | `Partial<ColumnPinningState>` | Saved or default pinning — spread onto `<DataTable>`. Layouts saved before TanStack Table 9 (`left` / `right`) are read as `start` / `end`. |
| `onColumnPinningChange` | `(pinning: ColumnPinningState) => void` | Tracks changes — spread onto `<DataTable>` |
| `initialColumnOrder` | `ColumnOrderState` | Saved or default order — spread onto `<DataTable>` |
| `onColumnOrderChange` | `(columnOrder: string[]) => void` | Tracks changes — spread onto `<DataTable>` |
| `isDirty` | `boolean` | Whether the current layout differs from the last saved one |
| `hasSavedLayout` | `boolean` | Whether a saved layout exists in localStorage |
| `saveLayout` | `() => void` | Persist the current layout to localStorage |
| `clearSavedLayout` | `() => void` | Remove saved layout and reset to defaults |
| `displayMode` | `DisplayMode` | Current display mode (saved or default) |
| `onDisplayModeChange` | `(mode: DisplayMode) => void` | Switch display mode — auto-saves to localStorage immediately |
| `resetKey` | `number` | Changes on clear — pass as `<DataTable key={resetKey}>` so the table remounts with defaults |

Pass `{ isDirty, hasSavedLayout, saveLayout, clearSavedLayout, displayMode }` to `<DataTableViewOptions layoutState={...}>` to add save/clear layout actions in the column visibility dropdown. The `displayMode` is used to hide column controls when in card mode.

### With card view (`renderCard`)

Swap the table for a responsive card grid by providing a `renderCard` prop. The card grid uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.

```tsx
import { type Row, DataTable } from '@guillxume/ui/components/data-table'
import { DataTableDisplayModeToggle } from '@guillxume/ui/components/data-table-display-mode-toggle'

const MyCard = ({ order }: { order: Order }) => (
  <Card className="h-full">
    <CardHeader>
      <CardTitle>{order.name}</CardTitle>
    </CardHeader>
    <CardContent>
      <p>{order.description}</p>
    </CardContent>
  </Card>
)

<DataTable
  key={layoutState.resetKey}
  columns={columns}
  data={orders}
  renderCard={(row: Row<Order>) => <MyCard order={row.original} />}
  displayMode={layoutState.displayMode}
  onDisplayModeChange={layoutState.onDisplayModeChange}
  toolbar={_ => (
    <div className="flex items-center gap-2">
      <DataTableDisplayModeToggle
        displayMode={layoutState.displayMode}
        onDisplayModeChange={layoutState.onDisplayModeChange}
      />
      <DataTableViewOptions layoutState={layoutState} />
    </div>
  )}
  footer={_ => <DataTablePagination />}
/>
```

**Card view features:**
- Pagination, sorting, and filtering still work — the card grid uses the same TanStack Table instance.
- Row selection works via a checkbox overlay that appears on hover (top-right corner).
- Column visibility controls are hidden in card mode since they're not relevant.
- `fixedHeight` is disabled in card mode — the grid grows naturally.
- The `noResultsMessage` is shown centered across all columns when there are no results.

**Display mode persistence:**
- `displayMode` is auto-saved to `localStorage` immediately when changed (not part of the dirty/save/clear cycle).
- Use `defaultDisplayMode` in `useDataTableLayoutState` to set the initial mode when no saved preference exists.

### With calendar view (`calendarConfig`)

Swap the table for a month grid calendar by providing a `calendarConfig` prop. On desktop, day cells show up to 3 inline events with an overflow popover. On mobile, a count badge opens a bottom drawer with event cards.

```tsx
import { type Row, DataTable } from '@guillxume/ui/components/data-table'
import type { DataTableCalendarConfig } from '@guillxume/ui/components/data-table-calendar-view'
import { DataTableDisplayModeToggle } from '@guillxume/ui/components/data-table-display-mode-toggle'

const calendarConfig: DataTableCalendarConfig<Order> = {
  dateFields: [
    { id: 'orderDate', label: 'Order Date' },
    { id: 'shipDate', label: 'Ship Date' },
  ],
  dateAccessor: (order, fieldId) => {
    const value = order[fieldId as keyof Order]
    return value instanceof Date ? value : null
  },
  renderEvent: row => <OrderInlineEvent order={row.original} />,
  renderEventDetail: row => <OrderEventCard order={row.original} />,
  onMonthChange: (start, end, fieldId) => {
    // Sync server-side date filter with the calendar's visible month
  },
}

<DataTable
  key={layoutState.resetKey}
  columns={columns}
  data={orders}
  renderCard={row => <OrderCard order={row.original} />}
  calendarConfig={calendarConfig}
  {...layoutState}
  toolbar={_ => (
    <DataTableDisplayModeToggle
      displayMode={layoutState.displayMode}
      onDisplayModeChange={layoutState.onDisplayModeChange}
      showCalendar
    />
  )}
  footer={_ => <DataTablePagination />}
/>
```

**Calendar view features:**
- Groups rows by a user-selected date field via a dropdown in the calendar header.
- **Month/year dropdowns** in the header for quick navigation, plus prev/next arrows and "Today" jump.
- **`onMonthChange` callback** fires when the displayed month or selected date field changes — use this to auto-sync server-side date filters with the visible range (see [calendar view docs](./data-table-calendar-view.md#server-side-integration)).
- **Truncation alert**: When `totalItems` (passed via `rowCount`) exceeds displayed rows, a warning alert appears above the calendar.
- On desktop, day cells show up to 3 inline events via `renderEvent` with a "+N more" overflow popover using `renderEventDetail` (falls back to `renderEvent`). On mobile, a count badge opens a bottom drawer with event cards.
- Outside-month days with events remain interactive (with muted styling).
- Pagination, sorting, and filtering still work — the calendar uses the same TanStack Table instance. For server-side mode, consider hiding `DataTablePagination` and overriding page size to maximize items.
- Column visibility controls are hidden in calendar mode.
- `fixedHeight` is disabled in calendar mode.
- Pass `showCalendar` to `DataTableDisplayModeToggle` to show the calendar toggle button.

### With URL state sync (`useDataTableUrlState`)

Sync table state (pagination, sorting, filters) to URL search params so that filtered views are shareable, bookmarkable, and survive page reloads. Browser back/forward works as expected.

`nuqs` is a peer dependency of `@guillxume/ui` — install it in your app:

```bash
pnpm add nuqs
```

#### Setup

Wrap your app with `<NuqsAdapter>` in the root layout:

```tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export default function RootLayout({ children }) {
  return <NuqsAdapter>{children}</NuqsAdapter>
}
```

#### Usage

```tsx
import { useDataTableUrlState } from '@guillxume/ui/hooks/use-data-table-url-state'

const urlState = useDataTableUrlState({
  filters: {
    status: { type: 'faceted' },
    amount: { type: 'number' },
    date: { type: 'date' },
    newCustomer: { type: 'switch' },
  },
  defaultPageSize: 30,
})

<DataTable
  manualMode
  columns={columns}
  data={data}
  rowCount={rowCount}  // null while loading, number once fetched
  {...urlState}
  toolbar={table => (
    <DataTableSearch
      columns={[
        { id: 'id', label: 'Order' },
        { id: 'supplier', label: 'Supplier' },
      ]}
      value={urlState.search}
      onValueChange={urlState.onSearchChange}
      activeColumn={urlState.searchColumn}
      onActiveColumnChange={urlState.onSearchColumnChange}
    />
  )}
  footer={_ => <DataTablePagination />}
/>
```

#### Hook options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filters` | `FilterParamConfig` | `{}` | Map of column IDs to their filter type (`faceted`, `number`, `date`, `switch`) |
| `defaultPageSize` | `number` | `30` | Default page size (omitted from URL when matching) |
| `defaultSorting` | `SortingState` | `[]` | Default sorting when no `sort` param is in the URL |
| `defaultSearchColumn` | `string` | `''` | Default search column ID when no `qc` param is in the URL |
| `historyMode` | `'push' \| 'replace'` | `'replace'` | Whether URL changes push to browser history or replace |
| `defaultDisplayMode` | `string` | `'table'` | Default display mode when no `display` param is in the URL |
| `presets` | `DataTableFilterPreset[]` | `[]` | Predefined filter presets. When a preset is active, its filters replace all manual filters. |

#### Return value

| Property | Type | Description |
|----------|------|-------------|
| `pagination` | `PaginationState` | Current pagination state — spread onto `<DataTable>` |
| `onPaginationChange` | `OnChangeFn<PaginationState>` | Pagination handler — spread onto `<DataTable>` |
| `sorting` | `SortingState` | Current sorting state — spread onto `<DataTable>` |
| `onSortingChange` | `OnChangeFn<SortingState>` | Sorting handler — spread onto `<DataTable>` |
| `columnFilters` | `ColumnFiltersState` | Current column filters — spread onto `<DataTable>` |
| `onColumnFiltersChange` | `OnChangeFn<ColumnFiltersState>` | Filters handler — spread onto `<DataTable>` |
| `search` | `string` | Current search query (from `?q=`) |
| `searchColumn` | `string` | Current search column ID (from `?qc=`, falls back to `defaultSearchColumn`) |
| `onSearchChange` | `(value: string) => void` | Update the search query. Resets page to 1. Pass to `<DataTableSearch onValueChange>`. |
| `onSearchColumnChange` | `(columnId: string) => void` | Update the search column. Resets page to 1. Pass to `<DataTableSearch onActiveColumnChange>`. |
| `displayMode` | `DisplayMode` | Current display mode (from `?display=`, falls back to `defaultDisplayMode`) |
| `onDisplayModeChange` | `(mode: DisplayMode) => void` | Update the display mode |
| `preset` | `string \| null` | ID of the active preset (from `?preset=`), or `null` |
| `onPresetChange` | `(presetId: string \| null) => void` | Apply or clear a preset. Clears all filters and search, applies preset filters. |

### With boolean filter toggle

For boolean toggle filters, use `DataTableSwitchFilter` with either `column` (for real columns) or `columnId` (for virtual/API-only filters). The `columnId` pattern replaces the old `DataTableVirtualSwitchFilter` component.

```tsx
import { DataTableSwitchFilter } from '@guillxume/ui/components/data-table-switch-filter'

// For real columns:
<DataTableSwitchFilter column={table.getColumn('isActive')!} label="Active only" />

// For API-only boolean filters (no column definition), use columnId:
<DataTableSwitchFilter columnId="is_dispatch_late" label="Late dispatches" />
```

Both require `{ type: 'switch' }` in the URL state filter config so nuqs serializes the value as `?field=true`.

For lower-level control, the `useUrlFilterBoolean` hook is also available. It derives a boolean toggle from URL-synced column filters:

```tsx
import { useUrlFilterBoolean } from '@guillxume/ui/hooks/use-url-filter-boolean'
```

#### Usage

Pair with `useDataTableUrlState` — pass `columnFilters` and `onColumnFiltersChange` from the URL state hook:

```tsx
const urlState = useDataTableUrlState({
  filters: {
    is_dispatch_late: { type: 'switch' },
  },
})

const { isActive, toggle } = useUrlFilterBoolean({
  columnId: 'is_dispatch_late',
  columnFilters: urlState.columnFilters,
  onColumnFiltersChange: urlState.onColumnFiltersChange,
})

<Button variant='outline' size='sm' aria-pressed={isActive} onClick={toggle}>
  {isActive ? 'Showing late only' : 'Show late'}
</Button>
```

#### Hook options

| Option | Type | Description |
|--------|------|-------------|
| `columnId` | `string` | **required** — Column ID matching a `switch` entry in the URL state filter config |
| `columnFilters` | `ColumnFiltersState` | **required** — Current column filters (from `useDataTableUrlState`) |
| `onColumnFiltersChange` | `OnChangeFn<ColumnFiltersState>` | **required** — Column filters handler (from `useDataTableUrlState`) |

#### Return value

| Property | Type | Description |
|----------|------|-------------|
| `isActive` | `boolean` | Whether the filter is currently enabled |
| `toggle` | `() => void` | Toggle the filter on/off. Stable callback (safe for `onClick`). |

#### Filter config

Each filter entry maps a column ID to its type and an optional custom URL param name:

```tsx
type FilterParamConfig = Record<string, {
  type: 'faceted' | 'number' | 'date' | 'switch'
  paramName?: string // defaults to the column ID
}>
```

#### URL param format

| State | Param(s) | Example |
|-------|----------|---------|
| Page index | `page` | `?page=2` |
| Page size | `pageSize` | `?pageSize=25` |
| Sorting | `sort` | `?sort=amount.desc` or `?sort=amount.desc,date.asc` |
| Search query | `q` | `?q=ORD-001` |
| Search column | `qc` | `?qc=id` |
| Faceted | `{columnId}` | `?status=pending,shipped` |
| Number range | `{columnId}_min`, `{columnId}_max` | `?amount_min=10&amount_max=100` |
| Date range | `{columnId}_from`, `{columnId}_to` | `?date_from=2024-01-15T00%3A00%3A00.000Z&date_to=2024-12-31T23%3A59%3A00.000Z` |
| Switch | `{columnId}` | `?newCustomer=true` |
| Display mode | `display` | `?display=card` |
| Preset | `preset` | `?preset=late-dispatched` |

Default/empty values are omitted from the URL for clean URLs.

### With filter presets

Apply predefined filter combinations via a dropdown. Presets replace all filters, hide the filter bar, and are bookmarkable via `?preset=<id>`.

```tsx
import { DataTableFilterPresets } from '@guillxume/ui/components/data-table-filter-presets'
import type { DataTableFilterPreset } from '@guillxume/ui/hooks/use-data-table-url-state'
import { startOfMonth, endOfMonth } from 'date-fns'

const presets: DataTableFilterPreset[] = [
  {
    id: 'this-month',
    label: 'This month',
    filters: () => {
      const now = new Date()
      return [
        { id: 'date', value: [startOfMonth(now).toISOString(), endOfMonth(now).toISOString()] },
      ]
    },
  },
  {
    id: 'pending-only',
    label: 'Pending only',
    filters: () => [{ id: 'status', value: ['pending'] }],
  },
]

const urlState = useDataTableUrlState({
  filters: { status: { type: 'faceted' }, date: { type: 'date' } },
  presets,
})

// In the toolbar — left side, next to display mode toggle:
<DataTableFilterPresets
  presets={presets}
  activePreset={urlState.preset}
  onPresetChange={urlState.onPresetChange}
  labels={{ trigger: 'Quick filters' }}
/>

// Hide the filter bar when a preset is active:
{!urlState.preset && (
  <Card>
    <CardContent>{/* search + filters */}</CardContent>
  </Card>
)}
```

## Internationalization (i18n)

Every data table sub-component accepts an optional `labels` prop for overriding default English strings. Pass translated strings for your locale:

```tsx
<DataTable
  columns={columns}
  data={orders}
  toolbar={table => (
    <>
      <DataTableSearch
        columns={searchableColumns}
        labels={{ searchIn: 'Rechercher dans' }}
      />
      <DataTableFacetedFilter
        column={table.getColumn('status')!}
        title='Statut'
        labels={{ noResults: 'Aucun résultat.', clearFilters: 'Effacer', selected: 'sélectionnés' }}
      />
      <DataTableExport
        labels={{ export: 'Exporter', exportCsv: 'Exporter en CSV', exportJson: 'Exporter en JSON' }}
      />
    </>
  )}
  footer={_ => (
    <DataTablePagination
      labels={{ rowsPerPage: 'Lignes par page', of: 'sur', page: 'Page' }}
    />
  )}
/>
```

Column headers also support labels:

```tsx
{
  accessorKey: 'status',
  header: ({ column }) => (
    <DataTableColumnHeader
      column={column}
      title='Statut'
      labels={{
        sortAscending: 'Tri croissant',
        sortDescending: 'Tri décroissant',
        hideColumn: 'Masquer la colonne',
        filter: 'Filtrer',
        clearFilter: 'Effacer le filtre',
      }}
    />
  ),
}
```

## Migrating from TanStack Table 8

The DataTable runs on `@tanstack/react-table` 9 since the release that follows 0.2.0. What a consuming app has to change:

1. **Dependency.** Install `@tanstack/react-table@^9` (the peer dependency is now `^9.2.6`).
2. **Pinning keys.** Column pinning uses the logical sides `start` / `end` instead of `left` / `right`: `initialColumnPinning={{ start: ['id'] }}`, `defaultColumnPinning: { end: ['actions'] }`, `column.pin('start')`, `column.getIsPinned() === 'end'`, `table.getStartLeafColumns()`. `ColumnPinningState` requires both keys (`{ start: [], end: [] }`) where you build a full state by hand; the `initialColumnPinning` / `defaultColumnPinning` props accept a partial one.
3. **Saved layouts need nothing.** `SettingsProvider` reads layouts saved with `left` / `right` as `start` / `end` and writes the new keys on the next save, so users keep their pinned columns. Each table's layout is now parsed on its own: one malformed layout is dropped without wiping the others.
4. **Instance types.** Take `Table`, `Row` and `Column` from `@guillxume/ui/components/data-table` instead of `@tanstack/react-table` (v9's own types need the feature set as a first type parameter). `TData` must extend TanStack's `RowData` (any object type does).
5. **Table state.** `table.getState()` is gone in v9: read `table.state` during render (e.g. `table.state.pagination`), or `table.atoms.<slice>.get()` (e.g. `table.atoms.columnFilters.get()`) from callbacks. `VisibilityState` is `ColumnVisibilityState` in v9 (both names are exported).
6. **Column meta typing.** The package no longer augments TanStack's global `ColumnMeta` interface. `column.columnDef.meta` is still typed as `DataTableColumnMeta` on the package's `Column` / `ColumnDef`; an app that read `meta` through TanStack's own types should switch to the package's types.
7. **Instance identity.** `useTable` returns a new table object on every render. Don't put the table instance in effect or memo dependency arrays (read it through a ref, as `DataTableSearch` now does); the search box no longer re-reports its value — and so no longer rewrites the URL — on every render.

