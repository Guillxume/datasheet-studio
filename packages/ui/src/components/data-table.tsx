'use client'

import type {
  ColumnDef as BaseColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnVisibilityState,
  OnChangeFn,
  PaginationState,
  RowData,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { useTable } from '@tanstack/react-table'
import * as React from 'react'

import type { DisplayMode } from '../hooks/use-settings'
import { useDragReorder } from '../hooks/use-drag-reorder'
import { cn } from '../lib/utils'
import { getFixedHeightProps } from './data-table-utils'
import {
  DataTableCalendarView,
  type DataTableCalendarConfig,
  type DataTableCalendarViewLabels,
} from './data-table-calendar-view'
import { DataTableCardView } from './data-table-card-view'
import { DataTableContext } from './data-table-context'
import { DataTableTableView } from './data-table-table-view'
import {
  type ColumnDef,
  type DataTableFeatures,
  type DataTableLabels,
  dataTableFeatures,
  type Row,
  type Table as TanstackTable,
} from './data-table-types'
import { Spinner } from './spinner'

// This package keeps the v8 name; TanStack Table 9 calls it `ColumnVisibilityState`.
type VisibilityState = ColumnVisibilityState

type DataTableProps<TData extends RowData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  toolbar?: (table: TanstackTable<TData>) => React.ReactNode
  footer?: (table: TanstackTable<TData>) => React.ReactNode
  bulkActions?: (table: TanstackTable<TData>) => React.ReactNode
  enableColumnReordering?: boolean
  initialColumnOrder?: ColumnOrderState
  onColumnOrderChange?: (columnOrder: string[]) => void
  initialColumnVisibility?: VisibilityState
  onColumnVisibilityChange?: (visibility: VisibilityState) => void
  initialColumnPinning?: Partial<ColumnPinningState>
  onColumnPinningChange?: (pinning: ColumnPinningState) => void
  fixedHeight?: boolean | string
  noResultsMessage?: string
  labels?: DataTableLabels
  loading?: boolean
  className?: string
  renderCard?: (row: Row<TData>) => React.ReactNode
  calendarConfig?: DataTableCalendarConfig<TData>
  calendarLabels?: DataTableCalendarViewLabels
  calendarLocale?: import('date-fns/locale').Locale
  displayMode?: DisplayMode
  onDisplayModeChange?: (mode: DisplayMode) => void
} & (
  | {
      /** Enable server-side mode: disables client-side sorting, filtering, and pagination. */
      manualMode: true
      /** Total number of rows on the server. Pass `null` while loading to prevent page reset. */
      rowCount: number | null
      /** Controlled pagination state. */
      pagination: PaginationState
      /** Called when pagination state changes (page navigation or page size). */
      onPaginationChange: OnChangeFn<PaginationState>
      /** Controlled sorting state. */
      sorting: SortingState
      /** Called when sorting state changes. */
      onSortingChange: OnChangeFn<SortingState>
      /** Controlled column filters state. */
      columnFilters: ColumnFiltersState
      /** Called when column filters change. */
      onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
    }
  | {
      manualMode?: false
      rowCount?: never
      pagination?: never
      onPaginationChange?: never
      sorting?: never
      onSortingChange?: never
      columnFilters?: never
      onColumnFiltersChange?: never
    }
)

const LoadingOverlay = () => (
  <div className='absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/60 dark:bg-black/40'>
    <Spinner size='lg' />
  </div>
)

