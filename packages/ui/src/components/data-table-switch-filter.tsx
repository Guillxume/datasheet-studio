'use client'

import type { RowData } from '@tanstack/react-table'
import type { ReactNode } from 'react'

import { cn } from '../lib/utils'
import { Button } from './button'
import { useResolveColumn } from './data-table-context'
import type { Column } from './data-table-types'

type DataTableSwitchFilterProps<TData extends RowData, TValue> = {
  label: string
  icon?: ReactNode
  className?: string
  onFilterChange?: (value: boolean) => void
} & (
  | { column: Column<TData, TValue>; columnId?: never }
  | { columnId: string; column?: never }
)

function DataTableSwitchFilter<TData extends RowData, TValue>({
  column: columnProp,
  columnId,
  label,
  icon,
  className,
  onFilterChange,
}: DataTableSwitchFilterProps<TData, TValue>) {
  const resolvedColumn = useResolveColumn<TData>(columnId)
  // biome-ignore lint/style/noNonNullAssertion: discriminated union guarantees one of columnProp or resolvedColumn is defined
  const column = (columnProp ?? resolvedColumn)!
  const isActive = column.getFilterValue() === true

  const handleClick = () => {
    const next = !isActive
    column.setFilterValue(next || undefined)
    onFilterChange?.(next)
  }

  return (
    <Button
      data-slot='data-table-switch-filter'
      variant='outline'
      size='sm'
      aria-pressed={isActive}
      className={cn(className)}
      onClick={handleClick}>
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-4 w-6.5 shrink-0 rounded-full border border-transparent shadow-xs transition-colors duration-150',
          isActive ? 'bg-primary' : 'bg-input',
        )}>
        <span
          className={cn(
            'bg-background pointer-events-none absolute top-0 block size-3.5 rounded-full ring-0 transition-[left] duration-150',
            isActive ? 'left-[10px]' : 'left-0',
          )}
        />
      </span>
      {icon}
      {label}
    </Button>
  )
}

export { DataTableSwitchFilter }
export type { DataTableSwitchFilterProps }
