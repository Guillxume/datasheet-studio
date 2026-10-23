// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  DataTableFilterInteractionProvider,
  useFilterInteractionReporter,
} from '../data-table-filter-interaction'

describe('useFilterInteractionReporter', () => {
  it('reports open and close under the filter id', () => {
    const onFilterOpenChange = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DataTableFilterInteractionProvider
        onFilterOpenChange={onFilterOpenChange}>
        {children}
      </DataTableFilterInteractionProvider>
    )

    const { result } = renderHook(
      () => useFilterInteractionReporter('status'),
      { wrapper },
    )

    result.current(true)
    result.current(false)

    expect(onFilterOpenChange).toHaveBeenNthCalledWith(1, 'status', true)
    expect(onFilterOpenChange).toHaveBeenNthCalledWith(2, 'status', false)
  })

  it('is a no-op without a provider, so an app that does not listen is unaffected', () => {
    const { result } = renderHook(() => useFilterInteractionReporter('status'))

    expect(() => result.current(true)).not.toThrow()
  })

  it('reports nothing for a control with no resolvable id', () => {
    const onFilterOpenChange = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DataTableFilterInteractionProvider
        onFilterOpenChange={onFilterOpenChange}>
        {children}
      </DataTableFilterInteractionProvider>
    )

    const { result } = renderHook(
      () => useFilterInteractionReporter(undefined),
      { wrapper },
    )

    result.current(true)

    expect(onFilterOpenChange).not.toHaveBeenCalled()
  })
})
