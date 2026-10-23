'use client'

import type { RowData } from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  InfoIcon,
} from 'lucide-react'
import type * as React from 'react'

import { cn } from '../lib/utils'
import {
  ColumnHeaderMenu,
  type DataTableColumnHeaderLabels,
} from './data-table-column-header-menu'
import { useDataTable } from './data-table-context'
import { Icon } from './icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'
import type { Column } from './data-table-types'

type DataTableColumnHeaderProps<TData extends RowData, TValue> = {
  column: Column<TData, TValue>
  title: string
  tooltip?: React.ReactNode
  labels?: DataTableColumnHeaderLabels
  align?: 'start' | 'end'
  className?: string
}

const TooltipInfoButton = ({
  tooltip,
  ariaLabel,
}: {
  tooltip: React.ReactNode
  ariaLabel: string
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          aria-label={ariaLabel}
          className='text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center'>
          <Icon icon={InfoIcon} size='sm' />
        </button>
      </TooltipTrigger>
      <TooltipContent className='max-w-xs'>{tooltip}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  tooltip,
  labels,
  align,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const table = useDataTable<TData>()
  const canSort = column.getCanSort()
  const canHide = column.getCanHide()

  const meta = column.columnDef.meta
  const pinned = column.getIsPinned()
  const canPin = meta?.pinnable !== false && column.getCanPin()
  const filterable = meta?.filterable

  // Column reordering capability check
  const draggableColumns = table.getAllLeafColumns().filter(c => {
    const cMeta = c.columnDef.meta
    return cMeta?.reorderable !== false && !c.getIsPinned() && c.getIsVisible()
  })
  const columnIndex = draggableColumns.findIndex(c => c.id === column.id)
  const canMove = !pinned && columnIndex >= 0 && draggableColumns.length > 1

  const hasMenu = canSort || canHide || canMove || canPin || !!filterable
  const alignEnd = align === 'end'
  const tooltipAriaLabel = labels?.tooltipInfo ?? 'More information'

  if (!canSort && !hasMenu) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1',
          alignEnd && 'justify-end',
          className,
        )}>
        <span className='truncate'>{title}</span>
        {tooltip && (
          <TooltipInfoButton tooltip={tooltip} ariaLabel={tooltipAriaLabel} />
        )}
      </span>
    )
  }

  const sorted = column.getIsSorted()
  const SortIcon =
    (
      { asc: ArrowUpIcon, desc: ArrowDownIcon } as Record<
        string,
        typeof ArrowUpIcon
      >
    )[sorted as string] ?? ChevronsUpDownIcon
  const sortIconClass = sorted
    ? 'text-foreground shrink-0'
    : 'shrink-0 opacity-40'

  return (
    <div
      data-slot='data-table-column-header'
      className={cn(
        'flex items-center gap-1 overflow-clip',
        alignEnd && 'justify-end',
        className,
      )}>
      <button
        type='button'
        className={cn(
          'relative flex h-full items-center gap-1 truncate select-none',
          canSort && 'cursor-pointer',
        )}
        disabled={!canSort}
        onClick={column.getToggleSortingHandler()}>
        <span className='truncate'>{title}</span>
        {canSort && (
          <SortIcon className={sortIconClass} size={14} aria-hidden='true' />
        )}
      </button>
      {tooltip && (
        <TooltipInfoButton tooltip={tooltip} ariaLabel={tooltipAriaLabel} />
      )}
      {hasMenu && (
        <ColumnHeaderMenu
          column={column}
          title={title}
          labels={labels}
          align={align}
        />
      )}
    </div>
  )
}

export { DataTableColumnHeader }
export type { DataTableColumnHeaderLabels, DataTableColumnHeaderProps }
