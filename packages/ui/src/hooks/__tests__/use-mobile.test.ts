// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useIsMobile } from '../use-mobile'

type ChangeHandler = (e: MediaQueryListEvent) => void

const createMatchMediaMock = (matches: boolean) => {
  const listeners: ChangeHandler[] = []
  const mql = {
    matches,
    addEventListener: (_: string, handler: ChangeHandler) => {
      listeners.push(handler)
    },
    removeEventListener: (_: string, handler: ChangeHandler) => {
      const idx = listeners.indexOf(handler)
      if (idx >= 0) listeners.splice(idx, 1)
    },
  }
  return {
    mql,
    listeners,
    mockFn: vi.fn().mockReturnValue(mql),
  }
}

describe('useIsMobile', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('returns false before effect runs (pre-hydration)', () => {
    const { mockFn } = createMatchMediaMock(true)
    window.matchMedia = mockFn
    const { result } = renderHook(() => useIsMobile())
    expect(typeof result.current).toBe('boolean')
  })

  it('returns true when viewport is below 768px', () => {
    const { mockFn } = createMatchMediaMock(true)
    window.matchMedia = mockFn
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false when viewport is at or above 768px', () => {
    const { mockFn } = createMatchMediaMock(false)
    window.matchMedia = mockFn
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('updates when media query fires change event', () => {
    const { mockFn, mql, listeners } = createMatchMediaMock(false)
    window.matchMedia = mockFn
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      mql.matches = true
      for (const listener of listeners) {
        listener({ matches: true } as MediaQueryListEvent)
      }
    })
    expect(result.current).toBe(true)
  })

  it('queries the correct breakpoint', () => {
    const mockFn = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    window.matchMedia = mockFn
    renderHook(() => useIsMobile())
    expect(mockFn).toHaveBeenCalledWith('(max-width: 767px)')
  })

  it('cleans up listener on unmount', () => {
    const removeEventListener = vi.fn()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener,
    })
    const { unmount } = renderHook(() => useIsMobile())
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
  })
})
