'use client'

import type { RowData } from '@tanstack/react-table'
import { CheckIcon, FunnelIcon, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../lib/utils'
import { Badge } from './badge'
import { Button } from './button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './command'
import { useResolveColumn } from './data-table-context'
import { useFilterInteractionReporter } from './data-table-filter-interaction'
import { type Column, getTypedFilterValue } from './data-table-types'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Separator } from './separator'
import { Spinner } from './spinner'

type FilterOption = {
  label: string
  value: string
  icon?: ReactNode
  render?: ReactNode
}

type DataTableFacetedFilterLabels = {
  noResults?: string
  clearFilters?: string
  selected?: string
  loading?: string
}

type DataTableFacetedFilterProps<TData extends RowData, TValue> = {
  title: string
  options?: FilterOption[]
  icon?: ReactNode
  labels?: DataTableFacetedFilterLabels
  className?: string
  /** Shows a spinner in place of the empty state while the options are being
   * fetched (e.g. lazily loaded on first open). */
  loading?: boolean
  onFilterChange?: (values: string[]) => void
  /** Called when the filter popover opens or closes. Enables lazy-loading the
   * options on first interaction rather than on mount. */
  onOpenChange?: (open: boolean) => void
} & (
  | { column: Column<TData, TValue>; columnId?: never }
  | { columnId: string; column?: never }
)

function DataTableFacetedFilter<TData extends RowData, TValue>({
  column: columnProp,
  columnId,
  title,
  options: optionsProp,
  icon,
  labels,
  className,
  loading,
  onFilterChange,
  onOpenChange,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const resolvedColumn = useResolveColumn<TData>(columnId)
  // biome-ignore lint/style/noNonNullAssertion: discriminated union guarantees one of columnProp or resolvedColumn is defined
  const column = (columnProp ?? resolvedColumn)!
  const facets = column.getFacetedUniqueValues()
  const filterValue = getTypedFilterValue(column, 'faceted')
  const selected = new Set(filterValue ?? [])

  const renderValue = column.columnDef.meta?.renderFilterValue
  const baseOptions: FilterOption[] =
    optionsProp ??
    Array.from(facets.keys())
      .sort()
      .map(value => ({
        label: String(value),
        value: String(value),
        render: renderValue?.(value),
      }))

  // Include unknown selected values (e.g. stale URL params) so they remain
  // visible and removable in both the trigger badges and the popover list.
  const knownValues = new Set(baseOptions.map(o => o.value))
  const unknownOptions: FilterOption[] = [...selected]
    .filter(v => !knownValues.has(v))
    .map(v => ({ label: v, value: v }))
  const options: FilterOption[] =
    unknownOptions.length > 0
      ? [...unknownOptions, ...baseOptions]
      : baseOptions

  // URL-selected unknown values are placeholders, not resolved options, so the
  // spinner must key off whether real options have loaded rather than the total
  // option count (which is non-zero as soon as a bookmarked filter is active).
  const hasResolvedOptions = options.length > unknownOptions.length

  const reportOpenChange = useFilterInteractionReporter(
    columnProp?.id ?? columnId,
  )

  const handleOpenChange = (open: boolean) => {
    reportOpenChange(open)
    onOpenChange?.(open)
  }

  const applyFilter = (next: Set<string>) => {
    const values = Array.from(next)
    column.setFilterValue(next.size > 0 ? values : undefined)
    onFilterChange?.(values)
  }

  const toggle = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    applyFilter(next)
  }

  const clear = () => {
    column.setFilterValue(undefined)
    onFilterChange?.([])
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className={cn(className)}>
          {icon ?? <FunnelIcon aria-hidden='true' />}
          {title}
          {selected.size > 0 && (
            <>
              <Separator orientation='vertical' className='mx-0.5 h-4' />
              <Badge variant='secondary' className='sm:hidden'>
                {selected.size}
              </Badge>
              <div className='max-sm:hidden flex gap-1'>
                {selected.size <= 2 ? (
                  options
                    .filter(o => selected.has(o.value))
                    .map(o => (
                      <Badge key={o.value} variant='secondary'>
                        {o.label}
                        {/* biome-ignore lint/a11y/useSemanticElements: cannot nest <button> inside the trigger <button> */}
                        <span
                          role='button'
                          tabIndex={0}
                          aria-label={`Remove ${o.label}`}
                          className='text-current/60 hover:text-current -me-1 ms-0.5 relative before:absolute before:-inset-[5px] inline-flex size-3.5 shrink-0 items-center justify-center rounded-full'
                          onClick={e => {
                            e.stopPropagation()
                            toggle(o.value)
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              toggle(o.value)
                            }
                          }}>
                          <XIcon aria-hidden='true' className='size-3' />
                        </span>
                      </Badge>
                    ))
                ) : (
                  <Badge variant='secondary'>
                    {selected.size} {labels?.selected ?? 'selected'}
                  </Badge>
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[200px] p-0' align='start'>
        <Command>
          <CommandInput placeholder={`Search ${title.toLowerCase()}...`} />
          <CommandList>
            {loading && !hasResolvedOptions ? (
              <div className='text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm'>
                <Spinner size='sm' />
                <span>{labels?.loading ?? 'Loading…'}</span>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {labels?.noResults ?? 'No results.'}
                </CommandEmpty>
                <CommandGroup>
                  {options.map(option => {
                    const isSelected = selected.has(option.value)

                    return (
                      <CommandItem
                        key={option.value}
                        onSelect={() => toggle(option.value)}>
                        <div
                          className={cn(
                            'border-primary flex size-4 shrink-0 items-center justify-center rounded-sm border',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'opacity-50 [&_svg]:invisible',
                          )}>
                          <CheckIcon aria-hidden='true' className='size-3' />
                        </div>
                        {option.render ?? (
                          <>
                            {option.icon}
                            <span>{option.label}</span>
                          </>
                        )}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                {selected.size > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={clear}
                        className='justify-center text-center'>
                        {labels?.clearFilters ?? 'Clear filters'}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { DataTableFacetedFilter }
export type {
  DataTableFacetedFilterLabels,
  DataTableFacetedFilterProps,
  FilterOption,
}
