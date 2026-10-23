'use client'

import type { RowData } from '@tanstack/react-table'
import type { Locale } from 'date-fns'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  isSameDay,
  isSameMonth,
  isToday,
  setMonth as setDateMonth,
  setYear as setDateYear,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import * as React from 'react'

import { cn } from '../lib/utils'
import { Alert, AlertDescription } from './alert'
import { Badge } from './badge'
import { Button } from './button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from './drawer'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import { Skeleton } from './skeleton'
import type { Row } from './data-table-types'

type CalendarDateField = {
  id: string
  label: string
}

type DataTableCalendarConfig<TData extends RowData> = {
  dateFields: CalendarDateField[]
  dateAccessor: (row: TData, fieldId: string) => Date | null
  renderEvent?: (row: Row<TData>) => React.ReactNode
  renderEventDetail?: (row: Row<TData>) => React.ReactNode
  onMonthChange?: (monthStart: Date, monthEnd: Date, fieldId: string) => void
}

type DataTableCalendarViewLabels = {
  today?: string
  noEvents?: string
  selectDateField?: string
  monthLabel?: string
  yearLabel?: string
  truncationWarning?: string
  previousMonth?: string
  nextMonth?: string
  weekdays?: string[]
  moreItems?: (count: number) => string
  itemCount?: (count: number) => string
}

type DataTableCalendarViewProps<TData extends RowData> = {
  rows: Row<TData>[]
  calendarConfig: DataTableCalendarConfig<TData>
  loading?: boolean
  noResultsMessage?: string
  labels?: DataTableCalendarViewLabels
  totalItems?: number
  dateFnsLocale?: Locale
}

const MAX_INLINE_EVENTS = 3
const DEFAULT_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SKELETON_CELL_KEYS = Array.from({ length: 35 }, (_, i) => `cell-${i}`)

const CalendarSkeleton = () => (
  <output
    data-slot='calendar-skeleton'
    className='block space-y-4 p-4'
    aria-label='Loading calendar'>
    <div className='flex items-center justify-between'>
      <Skeleton className='h-9 w-9' />
      <Skeleton className='h-5 w-36' />
      <Skeleton className='h-9 w-9' />
    </div>
    <div className='grid grid-cols-7 gap-1'>
      {DEFAULT_WEEKDAYS.map(day => (
        <Skeleton key={day} className='h-8' />
      ))}
      {SKELETON_CELL_KEYS.map(key => (
        <Skeleton key={key} className='min-h-20' />
      ))}
    </div>
  </output>
)

