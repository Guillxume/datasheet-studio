'use client'

import type { RowData } from '@tanstack/react-table'
import { format } from 'date-fns'
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  EllipsisVerticalIcon,
  EyeOffIcon,
  FunnelIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { useDateLocale } from '../hooks/use-date-locale'
import { Badge } from './badge'
import { Calendar, type DateRange } from './calendar'
import { useDataTable } from './data-table-context'
import { getTypedFilterValue, type Column } from './data-table-types'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Input } from './input'
import { TimePicker } from './time-picker'

// ---------------------------------------------------------------------------
// Labels type (owned here, re-exported from data-table-column-header.tsx)
// ---------------------------------------------------------------------------

type DataTableColumnHeaderLabels = {
  columnOptions?: string
  columnOptionsFiltered?: string
  sortAscending?: string
  sortDescending?: string
  moveLeft?: string
  moveRight?: string
  unpinColumn?: string
  pinLeft?: string
  pinRight?: string
  hideColumn?: string
  filter?: string
  clearFilter?: string
  search?: string
  facetedFilterSearchLabel?: string
  from?: string
  to?: string
  min?: string
  max?: string
  numberMinLabel?: string
  numberMaxLabel?: string
  only?: string
  tooltipInfo?: string
}

// ---------------------------------------------------------------------------
// Utility helpers (used by DateFilterSubmenu)
// ---------------------------------------------------------------------------

const fromIso = (str: string | undefined): Date | undefined => {
  if (!str) return undefined
  const d = new Date(str)
  return Number.isNaN(d.getTime()) ? undefined : d
}

