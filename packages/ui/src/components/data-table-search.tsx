'use client'

import { SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../lib/utils'
import { useDataTable } from './data-table-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

type SearchableColumn = {
  id: string
  label: string
}

type DataTableSearchProps = {
  columns: SearchableColumn[]
  placeholder?: string
  searchColumnLabel?: string
  className?: string
  /** Controlled search value (from URL state). */
  value?: string
  /** Called with the debounced search value (controlled mode). */
  onValueChange?: (value: string) => void
  /** Controlled active column ID (from URL state). */
  activeColumn?: string
  /** Called when the user switches the search column (controlled mode). */
  onActiveColumnChange?: (columnId: string) => void
}

const DataTableSearch = ({
  columns,
  placeholder,
  searchColumnLabel,
  className,
  value: controlledValue,
  onValueChange,
  activeColumn: controlledActiveColumn,
  onActiveColumnChange,
}: DataTableSearchProps) => {
  const table = useDataTable()
  const isControlled = onValueChange !== undefined

  // --- Active column ---
  const [localActiveColumn, setLocalActiveColumn] = useState(
    columns[0]?.id ?? '',
  )

  const resolveActiveColumn = (): string => {
    if (controlledActiveColumn === undefined) return localActiveColumn
    if (columns.some(c => c.id === controlledActiveColumn))
      return controlledActiveColumn
    return columns[0]?.id ?? ''
  }

  const activeColumn = resolveActiveColumn()

  // Keep local activeColumn in sync when columns change (uncontrolled only)
  useEffect(() => {
    if (controlledActiveColumn !== undefined) return
    setLocalActiveColumn(prev =>
      columns.length > 0 && !columns.some(c => c.id === prev)
        ? (columns[0]?.id ?? '')
        : prev,
    )
  }, [columns, controlledActiveColumn])

  // --- Input value (always local for debounce) ---
  const [inputValue, setInputValue] = useState(controlledValue ?? '')

  // The value the owner already holds: reporting it again would rewrite the URL for nothing.
  const reportedValue = useRef(controlledValue ?? '')

  // Sync input when controlled value changes externally (e.g. browser back)
  useEffect(() => {
    if (controlledValue !== undefined) {
      reportedValue.current = controlledValue
      setInputValue(controlledValue)
    }
  }, [controlledValue])

  const activeLabel =
    columns.find(c => c.id === activeColumn)?.label ?? activeColumn

  // useTable hands out a new table object every render and callers may pass inline
  // callbacks; read the latest ones through a ref so the debounce only restarts when
  // the search itself changes. With them as dependencies the timer was re-armed on
  // every render and reported the same value forever (an endless URL rewrite that
  // discards any navigation slower than the debounce).
  const latest = useRef({ table, onValueChange, onActiveColumnChange })
  latest.current = { table, onValueChange, onActiveColumnChange }

  // Debounce and propagate value
  useEffect(() => {
    const timeout = setTimeout(() => {
      const current = latest.current
      if (isControlled) {
        // Ensure the resolved column is persisted in the URL
        if (
          activeColumn !== controlledActiveColumn &&
          current.onActiveColumnChange
        ) {
          current.onActiveColumnChange(activeColumn)
        }
        if (inputValue === reportedValue.current) return
        reportedValue.current = inputValue
        current.onValueChange?.(inputValue)
      } else {
        const column = current.table.getColumn(activeColumn)
        if (!column) return

        if (!inputValue) {
          column.setFilterValue(undefined)
          return
        }

        const meta = column.columnDef.meta

        if (meta?.filterable === 'faceted') {
          const faceted = column.getFacetedUniqueValues()
          if (faceted.size === 0) {
            // Manual filtering mode — pass raw search string to server
            column.setFilterValue(inputValue)
          } else {
            // Client-side — match against faceted values
            const matching = [...faceted.keys()].filter(v =>
              String(v).toLowerCase().includes(inputValue.toLowerCase()),
            )
            column.setFilterValue(matching.length > 0 ? matching : undefined)
          }
        } else {
          column.setFilterValue(inputValue)
        }
      }
    }, 200)
    return () => clearTimeout(timeout)
  }, [inputValue, activeColumn, controlledActiveColumn, isControlled])

  if (columns.length === 0) return null

  // --- Single column: plain input, no dropdown ---
  if (columns.length === 1) {
    return (
      <div
        data-slot='data-table-search'
        className={cn('flex items-center', className)}>
        <div className='relative grow'>
          <SearchIcon className='text-muted-foreground pointer-events-none absolute inset-y-0 left-2.5 my-auto size-4' />
          <input
            data-slot='input'
            type='search'
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={placeholder ?? `Search ${activeLabel}...`}
            aria-label={placeholder ?? `Search ${activeLabel}`}
            className='border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-[160px] rounded-md border bg-transparent pl-8 pr-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px]'
          />
        </div>
      </div>
    )
  }

  const handleColumnChange = (columnId: string) => {
    if (onActiveColumnChange) {
      onActiveColumnChange(columnId)
      onValueChange?.('')
      reportedValue.current = ''
    } else {
      // Uncontrolled: clear filter on previous column
      const prevColumn = table.getColumn(activeColumn)
      prevColumn?.setFilterValue(undefined)
      setLocalActiveColumn(columnId)
    }
    setInputValue('')
  }

  // --- Multiple columns: dropdown + input ---
  return (
    <div
      data-slot='data-table-search'
      className={cn('flex items-center', className)}>
      <Select value={activeColumn} onValueChange={handleColumnChange}>
        <SelectTrigger
          size='sm'
          aria-label={searchColumnLabel ?? 'Search column'}
          className='rounded-r-none border-r-0 focus-visible:z-10'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columns.map(col => (
            <SelectItem key={col.id} value={col.id}>
              {col.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className='relative grow'>
        <SearchIcon className='text-muted-foreground pointer-events-none absolute inset-y-0 left-2.5 my-auto size-4' />
        <input
          data-slot='input'
          type='search'
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={placeholder ?? `Search ${activeLabel}...`}
          aria-label={placeholder ?? `Search ${activeLabel}`}
          className='border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-[160px] rounded-r-md border bg-transparent pl-8 pr-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:z-10 focus-visible:ring-[3px]'
        />
      </div>
    </div>
  )
}

export { DataTableSearch }
export type { DataTableSearchProps, SearchableColumn }