const DataTableCalendarView = <TData extends RowData>({
  rows,
  calendarConfig,
  loading,
  labels,
  totalItems,
  dateFnsLocale,
}: DataTableCalendarViewProps<TData>) => {
  const {
    dateFields,
    dateAccessor,
    renderEvent,
    renderEventDetail,
    onMonthChange,
  } = calendarConfig

  const [currentMonth, setCurrentMonth] = React.useState(() =>
    startOfMonth(new Date()),
  )
  const [selectedFieldId, setSelectedFieldId] = React.useState(
    () => dateFields[0]?.id ?? '',
  )
  const [drawerDay, setDrawerDay] = React.useState<Date | null>(null)
  const [popoverDay, setPopoverDay] = React.useState<Date | null>(null)

  const fmtOpts = dateFnsLocale ? { locale: dateFnsLocale } : undefined

  const weekdays = React.useMemo(
    () =>
      labels?.weekdays ??
      (dateFnsLocale
        ? Array.from({ length: 7 }, (_, i) => {
            // 2024-01-01 is a Monday
            const d = new Date(2024, 0, 1 + i)
            return format(d, 'EEE', { locale: dateFnsLocale })
          })
        : DEFAULT_WEEKDAYS),
    [labels?.weekdays, dateFnsLocale],
  )

  const calendarDays = React.useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const start = startOfWeek(monthStart, { weekStartsOn: 1 })
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, Row<TData>[]>()
    for (const row of rows) {
      const date = dateAccessor(row.original, selectedFieldId)
      if (!date) continue
      const key = format(date, 'yyyy-MM-dd')
      const existing = map.get(key)
      if (existing) {
        existing.push(row)
      } else {
        map.set(key, [row])
      }
    }
    return map
  }, [rows, dateAccessor, selectedFieldId])

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1))
  }

  const handleToday = () => {
    setCurrentMonth(startOfMonth(new Date()))
  }

  const monthOptions = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i),
        label: format(new Date(2024, i, 1), 'MMMM', fmtOpts),
      })),
    [fmtOpts],
  )

  const currentYear = getYear(currentMonth)
  const yearOptions = React.useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const y = currentYear - 5 + i
        return { value: String(y), label: String(y) }
      }),
    [currentYear],
  )

  const handleMonthSelect = (value: string) => {
    setCurrentMonth(prev => startOfMonth(setDateMonth(prev, Number(value))))
  }

  const handleYearSelect = (value: string) => {
    setCurrentMonth(prev => startOfMonth(setDateYear(prev, Number(value))))
  }

  // Notify consumer when displayed month or selected date field changes
  React.useEffect(() => {
    if (!onMonthChange || !selectedFieldId) return
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    onMonthChange(start, end, selectedFieldId)
  }, [currentMonth, selectedFieldId, onMonthChange])

  if (loading && rows.length === 0) {
    return <CalendarSkeleton />
  }

  const isTruncated = totalItems != null && totalItems > rows.length

  return (
    <div data-slot='data-table-calendar-view' className='space-y-4 p-4'>
      {isTruncated && (
        <Alert variant='warning'>
          <TriangleAlertIcon />
          <AlertDescription>
            {labels?.truncationWarning ??
              `Showing ${rows.length} of ${totalItems} items. Apply filters to narrow the results.`}
          </AlertDescription>
        </Alert>
      )}
      {/* Header */}
      <div className='flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-between'>
        <div className='flex flex-wrap items-center justify-center gap-1'>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              aria-label={labels?.previousMonth ?? 'Previous month'}
              onClick={handlePreviousMonth}>
              <ChevronLeftIcon />
            </Button>
            <Select
              value={String(getMonth(currentMonth))}
              onValueChange={handleMonthSelect}>
              <SelectTrigger
                size='sm'
                className='w-auto gap-1 border-none shadow-none'
                aria-label={labels?.monthLabel ?? 'Select month'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(getYear(currentMonth))}
              onValueChange={handleYearSelect}>
              <SelectTrigger
                size='sm'
                className='w-auto gap-1 border-none shadow-none'
                aria-label={labels?.yearLabel ?? 'Select year'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant='ghost'
              size='icon'
              aria-label={labels?.nextMonth ?? 'Next month'}
              onClick={handleNextMonth}>
              <ChevronRightIcon />
            </Button>
          </div>
          <Button variant='outline' size='sm' onClick={handleToday}>
            {labels?.today ?? 'Today'}
          </Button>
        </div>
        {dateFields.length > 1 && (
          <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
            <SelectTrigger
              size='sm'
              aria-label={labels?.selectDateField ?? 'Select date field'}>
              <CalendarIcon className='mr-1 size-4' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateFields.map(field => (
                <SelectItem key={field.id} value={field.id}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Screen-reader announcement for month navigation */}
      <div className='sr-only' aria-live='polite'>
        {format(currentMonth, 'MMMM yyyy', fmtOpts)}
      </div>

      {/* Weekday headers */}
      <div className='grid grid-cols-7 gap-1'>
        {weekdays.map(day => (
          <div
            key={day}
            className='text-muted-foreground py-2 text-center text-xs font-medium'>
            {day}
          </div>
        ))}

        {/* Day cells */}
        {calendarDays.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const dayRows = eventsByDay.get(key)
          const count = dayRows?.length ?? 0
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isTodayDate = isToday(day)
          const isOutside = !isCurrentMonth
          const fullDateLabel = format(day, 'EEE d MMM yyyy', fmtOpts)

          if (isOutside && count === 0) {
            return (
              <div key={key} className='bg-muted/20 min-h-20 rounded-md p-2'>
                <span className='text-muted-foreground/50 text-sm'>
                  {format(day, 'd')}
                </span>
              </div>
            )
          }

          const dateNumber = (
            <span
              aria-current={isTodayDate && !isOutside ? 'date' : undefined}
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-sm',
                isOutside && 'text-muted-foreground/50',
                isTodayDate &&
                  !isOutside &&
                  'bg-primary text-primary-foreground',
              )}>
              {format(day, 'd')}
            </span>
          )

          const inlineRows = dayRows?.slice(0, MAX_INLINE_EVENTS)
          const overflowCount = count - MAX_INLINE_EVENTS
          const isPopoverOpen =
            popoverDay !== null && isSameDay(popoverDay, day)

          return (
            <div
              key={key}
              className={cn(
                'flex min-h-20 flex-col items-start gap-1 rounded-md p-2',
                isOutside ? 'bg-muted/20' : '',
              )}>
              {dateNumber}
              {count > 0 && (
                <>
                  {/* Mobile: badge opens drawer */}
                  <button
                    type='button'
                    className='min-h-6 min-w-6 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 md:hidden'
                    aria-label={`${labels?.itemCount?.(count) ?? `${count} ${count === 1 ? 'item' : 'items'}`}, ${fullDateLabel}`}
                    onClick={() => setDrawerDay(day)}>
                    <Badge
                      variant='secondary'
                      className='cursor-pointer text-xs'>
                      {count}
                    </Badge>
                  </button>
                  {/* Desktop: inline events + overflow popover */}
                  <div className='hidden w-full space-y-1 md:block'>
                    {inlineRows?.map(row => (
                      <div key={row.id}>
                        {renderEvent?.(row) ?? (
                          <p className='text-muted-foreground text-sm'>
                            {labels?.noEvents ?? `Row ${row.index + 1}`}
                          </p>
                        )}
                      </div>
                    ))}
                    {overflowCount > 0 && (
                      <Popover
                        open={isPopoverOpen}
                        onOpenChange={open => setPopoverDay(open ? day : null)}>
                        <PopoverTrigger asChild>
                          <button
                            type='button'
                            className='text-muted-foreground hover:text-foreground focus-visible:ring-ring min-h-6 cursor-pointer text-xs font-medium focus-visible:outline-none focus-visible:ring-2'>
                            {labels?.moreItems?.(overflowCount) ??
                              `+${overflowCount} more`}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align='start' className='w-72 p-0'>
                          <div className='border-b px-3 py-2'>
                            <p className='text-sm font-medium'>
                              {format(day, 'EEE d MMM yyyy', fmtOpts)}
                            </p>
                            <p className='text-muted-foreground text-xs'>
                              {labels?.itemCount?.(count) ??
                                `${count} ${count === 1 ? 'item' : 'items'}`}
                            </p>
                          </div>
                          <div className='max-h-64 overflow-y-auto p-2'>
                            <div className='space-y-2'>
                              {dayRows?.map(row => (
                                <div key={row.id}>
                                  {(renderEventDetail ?? renderEvent)?.(
                                    row,
                                  ) ?? (
                                    <p className='text-muted-foreground text-sm'>
                                      {labels?.noEvents ??
                                        `Row ${row.index + 1}`}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: drawer for day events */}
      <MobileDayDrawer
        day={drawerDay}
        rows={
          drawerDay
            ? eventsByDay.get(format(drawerDay, 'yyyy-MM-dd'))
            : undefined
        }
        renderEvent={renderEventDetail ?? renderEvent}
        noEventsLabel={labels?.noEvents}
        itemCountLabel={labels?.itemCount}
        dateFnsLocale={dateFnsLocale}
        onOpenChange={open => {
          if (!open) setDrawerDay(null)
        }}
      />
    </div>
  )
}

const MobileDayDrawer = <TData extends RowData>({
  day,
  rows,
  renderEvent,
  noEventsLabel,
  itemCountLabel,
  dateFnsLocale,
  onOpenChange,
}: {
  day: Date | null
  rows: Row<TData>[] | undefined
  renderEvent?: (row: Row<TData>) => React.ReactNode
  noEventsLabel?: string
  itemCountLabel?: (count: number) => string
  dateFnsLocale?: Locale
  onOpenChange: (open: boolean) => void
}) => {
  const count = rows?.length ?? 0
  const fmtOpts = dateFnsLocale ? { locale: dateFnsLocale } : undefined
  return (
    <Drawer open={day !== null} onOpenChange={onOpenChange}>
      <DrawerContent>
        {day && (
          <>
            <DrawerHeader>
              <DrawerTitle>
                {format(day, 'EEE d MMM yyyy', fmtOpts)}
              </DrawerTitle>
              <DrawerDescription>
                {itemCountLabel?.(count) ??
                  `${count} ${count === 1 ? 'item' : 'items'}`}
              </DrawerDescription>
            </DrawerHeader>
            <div className='overflow-y-auto px-4 pb-4'>
              <div className='space-y-1'>
                {rows?.map(row => (
                  <div key={row.id}>
                    {renderEvent?.(row) ?? (
                      <p className='text-muted-foreground text-sm'>
                        {noEventsLabel ?? `Row ${row.index + 1}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

export { DataTableCalendarView }
export type {
  CalendarDateField,
  DataTableCalendarConfig,
  DataTableCalendarViewLabels,
  DataTableCalendarViewProps,
}
