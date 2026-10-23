// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDataTableUrlState } from '../use-data-table-url-state'

const createWrapper =
  (searchParams?: string | Record<string, string>) =>
  ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter searchParams={searchParams}>
      {children}
    </NuqsTestingAdapter>
  )

describe('useDataTableUrlState (integration)', () => {
  it('returns default pagination', () => {
    const { result } = renderHook(() => useDataTableUrlState({}), {
      wrapper: createWrapper(),
    })
    expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 30 })
  })

  it('reads pagination from URL', () => {
    const { result } = renderHook(() => useDataTableUrlState({}), {
      wrapper: createWrapper({ page: '3', pageSize: '10' }),
    })
    expect(result.current.pagination).toEqual({ pageIndex: 2, pageSize: 10 })
  })

  it('uses defaultSorting when no sort in URL', () => {
    const defaultSorting = [{ id: 'name', desc: false }]
    const { result } = renderHook(
      () => useDataTableUrlState({ defaultSorting }),
      { wrapper: createWrapper() },
    )
    expect(result.current.sorting).toEqual(defaultSorting)
  })

  it('reads sorting from URL', () => {
    const { result } = renderHook(() => useDataTableUrlState({}), {
      wrapper: createWrapper({ sort: 'name.desc' }),
    })
    expect(result.current.sorting).toEqual([{ id: 'name', desc: true }])
  })

  it('returns empty search by default', () => {
    const { result } = renderHook(() => useDataTableUrlState({}), {
      wrapper: createWrapper(),
    })
    expect(result.current.search).toBe('')
    expect(result.current.searchColumn).toBe('')
  })

  it('reads search from URL', () => {
    const { result } = renderHook(
      () => useDataTableUrlState({ defaultSearchColumn: 'name' }),
      { wrapper: createWrapper({ q: 'hello', qc: 'email' }) },
    )
    expect(result.current.search).toBe('hello')
    expect(result.current.searchColumn).toBe('email')
  })

  it('uses defaultSearchColumn when qc is not in URL', () => {
    const { result } = renderHook(
      () => useDataTableUrlState({ defaultSearchColumn: 'name' }),
      { wrapper: createWrapper() },
    )
    expect(result.current.searchColumn).toBe('name')
  })

  describe('displayMode', () => {
    it('defaults to "table" when no URL param and no defaultDisplayMode', () => {
      const { result } = renderHook(() => useDataTableUrlState({}), {
        wrapper: createWrapper(),
      })
      expect(result.current.displayMode).toBe('table')
    })

    it('uses defaultDisplayMode when no URL param is present', () => {
      const { result } = renderHook(
        () => useDataTableUrlState({ defaultDisplayMode: 'calendar' }),
        { wrapper: createWrapper() },
      )
      expect(result.current.displayMode).toBe('calendar')
    })

    it('reads display mode from URL param', () => {
      const { result } = renderHook(() => useDataTableUrlState({}), {
        wrapper: createWrapper({ display: 'calendar' }),
      })
      expect(result.current.displayMode).toBe('calendar')
    })

    it('URL param takes priority over defaultDisplayMode', () => {
      const { result } = renderHook(
        () => useDataTableUrlState({ defaultDisplayMode: 'card' }),
        { wrapper: createWrapper({ display: 'calendar' }) },
      )
      expect(result.current.displayMode).toBe('calendar')
    })

    it('onDisplayModeChange updates the URL', async () => {
      const onUrlChange = vi.fn()
      const wrapper = ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter onUrlUpdate={onUrlChange}>
          {children}
        </NuqsTestingAdapter>
      )
      const { result } = renderHook(() => useDataTableUrlState({}), {
        wrapper,
      })

      act(() => {
        result.current.onDisplayModeChange('calendar')
      })

      expect(result.current.displayMode).toBe('calendar')
      await waitFor(() => {
        expect(onUrlChange).toHaveBeenCalledOnce()
      })
      expect(onUrlChange.mock.calls[0][0].queryString).toContain(
        'display=calendar',
      )
    })

    it('omits URL param when display mode matches defaultDisplayMode', async () => {
      const onUrlChange = vi.fn()
      const wrapper = ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter onUrlUpdate={onUrlChange} hasMemory>
          {children}
        </NuqsTestingAdapter>
      )
      const { result } = renderHook(
        () => useDataTableUrlState({ defaultDisplayMode: 'table' }),
        { wrapper },
      )

      // Switch to calendar first
      act(() => {
        result.current.onDisplayModeChange('calendar')
      })
      expect(result.current.displayMode).toBe('calendar')
      await waitFor(() => {
        expect(onUrlChange).toHaveBeenCalledOnce()
      })

      // Switch back to default — display param should be removed
      act(() => {
        result.current.onDisplayModeChange('table')
      })
      expect(result.current.displayMode).toBe('table')
      await waitFor(() => {
        expect(onUrlChange).toHaveBeenCalledTimes(2)
      })
      const lastParams =
        onUrlChange.mock.calls[onUrlChange.mock.calls.length - 1][0]
      expect(lastParams.searchParams.has('display')).toBe(false)
    })
  })
})
