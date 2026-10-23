'use client'

import type { RowData } from '@tanstack/react-table'
import type * as React from 'react'

import { cn } from '../lib/utils'
import { Checkbox } from './checkbox'
import { useDataTable } from './data-table-context'
import { useSidebar } from './sidebar'
import { Skeleton } from './skeleton'
import type { Row } from './data-table-types'

type DataTableCardViewProps<TData extends RowData> = {
  renderCard: (row: Row<TData>) => React.ReactNode
  hasSelectColumn: boolean
  loading?: boolean
  noResultsMessage?: string
  labels?: { selectRow?: string }
}

const DataTableCardView = <TData extends RowData>({
  renderCard,
  hasSelectColumn,
  loading,
  noResultsMessage,
  labels,
}: DataTableCardViewProps<TData>) => {
  const table = useDataTable<TData>()
  const rows = table.getRowModel().rows
  const { state } = useSidebar()

  if (loading && !rows?.length) {
    return (
      <div className='grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3'>
        {['s1', 's2', 's3', 's4', 's5', 's6'].map(id => (
          <div key={id} className='space-y-3 rounded-xl border p-4'>
            <div className='flex items-start justify-between'>
              <div className='space-y-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-3 w-16' />
              </div>
              <Skeleton className='h-5 w-16 rounded-full' />
            </div>
            <div className='space-y-2'>
              <Skeleton className='h-3 w-full' />
              <Skeleton className='h-3 w-full' />
              <Skeleton className='h-3 w-3/4' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!rows?.length) {
    return (
      <div className='col-span-full flex h-24 items-center justify-center'>
        <p className='text-muted-foreground'>
          {noResultsMessage ?? 'No results.'}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 p-4',
        state === 'expanded' &&
          'md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
        state === 'collapsed' &&
          'md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
      )}>
      {rows.map(row => (
        <div
          key={row.id}
          className={cn(
            'group relative rounded-xl transition-shadow hover:shadow-md',
            row.getIsSelected() && 'ring-primary ring-2',
          )}>
          {hasSelectColumn && (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={value => row.toggleSelected(!!value)}
              aria-label={labels?.selectRow ?? 'Select row'}
              className='absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100'
            />
          )}
          {renderCard(row)}
        </div>
      ))}
    </div>
  )
}

export { DataTableCardView }
export type { DataTableCardViewProps }
