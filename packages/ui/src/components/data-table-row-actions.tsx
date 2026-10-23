'use client'

import type { RowData } from '@tanstack/react-table'
import { EllipsisIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

import { cn } from '../lib/utils'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import type { Row } from './data-table-types'

type RowAction<TData extends RowData> = {
  label: string
  icon?: ReactNode
  onClick: (row: Row<TData>) => void
  color?: 'default' | 'destructive'
  separator?: boolean
}

type DataTableRowActionsProps<TData extends RowData> = {
  row: Row<TData>
  actions: RowAction<TData>[]
  quickActions?: ReactNode
  rowActionsLabel?: string
  className?: string
}

function DataTableRowActions<TData extends RowData>({
  row,
  actions,
  quickActions,
  rowActionsLabel,
  className,
}: DataTableRowActionsProps<TData>) {
  return (
    <div
      data-slot='data-table-row-actions'
      className={cn('flex justify-end', className)}>
      {quickActions}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='size-8'
            aria-label={rowActionsLabel ?? 'Row actions'}>
            <EllipsisIcon aria-hidden='true' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {actions.map((action, index) => (
            <Fragment key={action.label}>
              {action.separator && index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant={
                  action.color === 'destructive' ? 'destructive' : undefined
                }
                onClick={() => action.onClick(row)}>
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export { DataTableRowActions }
export type { DataTableRowActionsProps, RowAction }
