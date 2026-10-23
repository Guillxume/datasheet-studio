'use client'

import { useCallback, useMemo } from 'react'
import type { ColumnFiltersState, OnChangeFn } from '../components/data-table'

type UseUrlFilterBooleanOptions = {
  columnId: string
  columnFilters: ColumnFiltersState
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
}

const useUrlFilterBoolean = ({
  columnId,
  columnFilters,
  onColumnFiltersChange,
}: UseUrlFilterBooleanOptions) => {
  const isActive = useMemo(
    () => columnFilters.some(f => f.id === columnId && f.value === true),
    [columnFilters, columnId],
  )

  const toggle = useCallback(() => {
    onColumnFiltersChange(prev =>
      prev.some(f => f.id === columnId && f.value === true)
        ? prev.filter(f => f.id !== columnId)
        : [
            ...prev.filter(f => f.id !== columnId),
            { id: columnId, value: true },
          ],
    )
  }, [columnId, onColumnFiltersChange])

  return { isActive, toggle }
}

export { useUrlFilterBoolean }
export type { UseUrlFilterBooleanOptions }
