'use client'

import {
  Columns3Icon,
  RefreshCcwIcon,
  SaveIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'

import type { UseDataTableLayoutStateReturn } from '../hooks/use-data-table-layout-state'
import { cn } from '../lib/utils'
import { Button } from './button'
import { useDataTable } from './data-table-context'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Input } from './input'

type DataTableViewOptionsLabels = {
  toggleViewOptions?: string
  layout?: string
  searchColumns?: string
  searchColumnsLabel?: string
  saveLayout?: string
  clearSavedLayout?: string
  reset?: string
}

type DataTableViewOptionsProps = {
  className?: string
  labels?: DataTableViewOptionsLabels
  layoutState?: Pick<
    UseDataTableLayoutStateReturn,
    | 'isDirty'
    | 'hasSavedLayout'
    | 'saveLayout'
    | 'clearSavedLayout'
    | 'displayMode'
  >
}

const DataTableViewOptions = ({
  className,
  labels,
  layoutState,
}: DataTableViewOptionsProps) => {
  const table = useDataTable()
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div
      data-slot='data-table-view-options'
      className={cn('flex items-center', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            aria-label={labels?.toggleViewOptions ?? 'Toggle view options'}
            className='relative'>
            <Columns3Icon aria-hidden='true' /> {labels?.layout ?? 'Layout'}
            {layoutState?.isDirty && (
              <span className='bg-primary absolute -top-1 -right-1 size-2 rounded-full' />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {(layoutState?.displayMode ?? 'table') === 'table' && (
            <>
              <div className='relative'>
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='pl-8'
                  placeholder={labels?.searchColumns ?? 'Search columns...'}
                  aria-label={labels?.searchColumnsLabel ?? 'Search columns'}
                  onKeyDown={e => e.stopPropagation()}
                />
                <SearchIcon
                  aria-hidden='true'
                  className='absolute inset-y-0 left-2 my-auto size-4 opacity-50'
                />
              </div>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter(column => {
                  if (!column.getCanHide()) return false
                  if (!searchQuery) return true
                  const label = column.columnDef.meta?.label ?? column.id
                  return String(label)
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
                })
                .map(column => {
                  const label = column.columnDef.meta?.label ?? column.id
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={value =>
                        column.toggleVisibility(!!value)
                      }
                      onSelect={e => e.preventDefault()}>
                      {String(label)}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              <DropdownMenuSeparator />
            </>
          )}
          {layoutState?.isDirty && (
            <DropdownMenuItem onClick={layoutState.saveLayout}>
              <SaveIcon aria-hidden='true' className='size-4' />
              {labels?.saveLayout ?? 'Save layout'}
            </DropdownMenuItem>
          )}
          {layoutState?.hasSavedLayout && (
            <DropdownMenuItem onClick={layoutState.clearSavedLayout}>
              <Trash2Icon aria-hidden='true' className='size-4' />
              {labels?.clearSavedLayout ?? 'Clear saved layout'}
            </DropdownMenuItem>
          )}
          {layoutState &&
            (layoutState.isDirty || layoutState.hasSavedLayout) && (
              <DropdownMenuSeparator />
            )}
          <DropdownMenuItem
            onClick={() => {
              table.resetColumnVisibility()
              setSearchQuery('')
            }}>
            <RefreshCcwIcon aria-hidden='true' className='size-4' />
            {labels?.reset ?? 'Reset'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export { DataTableViewOptions }
export type { DataTableViewOptionsLabels, DataTableViewOptionsProps }
