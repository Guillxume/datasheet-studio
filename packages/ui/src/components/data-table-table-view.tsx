'use client'

import { flexRender } from '@tanstack/react-table'

import type { UseDragReorderReturn } from '../hooks/use-drag-reorder'
import { cn } from '../lib/utils'
import { useDataTable } from './data-table-context'
import {
  getEdgePaddingClassName,
  getPinnedClassName,
  getPinnedStyles,
} from './data-table-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

type DataTableTableViewProps = {
  fixedHeight?: boolean | string
  noResultsMessage?: string
  labels?: { selectRow?: string; dragHint?: string }
  pinnedOffsets: Record<string, number>
  drag: UseDragReorderReturn
  enableColumnReordering?: boolean
  columnCount: number
}

const ariaSortMap = { asc: 'ascending', desc: 'descending' } as const

const DataTableTableView = ({
  fixedHeight,
  noResultsMessage,
  labels,
  pinnedOffsets,
  drag,
  enableColumnReordering,
  columnCount,
}: DataTableTableViewProps) => {
  const table = useDataTable()

  const startPinnedColumns = table.getStartLeafColumns()
  const endPinnedColumns = table.getEndLeafColumns()

  const visibleColumns = table.getVisibleLeafColumns()
  const firstColumnId = visibleColumns[0]?.id
  const lastColumnId = visibleColumns[visibleColumns.length - 1]?.id
  const padFirstColumn = firstColumnId !== 'select'
  const padLastColumn = lastColumnId !== 'actions'

  const firstStartPinnedId = startPinnedColumns[0]?.id
  const lastEndPinnedId = endPinnedColumns[endPinnedColumns.length - 1]?.id

  return (
    <Table className='border-separate border-spacing-0'>
      <TableHeader className={cn(fixedHeight && 'bg-card sticky top-0 z-10')}>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow
            key={headerGroup.id}
            className='hover:bg-transparent border-none'>
            {headerGroup.headers.map(header => {
              const draggable = drag.isColumnDraggable(header.column.id)
              const ariaSort =
                ariaSortMap[
                  header.column.getIsSorted() as keyof typeof ariaSortMap
                ] ?? undefined

              return (
                <TableHead
                  key={header.id}
                  data-column-id={header.column.id}
                  draggable={draggable || undefined}
                  aria-sort={ariaSort}
                  aria-description={
                    draggable
                      ? (labels?.dragHint ??
                        'Use column options to reorder with keyboard')
                      : undefined
                  }
                  onDragStart={
                    draggable
                      ? e => drag.handleDragStart(e, header.column.id)
                      : undefined
                  }
                  onDragOver={
                    enableColumnReordering
                      ? e => drag.handleDragOver(e, header.column.id)
                      : undefined
                  }
                  onDrop={
                    enableColumnReordering
                      ? e => drag.handleDrop(e, header.column.id)
                      : undefined
                  }
                  onDragEnd={
                    enableColumnReordering ? drag.handleDragEnd : undefined
                  }
                  className={cn(
                    'border-b',
                    draggable && 'cursor-grab',
                    drag.draggedColumnId === header.column.id && 'opacity-50',
                    drag.dropTargetColumnId === header.column.id &&
                      drag.draggedColumnId !== header.column.id &&
                      draggable &&
                      'bg-muted/50',
                    getPinnedClassName(
                      header.column,
                      startPinnedColumns,
                      endPinnedColumns,
                    ),
                    getEdgePaddingClassName(
                      header.column.id,
                      firstColumnId,
                      lastColumnId,
                      padFirstColumn,
                      padLastColumn,
                    ),
                    header.column.id === firstStartPinnedId && 'rounded-tl-xl',
                    header.column.id === lastEndPinnedId && 'rounded-tr-xl',
                  )}
                  style={{
                    ...(header.getSize() !== 150
                      ? { width: `${header.getSize()}px` }
                      : undefined),
                    ...getPinnedStyles(header.column, pinnedOffsets),
                  }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row, rowIndex, rows) => {
            const isLastRow = rowIndex === rows.length - 1
            return (
              <TableRow
                key={row.id}
                className={cn(
                  'group/row border-none',
                  isLastRow &&
                    'hover:bg-transparent data-[state=selected]:bg-transparent',
                )}
                data-state={row.getIsSelected() && 'selected'}
                aria-selected={row.getIsSelected() || undefined}>
                {row.getVisibleCells().map((cell, cellIndex, cells) => {
                  const isPinned = cell.column.getIsPinned()
                  const pinnedHoverClass =
                    isPinned &&
                    'group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted'
                  const lastRowUnpinnedClass =
                    isLastRow &&
                    !isPinned &&
                    'group-hover/row:bg-muted/50 group-data-[state=selected]/row:bg-muted'

                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        !isLastRow && 'border-b',
                        getPinnedClassName(
                          cell.column,
                          startPinnedColumns,
                          endPinnedColumns,
                        ),
                        pinnedHoverClass,
                        lastRowUnpinnedClass,
                        getEdgePaddingClassName(
                          cell.column.id,
                          firstColumnId,
                          lastColumnId,
                          padFirstColumn,
                          padLastColumn,
                        ),
                        isLastRow && cellIndex === 0 && 'rounded-bl-xl',
                        isLastRow &&
                          cellIndex === cells.length - 1 &&
                          'rounded-br-xl',
                      )}
                      style={getPinnedStyles(cell.column, pinnedOffsets)}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })
        ) : (
          <TableRow className='border-none'>
            <TableCell colSpan={columnCount} className='h-24 text-center'>
              {noResultsMessage ?? 'No results.'}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export { DataTableTableView }
export type { DataTableTableViewProps }
