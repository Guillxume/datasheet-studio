'use client'

import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { useId } from 'react'

import { Button } from './button'
import { useDataTable } from './data-table-context'
import { Label } from './label'
import { Pagination, PaginationContent, PaginationItem } from './pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

type DataTablePaginationLabels = {
  rowsPerPage?: string
  of?: string
  rowsSelected?: string
  goToFirstPage?: string
  goToPreviousPage?: string
  goToNextPage?: string
  goToLastPage?: string
}

type DataTablePaginationProps = {
  pageSizeOptions?: number[]
  labels?: DataTablePaginationLabels
}

const DataTablePagination = ({
  pageSizeOptions = [15, 30, 50, 100],
  labels,
}: DataTablePaginationProps) => {
  const table = useDataTable()
  const id = useId()
  const { pageIndex, pageSize } = table.state.pagination
  const totalRows = table.getRowCount()
  const selectedRows = table.getFilteredSelectedRowModel().rows.length

  // A table that starts with a size missing from the options (TanStack's
  // default is 10) would leave the select empty, so the current size is listed.
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b)

  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const end = totalRows === 0 ? 0 : Math.min(start + pageSize - 1, totalRows)

  return (
    <div
      data-slot='data-table-pagination'
      className='flex items-center justify-between gap-4 sm:gap-8'>
      <div className='flex items-center gap-3'>
        <Label
          htmlFor={id}
          className='max-sm:sr-only text-sm whitespace-nowrap'>
          {labels?.rowsPerPage ?? 'Rows per page'}
        </Label>
        <Select
          value={pageSize.toString()}
          onValueChange={value => table.setPageSize(Number(value))}>
          <SelectTrigger id={id} className='w-fit whitespace-nowrap'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map(size => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='text-muted-foreground flex grow justify-end text-sm whitespace-nowrap'>
        {selectedRows > 0 ? (
          <p aria-live='polite'>
            <span className='text-foreground'>{selectedRows}</span>{' '}
            {labels?.of ?? 'of'}{' '}
            <span className='text-foreground'>{totalRows}</span>{' '}
            {labels?.rowsSelected ?? 'row(s) selected'}
          </p>
        ) : (
          <p aria-live='polite'>
            <span className='text-foreground'>
              {start}-{end}
            </span>{' '}
            {labels?.of ?? 'of'}{' '}
            <span className='text-foreground'>{totalRows}</span>
          </p>
        )}
      </div>

      <Pagination className='mx-0 w-auto'>
        <PaginationContent>
          <PaginationItem>
            <Button
              size='icon'
              variant='outline'
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label={labels?.goToFirstPage ?? 'Go to first page'}>
              <ChevronFirstIcon aria-hidden='true' />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              size='icon'
              variant='outline'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label={labels?.goToPreviousPage ?? 'Go to previous page'}>
              <ChevronLeftIcon aria-hidden='true' />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              size='icon'
              variant='outline'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label={labels?.goToNextPage ?? 'Go to next page'}>
              <ChevronRightIcon aria-hidden='true' />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              size='icon'
              variant='outline'
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              aria-label={labels?.goToLastPage ?? 'Go to last page'}>
              <ChevronLastIcon aria-hidden='true' />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

export { DataTablePagination }
export type { DataTablePaginationLabels, DataTablePaginationProps }