const applyTime = (date: Date | undefined, time: string): Date | undefined => {
  if (!date) return undefined
  const [hh, mm] = time.split(':').map(Number)
  const d = new Date(date)
  d.setHours(hh, mm, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ColumnHeaderMenuProps<TData extends RowData, TValue> = {
  column: Column<TData, TValue>
  title: string
  labels?: DataTableColumnHeaderLabels
  align?: 'start' | 'end'
}

// ---------------------------------------------------------------------------
// FacetedFilterSubmenu
// ---------------------------------------------------------------------------

const FacetedFilterSubmenu = <TData extends RowData, TValue>({
  column,
  title,
  labels,
}: {
  column: Column<TData, TValue>
  title: string
  labels?: DataTableColumnHeaderLabels
}) => {
  const facetedValues = column.getFacetedUniqueValues()
  const facetedFilterValue = getTypedFilterValue(column, 'faceted')
  const isFiltered = column.getIsFiltered()
  const renderValue = column.columnDef.meta?.renderFilterValue
  const [filterSearch, setFilterSearch] = useState('')

  const toggleFacetedValue = (value: string) => {
    const current = facetedFilterValue ?? []
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    column.setFilterValue(next.length > 0 ? next : undefined)
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <FunnelIcon className='text-muted-foreground' />
          {labels?.filter ?? 'Filter'}
          {isFiltered && facetedFilterValue && (
            <Badge
              variant='secondary'
              className='ml-auto text-[10px] leading-none px-1 py-0.5 font-normal'>
              {facetedFilterValue.length}
            </Badge>
          )}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className='min-w-[180px]'>
          <div className='relative px-1 pb-1'>
            <SearchIcon className='text-muted-foreground absolute inset-y-0 left-3 my-auto size-3.5' />
            <Input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className='h-7 pl-7 text-xs'
              placeholder={labels?.search ?? 'Search...'}
              aria-label={
                labels?.facetedFilterSearchLabel ??
                labels?.search ??
                `Search ${title} filter values`
              }
              onKeyDown={e => e.stopPropagation()}
            />
          </div>
          <DropdownMenuSeparator />
          {[...facetedValues.entries()]
            .sort(([a], [b]) => String(a).localeCompare(String(b)))
            .filter(
              ([value]) =>
                !filterSearch ||
                String(value)
                  .toLowerCase()
                  .includes(filterSearch.toLowerCase()),
            )
            .map(([value]) => {
              const selected = (facetedFilterValue ?? []).includes(
                String(value),
              )
              return (
                <DropdownMenuCheckboxItem
                  key={String(value)}
                  checked={selected}
                  onCheckedChange={() => toggleFacetedValue(String(value))}
                  onSelect={e => e.preventDefault()}>
                  {renderValue ? renderValue(value) : String(value)}
                </DropdownMenuCheckboxItem>
              )
            })}
          {isFiltered && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => column.setFilterValue(undefined)}>
                {labels?.clearFilter ?? 'Clear filter'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}

// ---------------------------------------------------------------------------
// NumberFilterSubmenu
// ---------------------------------------------------------------------------

const NumberFilterSubmenu = <TData extends RowData, TValue>({
  column,
  title,
  labels,
}: {
  column: Column<TData, TValue>
  title: string
  labels?: DataTableColumnHeaderLabels
}) => {
  const isFiltered = column.getIsFiltered()
  const filterValue = column.getFilterValue()
  const numberFilterValue = getTypedFilterValue(column, 'number')
  const [numberMin, setNumberMin] = useState<string>(
    numberFilterValue?.[0] !== undefined ? String(numberFilterValue[0]) : '',
  )
  const [numberMax, setNumberMax] = useState<string>(
    numberFilterValue?.[1] !== undefined ? String(numberFilterValue[1]) : '',
  )

  useEffect(() => {
    const timeout = setTimeout(() => {
      const parsedMin = Number(numberMin)
      const parsedMax = Number(numberMax)
      const minVal =
        numberMin !== '' && Number.isFinite(parsedMin) ? parsedMin : undefined
      const maxVal =
        numberMax !== '' && Number.isFinite(parsedMax) ? parsedMax : undefined
      if (minVal === undefined && maxVal === undefined) {
        column.setFilterValue(undefined)
      } else {
        column.setFilterValue([minVal, maxVal])
      }
    }, 200)
    return () => clearTimeout(timeout)
  }, [numberMin, numberMax, column])

  useEffect(() => {
    if (!filterValue) {
      setNumberMin('')
      setNumberMax('')
    }
  }, [filterValue])

  const numberRangeLabel =
    numberFilterValue &&
    [numberFilterValue[0], numberFilterValue[1]]
      .filter(v => v !== undefined)
      .map(String)
      .join(' – ')

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <FunnelIcon className='text-muted-foreground' />
          {labels?.filter ?? 'Filter'}
          {isFiltered && numberRangeLabel && (
            <Badge
              variant='secondary'
              className='ml-auto text-[10px] leading-none px-1 py-0.5 font-normal'>
              {numberRangeLabel}
            </Badge>
          )}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className='w-[200px] p-2'>
          <div className='space-y-2'>
            <div className='space-y-1'>
              <span className='text-muted-foreground text-xs'>
                {labels?.from ?? 'From'}
              </span>
              <Input
                numberStepper
                value={numberMin}
                onChange={e => setNumberMin(e.target.value)}
                placeholder={labels?.min ?? 'Min'}
                aria-label={labels?.numberMinLabel ?? `${title} minimum`}
                onKeyDown={e => e.stopPropagation()}
              />
            </div>
            <div className='space-y-1'>
              <span className='text-muted-foreground text-xs'>
                {labels?.to ?? 'To'}
              </span>
              <Input
                numberStepper
                value={numberMax}
                onChange={e => setNumberMax(e.target.value)}
                placeholder={labels?.max ?? 'Max'}
                aria-label={labels?.numberMaxLabel ?? `${title} maximum`}
                onKeyDown={e => e.stopPropagation()}
              />
            </div>
            {isFiltered && (
              <DropdownMenuItem
                className='justify-center'
                onClick={() => column.setFilterValue(undefined)}>
                {labels?.clearFilter ?? 'Clear filter'}
              </DropdownMenuItem>
            )}
          </div>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}

// ---------------------------------------------------------------------------
// DateFilterSubmenu
// ---------------------------------------------------------------------------

const DateFilterSubmenu = <TData extends RowData, TValue>({
  column,
  title,
  labels,
  showDateCalendar,
  setShowDateCalendar,
}: {
  column: Column<TData, TValue>
  title: string
  labels?: DataTableColumnHeaderLabels
  showDateCalendar: boolean
  setShowDateCalendar: (show: boolean) => void
}) => {
  const isFiltered = column.getIsFiltered()
  const dateFilterValue = getTypedFilterValue(column, 'date')
  const dateFnsLocale = useDateLocale()
  const fmtOpts = { locale: dateFnsLocale }

  const dateRange: DateRange | undefined = dateFilterValue
    ? {
        from: fromIso(dateFilterValue[0]),
        to: fromIso(dateFilterValue[1]),
      }
    : undefined

  const [dateFromTime, setDateFromTime] = useState(() => {
    const d = fromIso(dateFilterValue?.[0])
    return d ? format(d, 'HH:mm', fmtOpts) : '00:00'
  })
  const [dateToTime, setDateToTime] = useState(() => {
    const d = fromIso(dateFilterValue?.[1])
    return d ? format(d, 'HH:mm', fmtOpts) : '23:59'
  })

  useEffect(() => {
    if (!dateFilterValue) {
      setDateFromTime('00:00')
      setDateToTime('23:59')
    } else {
      const opts = { locale: dateFnsLocale }
      const fromDate = fromIso(dateFilterValue[0])
      const toDate = fromIso(dateFilterValue[1])
      if (fromDate) setDateFromTime(format(fromDate, 'HH:mm', opts))
      if (toDate) setDateToTime(format(toDate, 'HH:mm', opts))
    }
  }, [dateFilterValue?.[0], dateFilterValue?.[1], dateFnsLocale])

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from && !range?.to) {
      column.setFilterValue(undefined)
    } else {
      const from = applyTime(range?.from, dateFromTime)
      const to = applyTime(range?.to, dateToTime)
      column.setFilterValue([from?.toISOString(), to?.toISOString()])
    }
  }

  const handleDateFromTimeChange = (time: string) => {
    setDateFromTime(time)
    if (dateFilterValue?.[0]) {
      const updated = applyTime(fromIso(dateFilterValue[0]), time)
      column.setFilterValue([updated?.toISOString(), dateFilterValue[1]])
    }
  }

  const handleDateToTimeChange = (time: string) => {
    setDateToTime(time)
    if (dateFilterValue?.[1]) {
      const updated = applyTime(fromIso(dateFilterValue[1]), time)
      column.setFilterValue([dateFilterValue[0], updated?.toISOString()])
    }
  }

  const clearDateFilter = () => {
    column.setFilterValue(undefined)
    setDateFromTime('00:00')
    setDateToTime('23:59')
  }

  const dateRangeLabel =
    dateFilterValue &&
    [dateFilterValue[0], dateFilterValue[1]]
      .filter((v): v is string => !!v)
      .flatMap(v => {
        const d = fromIso(v)
        return d ? [format(d, 'LLL dd, y HH:mm', fmtOpts)] : []
      })
      .join(' – ')

  return (
    <>
      <DropdownMenuSeparator />
      {!showDateCalendar ? (
        <DropdownMenuItem
          onSelect={e => {
            e.preventDefault()
            setShowDateCalendar(true)
          }}>
          <FunnelIcon className='text-muted-foreground' />
          {labels?.filter ?? 'Filter'}
          {isFiltered && dateRangeLabel && (
            <Badge
              variant='secondary'
              className='ml-auto text-[10px] leading-none px-1 py-0.5 font-normal'>
              {dateRangeLabel}
            </Badge>
          )}
        </DropdownMenuItem>
      ) : (
        <div className='p-0'>
          <Calendar
            mode='range'
            selected={dateRange}
            onSelect={handleDateRangeSelect}
            numberOfMonths={1}
          />
          <div className='border-t p-2'>
            <div className='flex items-center gap-2'>
              <div className='flex flex-1 flex-col gap-1'>
                <span className='text-muted-foreground text-xs'>
                  {labels?.from ?? 'From'}
                </span>
                <TimePicker
                  value={dateFromTime}
                  onValueChange={handleDateFromTimeChange}
                  disabled={!dateFilterValue?.[0]}
                  aria-label={`${title} from time`}
                  className='h-7 text-xs'
                />
              </div>
              <span
                className='text-muted-foreground mt-5 text-xs'
                aria-hidden='true'>
                –
              </span>
              <div className='flex flex-1 flex-col gap-1'>
                <span className='text-muted-foreground text-xs'>
                  {labels?.to ?? 'To'}
                </span>
                <TimePicker
                  value={dateToTime}
                  onValueChange={handleDateToTimeChange}
                  disabled={!dateFilterValue?.[1]}
                  aria-label={`${title} to time`}
                  className='h-7 text-xs'
                />
              </div>
            </div>
            {isFiltered && (
              <DropdownMenuItem
                className='mt-2 justify-center'
                onClick={clearDateFilter}>
                {labels?.clearFilter ?? 'Clear filter'}
              </DropdownMenuItem>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// SwitchFilterSubmenu
// ---------------------------------------------------------------------------

const SwitchFilterSubmenu = <TData extends RowData, TValue>({
  column,
  title,
  labels,
}: {
  column: Column<TData, TValue>
  title: string
  labels?: DataTableColumnHeaderLabels
}) => {
  const filterValue = column.getFilterValue()

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <FunnelIcon className='text-muted-foreground' />
          {labels?.filter ?? 'Filter'}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuCheckboxItem
            checked={!!filterValue}
            onCheckedChange={checked =>
              column.setFilterValue(checked || undefined)
            }
            onSelect={e => e.preventDefault()}>
            {labels?.only ?? `Only ${title.toLowerCase()}`}
          </DropdownMenuCheckboxItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}

// ---------------------------------------------------------------------------
// ColumnHeaderMenu (main export)
// ---------------------------------------------------------------------------

const ColumnHeaderMenu = <TData extends RowData, TValue>({
  column,
  title,
  labels,
  align,
}: ColumnHeaderMenuProps<TData, TValue>) => {
  const table = useDataTable<TData>()
  const canSort = column.getCanSort()
  const canHide = column.getCanHide()

  const meta = column.columnDef.meta
  const pinned = column.getIsPinned()
  const canPin = meta?.pinnable !== false && column.getCanPin()
  const filterable = meta?.filterable
  const isFiltered = column.getIsFiltered()

  // Column reordering: find position among draggable columns
  const draggableColumns = table.getAllLeafColumns().filter(c => {
    const cMeta = c.columnDef.meta
    return cMeta?.reorderable !== false && !c.getIsPinned() && c.getIsVisible()
  })
  const columnIndex = draggableColumns.findIndex(c => c.id === column.id)
  const canMoveLeft = columnIndex > 0
  const canMoveRight =
    columnIndex >= 0 && columnIndex < draggableColumns.length - 1
  const canMove = !pinned && (canMoveLeft || canMoveRight)

  const moveColumn = (direction: 'left' | 'right') => {
    const allColumns = table.getAllLeafColumns().map(c => c.id)
    const currentIndex = allColumns.indexOf(column.id)
    const targetDraggableIndex =
      direction === 'left' ? columnIndex - 1 : columnIndex + 1
    const targetColumnId = draggableColumns[targetDraggableIndex]?.id
    if (!targetColumnId) return
    const targetIndex = allColumns.indexOf(targetColumnId)
    const newOrder = [...allColumns]
    newOrder[currentIndex] = targetColumnId
    newOrder[targetIndex] = column.id
    table.setColumnOrder(newOrder)
  }

  // Date filter needs calendar toggle state at this level
  // because it affects the DropdownMenu onOpenChange handler
  const [showDateCalendar, setShowDateCalendar] = useState(false)

  return (
    <DropdownMenu onOpenChange={open => !open && setShowDateCalendar(false)}>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='hover:bg-accent relative before:absolute before:-inset-[3px] -mr-1.5 shrink-0 cursor-pointer overflow-visible rounded-sm p-0.5 opacity-50 hover:opacity-100'>
          <EllipsisVerticalIcon size={14} aria-hidden='true' />
          {isFiltered && (
            <span className='bg-primary absolute -top-0.5 -right-0.5 size-1.5 rounded-full' />
          )}
          <span className='sr-only'>
            {isFiltered
              ? (labels?.columnOptionsFiltered ?? 'Column options (filtered)')
              : (labels?.columnOptions ?? 'Column options')}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align ?? 'start'}>
        {canSort && (
          <>
            <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
              <ArrowUpIcon className='text-muted-foreground' />
              {labels?.sortAscending ?? 'Sort ascending'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
              <ArrowDownIcon className='text-muted-foreground' />
              {labels?.sortDescending ?? 'Sort descending'}
            </DropdownMenuItem>
          </>
        )}
        {canSort && (canMove || canPin || canHide) && <DropdownMenuSeparator />}
        {canMove && (
          <>
            <DropdownMenuItem
              disabled={!canMoveLeft}
              onClick={() => moveColumn('left')}>
              <ArrowLeftIcon className='text-muted-foreground' />
              {labels?.moveLeft ?? 'Move left'}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canMoveRight}
              onClick={() => moveColumn('right')}>
              <ArrowRightIcon className='text-muted-foreground' />
              {labels?.moveRight ?? 'Move right'}
            </DropdownMenuItem>
          </>
        )}
        {canMove && (canPin || canHide) && <DropdownMenuSeparator />}
        {canPin &&
          (pinned ? (
            <DropdownMenuItem onClick={() => column.pin(false)}>
              <PinOffIcon className='text-muted-foreground' />
              {labels?.unpinColumn ?? 'Unpin column'}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={() => column.pin('start')}>
                <PinIcon className='text-muted-foreground' />
                {labels?.pinLeft ?? 'Pin left'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.pin('end')}>
                <PinIcon className='text-muted-foreground rotate-90' />
                {labels?.pinRight ?? 'Pin right'}
              </DropdownMenuItem>
            </>
          ))}
        {(canMove || canPin) && canHide && <DropdownMenuSeparator />}
        {canHide && (
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOffIcon className='text-muted-foreground' />
            {labels?.hideColumn ?? 'Hide column'}
          </DropdownMenuItem>
        )}
        {filterable === 'faceted' && (
          <FacetedFilterSubmenu column={column} title={title} labels={labels} />
        )}
        {filterable === 'switch' && (
          <SwitchFilterSubmenu column={column} title={title} labels={labels} />
        )}
        {filterable === 'number' && (
          <NumberFilterSubmenu column={column} title={title} labels={labels} />
        )}
        {filterable === 'date' && (
          <DateFilterSubmenu
            column={column}
            title={title}
            labels={labels}
            showDateCalendar={showDateCalendar}
            setShowDateCalendar={setShowDateCalendar}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ColumnHeaderMenu }
export type { DataTableColumnHeaderLabels }