function DataTable<TData extends RowData, TValue>(
  props: DataTableProps<TData, TValue>,
) {
  const {
    columns,
    data,
    toolbar,
    footer,
    bulkActions,
    enableColumnReordering = false,
    initialColumnOrder,
    onColumnOrderChange: onColumnOrderChangeProp,
    initialColumnVisibility,
    onColumnVisibilityChange: onColumnVisibilityChangeProp,
    initialColumnPinning,
    onColumnPinningChange: onColumnPinningChangeProp,
    fixedHeight,
    noResultsMessage,
    loading,
    className,
    renderCard,
    labels,
    displayMode: displayModeProp,
  } = props

  const isCardMode = !!renderCard && displayModeProp === 'card'
  const isCalendarMode =
    !!props.calendarConfig && displayModeProp === 'calendar'

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility ?? {})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(
    initialColumnOrder ?? [],
  )

  const hasSelectColumn = columns.some(c => 'id' in c && c.id === 'select')
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(
    () => {
      const start = initialColumnPinning?.start ?? []
      return {
        start:
          hasSelectColumn && !start.includes('select')
            ? ['select', ...start]
            : start,
        end: initialColumnPinning?.end ?? [],
      }
    },
  )

  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const [pinnedOffsets, setPinnedOffsets] = React.useState<
    Record<string, number>
  >({})

  const isManual = props.manualMode === true

  const manualConfig = isManual
    ? {
        manualPagination: true as const,
        manualSorting: true as const,
        manualFiltering: true as const,
        // When rowCount is null (not yet loaded), use pageCount: -1 ("unknown")
        // so TanStack doesn't clamp pageIndex to 0 — which would erase the URL page param.
        // Both keys must always be set because useTable merges prev + next options,
        // so a stale pageCount: -1 would persist and override a later rowCount.
        ...(props.rowCount !== null
          ? { rowCount: props.rowCount, pageCount: undefined }
          : { rowCount: undefined, pageCount: -1 }),
        onSortingChange: props.onSortingChange,
        onColumnFiltersChange: props.onColumnFiltersChange,
        onPaginationChange: props.onPaginationChange,
        autoResetPageIndex: false,
      }
    : {}

  const manualState = isManual
    ? {
        sorting: props.sorting,
        columnFilters: props.columnFilters,
        pagination: props.pagination,
      }
    : {}

  const table = useTable({
    features: dataTableFeatures,
    data,
    // This package's ColumnDef narrows `header` and `meta`; same runtime shape as TanStack's.
    // TValue is erased on purpose: TanStack's `columns` option is typed with the
    // default (unknown) cell value, and each column keeps its own TValue at the def.
    columns: columns as ReadonlyArray<BaseColumnDef<DataTableFeatures, TData>>,
    initialState: {
      columnVisibility: initialColumnVisibility,
    },
    ...manualConfig,
    onColumnVisibilityChange: updater => {
      const next =
        typeof updater === 'function' ? updater(columnVisibility) : updater
      setColumnVisibility(next)
      onColumnVisibilityChangeProp?.(next)
    },
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: updater => {
      const next =
        typeof updater === 'function' ? updater(columnOrder) : updater
      setColumnOrder(next)
      onColumnOrderChangeProp?.(next)
    },
    onColumnPinningChange: updater => {
      const next =
        typeof updater === 'function' ? updater(columnPinning) : updater
      setColumnPinning(next)
      onColumnPinningChangeProp?.(next)
    },
    state: {
      ...manualState,
      columnVisibility,
      rowSelection,
      columnOrder,
      columnPinning,
    },
  })

  // useTable returns a new object on every render; read the latest one through a
  // ref so the measurement callback (and the ResizeObserver below) stay stable.
  const tableRef = React.useRef(table)
  tableRef.current = table

  const measurePinnedOffsets = React.useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const headers = wrapper.querySelectorAll<HTMLTableCellElement>(
      'thead th[data-column-id]',
    )
    const widthMap = new Map<string, number>()
    for (const th of headers) {
      const colId = th.dataset.columnId
      if (colId) widthMap.set(colId, th.getBoundingClientRect().width)
    }

    const startPinned = tableRef.current.getStartLeafColumns()
    const endPinned = tableRef.current.getEndLeafColumns()
    const next: Record<string, number> = {}

    let startOffset = 0
    for (const col of startPinned) {
      next[col.id] = startOffset
      startOffset += widthMap.get(col.id) ?? 0
    }

    let endOffset = 0
    for (const col of [...endPinned].reverse()) {
      next[col.id] = endOffset
      endOffset += widthMap.get(col.id) ?? 0
    }

    setPinnedOffsets(prev => {
      const keys = Object.keys(next)
      if (keys.length !== Object.keys(prev).length) return next
      for (const k of keys) {
        if (prev[k] !== next[k]) return next
      }
      return prev
    })
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure offsets when column layout changes
  React.useLayoutEffect(() => {
    measurePinnedOffsets()
  }, [measurePinnedOffsets, columnPinning, columnOrder, columnVisibility])

  React.useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver(() => measurePinnedOffsets())
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [measurePinnedOffsets])

  const drag = useDragReorder({ table, enableColumnReordering })

  const fixedHeightProps = getFixedHeightProps(
    fixedHeight,
    isCardMode,
    isCalendarMode,
    table.state.pagination.pageSize,
  )

  const resolveSlot = (
    slot: ((t: TanstackTable<TData>) => React.ReactNode) | undefined,
  ) => slot?.(table)

  const renderDisplayMode = () => {
    if (isCalendarMode && props.calendarConfig) {
      return (
        <DataTableCalendarView
          rows={table.getRowModel().rows}
          calendarConfig={props.calendarConfig}
          loading={loading}
          noResultsMessage={noResultsMessage}
          labels={props.calendarLabels}
          dateFnsLocale={props.calendarLocale}
          totalItems={props.rowCount ?? undefined}
        />
      )
    }
    if (isCardMode && renderCard) {
      return (
        <DataTableCardView
          renderCard={renderCard}
          hasSelectColumn={hasSelectColumn}
          loading={loading}
          noResultsMessage={noResultsMessage}
          labels={labels}
        />
      )
    }
    return (
      <DataTableTableView
        fixedHeight={fixedHeight}
        noResultsMessage={noResultsMessage}
        labels={labels}
        pinnedOffsets={pinnedOffsets}
        drag={drag}
        enableColumnReordering={enableColumnReordering}
        columnCount={columns.length}
      />
    )
  }

  return (
    <DataTableContext value={table}>
      <div
        ref={wrapperRef}
        data-slot='data-table'
        className={cn('w-full space-y-4', className)}>
        {toolbar && (
          <div
            className={cn(
              loading && 'pointer-events-none opacity-50 select-none',
            )}>
            {resolveSlot(toolbar)}
          </div>
        )}
        <div
          className={cn(
            'bg-card text-card-foreground relative rounded-xl border shadow-sm',
            fixedHeightProps.className,
          )}
          style={fixedHeightProps.style}>
          {resolveSlot(bulkActions)}
          {loading && <LoadingOverlay />}
          {renderDisplayMode()}
        </div>
        {resolveSlot(footer)}
      </div>
    </DataTableContext>
  )
}

export { DataTable }
export { useDataTable, useResolveColumn } from './data-table-context'
export { getTypedFilterValue } from './data-table-types'
export type {
  Column,
  ColumnDef,
  DataTableColumnMeta,
  DataTableFeatures,
  DataTableLabels,
  FilterValueMap,
  Table,
} from './data-table-types'
export type {
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnVisibilityState,
  OnChangeFn,
  PaginationState,
  Row,
  SortingState,
  VisibilityState,
}
export type { DataTableProps }
