'use client'

import type { RowData } from '@tanstack/react-table'
import { XIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '../lib/utils'
import { Button } from './button'
import { Checkbox } from './checkbox'
import { useDataTable } from './data-table-context'
import type { Row } from './data-table-types'

type BulkAction<TData extends RowData> = {
  label: string
  icon?: React.ReactNode
  onClick: (rows: Row<TData>[]) => void
  color?: 'default' | 'destructive'
}

type DataTableBulkActionsLabels = {
  selectAll?: string
  selected?: string
  deselect?: string
}

type DataTableBulkActionsProps<TData extends RowData> = {
  actions: BulkAction<TData>[]
  labels?: DataTableBulkActionsLabels
  className?: string
}

function DataTableBulkActions<TData extends RowData>({
  actions,
  labels,
  className,
}: DataTableBulkActionsProps<TData>) {
  const table = useDataTable<TData>()
  const selectedRows = table.getFilteredSelectedRowModel().rows

  if (selectedRows.length === 0) {
    return null
  }

  return (
    <div
      data-slot='data-table-bulk-actions'
      aria-live='polite'
      className={cn(
        'bg-background absolute inset-x-0 top-0 z-20 flex h-10 items-center gap-3 rounded-t-md border-b px-2',
        className,
      )}>
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
        aria-label={labels?.selectAll ?? 'Select all'}
      />
      <span className='text-muted-foreground text-sm whitespace-nowrap'>
        <span className='text-foreground font-medium'>
          {selectedRows.length}
        </span>{' '}
        {labels?.selected ?? 'selected'}
      </span>
      <Button
        variant='ghost'
        size='sm'
        className='text-muted-foreground h-7 px-2'
        onClick={() => table.toggleAllRowsSelected(false)}>
        <XIcon aria-hidden='true' />
        {labels?.deselect ?? 'Deselect'}
      </Button>
      <div className='ml-auto flex items-center gap-2'>
        {actions.map(action => (
          <Button
            key={action.label}
            variant='outline'
            color={action.color}
            size='sm'
            className='h-7'
            onClick={() => action.onClick(selectedRows)}>
            {action.icon}
            <span className='max-sm:sr-only'>{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

export { DataTableBulkActions }
export type {
  BulkAction,
  DataTableBulkActionsLabels,
  DataTableBulkActionsProps,
}
