'use client'

import type { RowData } from '@tanstack/react-table'
import { format, isValid, parse, set } from 'date-fns'
import type { Locale } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DateRange } from 'react-day-picker'
import { z } from 'zod'

import { cn } from '../lib/utils'
import { Badge } from './badge'
import { Button } from './button'
import { useResolveColumn } from './data-table-context'
import { useFilterInteractionReporter } from './data-table-filter-interaction'
import { type Column, getTypedFilterValue } from './data-table-types'
import { DatePicker } from './date-picker'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Separator } from './separator'
import { TimePicker } from './time-picker'

type DataTableDateFilterLabels = {
  from?: string
  to?: string
  clearFilter?: string
}

type DataTableDateFilterProps<TData extends RowData, TValue> = {
  title: string
  icon?: ReactNode
  labels?: DataTableDateFilterLabels
  className?: string
  formatStr?: string
  locale?: Locale
  onFilterChange?: (range: DateRange | undefined) => void
} & (
  | { column: Column<TData, TValue>; columnId?: never }
  | { columnId: string; column?: never }
)

const DEFAULT_FROM_TIME = { hours: 0, minutes: 0, display: '00:00' }
const DEFAULT_TO_TIME = { hours: 23, minutes: 59, display: '23:59' }

const isoDateCodec = z.codec(z.iso.datetime().optional(), z.date().optional(), {
  decode: str => (str ? new Date(str) : undefined),
  encode: date => (date ? date.toISOString() : undefined),
})

const safeDecodeDate = (value: string | undefined): Date | undefined => {
  try {
    return isoDateCodec.decode(value)
  } catch {
    return undefined
  }
}

function DataTableDateFilter<TData extends RowData, TValue>({
  column: columnProp,
  columnId,
  title,
  icon,
  labels,
  className,
  formatStr = 'LLL dd, y HH:mm',
  locale,
  onFilterChange,
}: DataTableDateFilterProps<TData, TValue>) {
  const resolvedColumn = useResolveColumn<TData>(columnId)
  // biome-ignore lint/style/noNonNullAssertion: discriminated union guarantees one of columnProp or resolvedColumn is defined
  const column = (columnProp ?? resolvedColumn)!
  const filterValue = getTypedFilterValue(column, 'date')

  const fromDateTime = safeDecodeDate(filterValue?.[0])
  const toDateTime = safeDecodeDate(filterValue?.[1])
  const hasActiveFilter = filterValue !== undefined

  const reportOpenChange = useFilterInteractionReporter(
    columnProp?.id ?? columnId,
  )

  const setFilter = (from: Date | undefined, to: Date | undefined) => {
    if (!from && !to) {
      column.setFilterValue(undefined)
      onFilterChange?.(undefined)
    } else {
      column.setFilterValue([
        isoDateCodec.encode(from),
        isoDateCodec.encode(to),
      ])
      onFilterChange?.({ from, to })
    }
  }

  const handleFromDateChange = (date: Date | undefined) => {
    if (!date) return setFilter(undefined, toDateTime)
    setFilter(
      set(date, {
        hours: fromDateTime?.getHours() ?? DEFAULT_FROM_TIME.hours,
        minutes: fromDateTime?.getMinutes() ?? DEFAULT_FROM_TIME.minutes,
        seconds: 0,
        milliseconds: 0,
      }),
      toDateTime,
    )
  }

  const handleToDateChange = (date: Date | undefined) => {
    if (!date) return setFilter(fromDateTime, undefined)
    setFilter(
      fromDateTime,
      set(date, {
        hours: toDateTime?.getHours() ?? DEFAULT_TO_TIME.hours,
        minutes: toDateTime?.getMinutes() ?? DEFAULT_TO_TIME.minutes,
        seconds: 0,
        milliseconds: 0,
      }),
    )
  }

  const handleFromTimeChange = (time: string) => {
    if (!fromDateTime) return
    const parsed = parse(time, 'HH:mm', fromDateTime)
    if (isValid(parsed))
      setFilter(set(parsed, { seconds: 0, milliseconds: 0 }), toDateTime)
  }

  const handleToTimeChange = (time: string) => {
    if (!toDateTime) return
    const parsed = parse(time, 'HH:mm', toDateTime)
    if (isValid(parsed))
      setFilter(fromDateTime, set(parsed, { seconds: 0, milliseconds: 0 }))
  }

  const clear = () => {
    column.setFilterValue(undefined)
    onFilterChange?.(undefined)
  }

  const rangeLabel =
    hasActiveFilter &&
    [filterValue[0], filterValue[1]]
      .filter((v): v is string => !!v)
      .flatMap(v => {
        const d = safeDecodeDate(v)
        return d ? [format(d, formatStr, locale ? { locale } : undefined)] : []
      })
      .join(' – ')

  return (
    <Popover onOpenChange={reportOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className={cn(className)}
          data-slot='data-table-date-filter'>
          {icon ?? <CalendarIcon />}
          {title}
          {hasActiveFilter && rangeLabel && (
            <>
              <Separator orientation='vertical' className='mx-0.5 h-4' />
              <Badge
                variant='secondary'
                className='sm:hidden'
                aria-label={rangeLabel}>
                1
              </Badge>
              <Badge variant='secondary' className='max-sm:hidden'>
                {rangeLabel}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-3' align='start'>
        <div className='space-y-3'>
          <div className='space-y-1'>
            <span className='text-muted-foreground text-xs'>
              {labels?.from ?? 'From'}
            </span>
            <div className='flex items-center gap-2'>
              <DatePicker
                value={fromDateTime}
                onValueChange={handleFromDateChange}
                formatStr='dd/MM/yyyy'
                locale={locale}
                className='h-9 w-[160px]'
              />
              <TimePicker
                value={
                  fromDateTime
                    ? format(fromDateTime, 'HH:mm')
                    : DEFAULT_FROM_TIME.display
                }
                onValueChange={handleFromTimeChange}
                disabled={!fromDateTime}
              />
            </div>
          </div>
          <div className='space-y-1'>
            <span className='text-muted-foreground text-xs'>
              {labels?.to ?? 'To'}
            </span>
            <div className='flex items-center gap-2'>
              <DatePicker
                value={toDateTime}
                onValueChange={handleToDateChange}
                formatStr='dd/MM/yyyy'
                locale={locale}
                className='h-9 w-[160px]'
              />
              <TimePicker
                value={
                  toDateTime
                    ? format(toDateTime, 'HH:mm')
                    : DEFAULT_TO_TIME.display
                }
                onValueChange={handleToTimeChange}
                disabled={!toDateTime}
              />
            </div>
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

export { DataTableDateFilter }
export type { DataTableDateFilterLabels, DataTableDateFilterProps }
