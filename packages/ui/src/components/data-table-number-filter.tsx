'use client'

import type { RowData } from '@tanstack/react-table'
import { FunnelIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { cn } from '../lib/utils'
import { Badge } from './badge'
import { Button } from './button'
import { useResolveColumn } from './data-table-context'
import { Input } from './input'
import { Label } from './label'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Separator } from './separator'
import type { Column } from './data-table-types'

type NumberRange = {
  min?: number
  max?: number
}

type DataTableNumberFilterLabels = {
  from?: string
  to?: string
  min?: string
  max?: string
  clearFilter?: string
}

type DataTableNumberFilterProps<TData extends RowData, TValue> = {
  title: string
  icon?: ReactNode
  labels?: DataTableNumberFilterLabels
  className?: string
  onFilterChange?: (range: NumberRange | undefined) => void
} & (
  | { column: Column<TData, TValue>; columnId?: never }
  | { columnId: string; column?: never }
)

function DataTableNumberFilter<TData extends RowData, TValue>({
  column: columnProp,
  columnId,
  title,
  icon,
  labels,
  className,
  onFilterChange,
}: DataTableNumberFilterProps<TData, TValue>) {
  const resolvedColumn = useResolveColumn<TData>(columnId)
  // biome-ignore lint/style/noNonNullAssertion: discriminated union guarantees one of columnProp or resolvedColumn is defined
  const column = (columnProp ?? resolvedColumn)!
  const filterValue = column.getFilterValue() as
    | [number | undefined, number | undefined]
    | undefined
  const [min, setMin] = useState<string>(
    filterValue?.[0] !== undefined ? String(filterValue[0]) : '',
  )
  const [max, setMax] = useState<string>(
    filterValue?.[1] !== undefined ? String(filterValue[1]) : '',
  )

  const hasActiveFilter = filterValue !== undefined

  // Debounce filter updates
  useEffect(() => {
    const timeout = setTimeout(() => {
      const parsedMin = Number(min)
      const parsedMax = Number(max)
      const minVal =
        min !== '' && Number.isFinite(parsedMin) ? parsedMin : undefined
      const maxVal =
        max !== '' && Number.isFinite(parsedMax) ? parsedMax : undefined

      if (minVal === undefined && maxVal === undefined) {
        column.setFilterValue(undefined)
        onFilterChange?.(undefined)
      } else {
        column.setFilterValue([minVal, maxVal])
        onFilterChange?.({ min: minVal, max: maxVal })
      }
    }, 200)
    return () => clearTimeout(timeout)
  }, [min, max, column, onFilterChange])

  const clear = () => {
    setMin('')
    setMax('')
    column.setFilterValue(undefined)
    onFilterChange?.(undefined)
  }

  // Sync local state when filter is cleared externally
  useEffect(() => {
    if (!filterValue) {
      setMin('')
      setMax('')
    }
  }, [filterValue])

  const rangeLabel =
    hasActiveFilter &&
    [filterValue[0], filterValue[1]]
      .filter(v => v !== undefined)
      .map(String)
      .join(' – ')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className={cn(className)}
          data-slot='data-table-number-filter'>
          {icon ?? <FunnelIcon />}
          {title}
          {hasActiveFilter && rangeLabel && (
            <>
              <Separator orientation='vertical' className='mx-0.5 h-4' />
              <Badge variant='secondary'>{rangeLabel}</Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[220px] p-3' align='start'>
        <div className='space-y-3'>
          <div className='space-y-1'>
            <Label className='text-xs'>{labels?.from ?? 'From'}</Label>
            <Input
              numberStepper
              value={min}
              onChange={e => setMin(e.target.value)}
              placeholder={labels?.min ?? 'Min'}
            />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>{labels?.to ?? 'To'}</Label>
            <Input
              numberStepper
              value={max}
              onChange={e => setMax(e.target.value)}
              placeholder={labels?.max ?? 'Max'}
            />
          </div>
          {hasActiveFilter && (
            <Button
              variant='ghost'
              size='sm'
              className='w-full'
              onClick={clear}>
              {labels?.clearFilter ?? 'Clear filter'}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DataTableNumberFilter }
export type {
  DataTableNumberFilterLabels,
  DataTableNumberFilterProps,
  NumberRange,
}
