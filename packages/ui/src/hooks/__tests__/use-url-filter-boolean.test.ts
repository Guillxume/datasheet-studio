// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  ColumnFiltersState,
  OnChangeFn,
} from '../../components/data-table'
import { useUrlFilterBoolean } from '../use-url-filter-boolean'

describe('useUrlFilterBoolean', () => {
  const setup = (columnFilters: ColumnFiltersState = []) => {
    let currentFilters = columnFilters
    const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = vi.fn(
      updater => {
        currentFilters =
          typeof updater === 'function' ? updater(currentFilters) : updater
      },
    )

    const { result, rerender } = renderHook(
      ({ filters }) =>
        useUrlFilterBoolean({
          columnId: 'active',
          columnFilters: filters,
          onColumnFiltersChange,
        }),
      { initialProps: { filters: columnFilters } },
    )

    return {
      result,
      rerender,
      onColumnFiltersChange,
      getCurrentFilters: () => currentFilters,
    }
  }

  it('isActive is false when columnId is not in filters', () => {
    const { result } = setup([])
    expect(result.current.isActive).toBe(false)
  })

  it('isActive is false when columnId exists with non-true value', () => {
    const { result } = setup([{ id: 'active', value: false }])
    expect(result.current.isActive).toBe(false)
  })

  it('isActive is true when columnId is in filters with value true', () => {
    const { result } = setup([{ id: 'active', value: true }])
    expect(result.current.isActive).toBe(true)
  })

  it('toggle adds filter when not present', () => {
    const { result, onColumnFiltersChange, getCurrentFilters } = setup([])

    act(() => {
      result.current.toggle()
    })

    expect(onColumnFiltersChange).toHaveBeenCalledOnce()
    const filters = getCurrentFilters()
    expect(filters).toEqual([{ id: 'active', value: true }])
  })

  it('toggle removes filter when present', () => {
    const { result, onColumnFiltersChange, getCurrentFilters } = setup([
      { id: 'active', value: true },
    ])

    act(() => {
      result.current.toggle()
    })

    expect(onColumnFiltersChange).toHaveBeenCalledOnce()
    const filters = getCurrentFilters()
    expect(filters).toEqual([])
  })

  it('toggle preserves other filters', () => {
    const { result, getCurrentFilters } = setup([
      { id: 'status', value: ['pending'] },
      { id: 'active', value: true },
    ])

    act(() => {
      result.current.toggle()
    })

    const filters = getCurrentFilters()
    expect(filters).toEqual([{ id: 'status', value: ['pending'] }])
  })
})
