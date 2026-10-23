import type { RowData } from '@tanstack/react-table'

import type { ColumnDef } from '../components/data-table'

export const computeDefaultColumnVisibility = <T extends RowData>(
  columns: ColumnDef<T>[],
  visibleKeys: readonly string[],
): Record<string, boolean> => {
  const visible = new Set<string>(visibleKeys)
  return Object.fromEntries(
    columns
      .map(col =>
        'accessorKey' in col ? (col.accessorKey as string) : undefined,
      )
      .filter((key): key is string => !!key && !visible.has(key))
      .map(key => [key, false]),
  )
}

export const renderDateCell = (
  date: Date | null,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
) => {
  if (!date) return <span className='text-muted-foreground'>&mdash;</span>
  const formatOptions = options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
  return (
    <div className='text-right'>
      <time dateTime={date.toISOString()} suppressHydrationWarning>
        {date.toLocaleDateString(locale, formatOptions)}
      </time>
    </div>
  )
}
