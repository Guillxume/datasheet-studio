import type { CSSProperties } from 'react'

import { cn } from '../lib/utils'

// Fixed-height auto-computation constants (pixels)
const HEADER_HEIGHT = 40
const ROW_HEIGHT = 39
const BORDER_HEIGHT = 2

export const getPinnedStyles = (
  column: { id: string; getIsPinned: () => string | false },
  pinnedOffsets: Record<string, number>,
): CSSProperties | undefined => {
  const pinned = column.getIsPinned()
  if (!pinned) return undefined
  const offset = pinnedOffsets[column.id] ?? 0
  return {
    position: 'sticky',
    // Physical sides: the admin UI is left-to-right.
    ...(pinned === 'start'
      ? { left: `${offset}px` }
      : { right: `${offset}px` }),
    zIndex: 1,
  }
}

export const getPinnedClassName = (
  column: { id: string; getIsPinned: () => string | false },
  startPinnedColumns: { id: string }[],
  endPinnedColumns: { id: string }[],
): string => {
  const pinned = column.getIsPinned()
  if (!pinned) return ''
  const isLastStart =
    pinned === 'start' &&
    startPinnedColumns[startPinnedColumns.length - 1]?.id === column.id
  const isFirstEnd = pinned === 'end' && endPinnedColumns[0]?.id === column.id
  return cn('bg-card', isLastStart && 'border-r', isFirstEnd && 'border-l')
}

export const getEdgePaddingClassName = (
  columnId: string,
  firstColumnId: string | undefined,
  lastColumnId: string | undefined,
  padFirstColumn: boolean,
  padLastColumn: boolean,
): string =>
  cn(
    columnId === firstColumnId && padFirstColumn && 'pl-4',
    columnId === lastColumnId && padLastColumn && 'pr-4',
  )

export const getFixedHeightProps = (
  fixedHeight: boolean | string | undefined,
  isCardMode: boolean,
  isCalendarMode: boolean,
  pageSize: number,
): { className?: string; style?: CSSProperties } => {
  if (!fixedHeight || isCardMode || isCalendarMode) return {}
  return {
    className:
      'overflow-auto [&_[data-slot=table-container]]:overflow-visible [&>[data-slot=data-table-bulk-actions]]:sticky [&>[data-slot=data-table-bulk-actions]]:-mb-10',
    style: {
      height:
        typeof fixedHeight === 'string'
          ? fixedHeight
          : `${HEADER_HEIGHT + BORDER_HEIGHT + pageSize * ROW_HEIGHT}px`,
    },
  }
}
