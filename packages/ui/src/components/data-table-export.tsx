'use client'

import type { RowData } from '@tanstack/react-table'
import { DownloadIcon, FileJsonIcon, FileSpreadsheetIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../lib/utils'
import { Button } from './button'
import { useDataTable } from './data-table-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import type { Row } from './data-table-types'

type ExportFormat = 'csv' | 'json'

type ExportColumn = {
  id: string
  header: string
}

type ExportRowsOptions = {
  columns?: ExportColumn[]
  format?: ExportFormat
  filename?: string
  onExport?: (format: ExportFormat, rowCount: number) => void
}

type DataTableExportLabels = {
  export?: string
  exportCsv?: string
  exportJson?: string
}

type DataTableExportProps = {
  columns?: ExportColumn[]
  filename?: string
  formats?: ExportFormat[]
  onExport?: (format: ExportFormat, rowCount: number) => void
  labels?: DataTableExportLabels
  className?: string
}

const downloadBlob = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const formatTimestamp = () =>
  new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

const hasAccessor = (def: object) => 'accessorKey' in def || 'accessorFn' in def

const getColumnsFromRows = <TData extends RowData>(
  rows: Row<TData>[],
): ExportColumn[] => {
  if (rows.length === 0) return []
  return rows[0]
    .getAllCells()
    .filter(cell => hasAccessor(cell.column.columnDef))
    .map(cell => ({
      id: cell.column.id,
      header: cell.column.id,
    }))
}

const exportRows = <TData extends RowData>(
  rows: Row<TData>[],
  options?: ExportRowsOptions,
) => {
  if (rows.length === 0) return

  const { columns, format = 'csv', filename, onExport } = options ?? {}
  const exportColumns = columns ?? getColumnsFromRows(rows)
  const data = rows.map(row =>
    Object.fromEntries(
      exportColumns.map(col => [col.header, row.getValue(col.id)]),
    ),
  )
  const name = filename ?? `export-${formatTimestamp()}`

  if (format === 'csv') {
    const headers = exportColumns.map(c => c.header)
    const csvRows = data.map(row =>
      headers
        .map(h => {
          const val = String(row[h] ?? '')
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val
        })
        .join(','),
    )
    const csv = [headers.join(','), ...csvRows].join('\n')
    downloadBlob(csv, `${name}.csv`, 'text/csv;charset=utf-8;')
  } else {
    const json = JSON.stringify(data, null, 2)
    downloadBlob(json, `${name}.json`, 'application/json')
  }

  onExport?.(format, rows.length)
}

const DataTableExport = ({
  columns: columnsProp,
  filename,
  formats = ['csv', 'json'],
  onExport,
  labels,
  className,
}: DataTableExportProps) => {
  const table = useDataTable()

  const getExportColumns = (): ExportColumn[] => {
    if (columnsProp) return columnsProp
    return table
      .getAllLeafColumns()
      .filter(col => hasAccessor(col.columnDef))
      .map(col => ({
        id: col.id,
        header: col.id,
      }))
  }

  const handleExport = (format: ExportFormat) => {
    exportRows(table.getFilteredRowModel().rows, {
      columns: getExportColumns(),
      format,
      filename,
      onExport,
    })
  }

  const formatConfig: Record<ExportFormat, { label: string; icon: ReactNode }> =
    {
      csv: {
        label: labels?.exportCsv ?? 'Export as CSV',
        icon: <FileSpreadsheetIcon aria-hidden='true' />,
      },
      json: {
        label: labels?.exportJson ?? 'Export as JSON',
        icon: <FileJsonIcon aria-hidden='true' />,
      },
    }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className={cn(className)}
          data-slot='data-table-export'>
          <DownloadIcon aria-hidden='true' />
          {labels?.export ?? 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {formats.map(format => (
          <DropdownMenuItem key={format} onClick={() => handleExport(format)}>
            {formatConfig[format].icon}
            {formatConfig[format].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { DataTableExport, exportRows }
export type {
  DataTableExportLabels,
  DataTableExportProps,
  ExportColumn,
  ExportFormat,
  ExportRowsOptions,
}
