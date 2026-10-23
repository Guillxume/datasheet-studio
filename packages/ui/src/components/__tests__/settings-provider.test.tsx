// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '../../hooks/use-settings'
import { DEFAULT_SETTINGS_STORAGE_KEY } from '../../lib/settings-storage'
import { SettingsProvider } from '../settings-provider'

const STORAGE_KEY = DEFAULT_SETTINGS_STORAGE_KEY

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
)

// Mock matchMedia
let prefersDark = false
const changeListeners: Array<() => void> = []

const mockMatchMedia = (query: string) => ({
  matches: query.includes('dark') ? prefersDark : false,
  addEventListener: (_: string, handler: () => void) => {
    changeListeners.push(handler)
  },
  removeEventListener: (_: string, handler: () => void) => {
    const idx = changeListeners.indexOf(handler)
    if (idx >= 0) changeListeners.splice(idx, 1)
  },
})

describe('SettingsProvider', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    localStorage.clear()
    prefersDark = false
    changeListeners.length = 0
    window.matchMedia = vi.fn(
      mockMatchMedia,
    ) as unknown as typeof window.matchMedia
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  describe('default settings', () => {
    it('provides default theme as system', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.theme).toBe('system')
    })

    it('provides empty locale by default', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.locale).toBe('')
    })

    it('returns null for unknown table layout', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.getTableLayout('nonexistent')).toBeNull()
    })
  })

  describe('reading from localStorage', () => {
    it('reads persisted settings on mount', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: 'dark', locale: 'fr', tables: {} }),
      )
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.theme).toBe('dark')
      expect(result.current.locale).toBe('fr')
    })

    it('falls back to defaults for corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json')
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.theme).toBe('system')
    })

    it('falls back with Zod catch for invalid shape', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: 'invalid', locale: 123 }),
      )
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.theme).toBe('system')
      expect(result.current.locale).toBe('')
    })
  })

  describe('custom storageKey', () => {
    const CUSTOM_KEY = 'my-app-settings'
    const customWrapper = ({ children }: { children: ReactNode }) => (
      <SettingsProvider storageKey={CUSTOM_KEY}>{children}</SettingsProvider>
    )

    it('reads persisted settings from the custom key', () => {
      localStorage.setItem(
        CUSTOM_KEY,
        JSON.stringify({ theme: 'dark', locale: 'fr', tables: {} }),
      )
      const { result } = renderHook(() => useSettings(), {
        wrapper: customWrapper,
      })
      expect(result.current.theme).toBe('dark')
      expect(result.current.locale).toBe('fr')
    })

    it('ignores settings stored under the default key', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: 'dark', locale: 'fr', tables: {} }),
      )
      const { result } = renderHook(() => useSettings(), {
        wrapper: customWrapper,
      })
      expect(result.current.theme).toBe('system')
      expect(result.current.locale).toBe('')
    })

    it('persists to the custom key only', () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: customWrapper,
      })

      act(() => {
        result.current.setLocale('fr')
      })

      // biome-ignore lint/style/noNonNullAssertion: test asserts storage key exists
      const stored = JSON.parse(localStorage.getItem(CUSTOM_KEY)!)
      expect(stored.locale).toBe('fr')
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })

  describe('setTheme', () => {
    it('updates theme and persists to localStorage', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.setTheme('dark')
      })

      expect(result.current.theme).toBe('dark')
      expect(result.current.resolvedTheme).toBe('dark')
      // biome-ignore lint/style/noNonNullAssertion: test asserts storage key exists
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored.theme).toBe('dark')
    })

    it('applies dark class to documentElement', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.setTheme('dark')
      })

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('removes dark class when set to light', () => {
      document.documentElement.classList.add('dark')
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.setTheme('light')
      })

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  describe('setLocale', () => {
    it('updates locale and persists', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.setLocale('fr')
      })

      expect(result.current.locale).toBe('fr')
      // biome-ignore lint/style/noNonNullAssertion: test asserts storage key exists
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored.locale).toBe('fr')
    })
  })

  describe('table layout persistence', () => {
    it('saveTableLayout persists and getTableLayout retrieves', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })
      const layout = { columnVisibility: { id: false } }

      act(() => {
        result.current.saveTableLayout('orders', layout)
      })

      expect(result.current.getTableLayout('orders')).toEqual(layout)
    })

    it('clearTableLayout removes the layout', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.saveTableLayout('orders', {
          columnVisibility: { id: false },
        })
      })
      act(() => {
        result.current.clearTableLayout('orders')
      })

      expect(result.current.getTableLayout('orders')).toBeNull()
    })
  })

  describe('theme DOM synchronization', () => {
    it('re-applies dark class after external removal when re-rendered (RSC reconciliation)', () => {
      prefersDark = true
      const { result } = renderHook(() => useSettings(), { wrapper })

      expect(document.documentElement.classList.contains('dark')).toBe(true)

      // Simulate RSC reconciliation stripping the imperatively-added class
      document.documentElement.classList.remove('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(false)

      // A locale change triggers a re-render, which fires useLayoutEffect
      act(() => {
        result.current.setLocale('fr')
      })

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('does not add dark class on re-render when theme resolves to light', () => {
      prefersDark = false
      const { result } = renderHook(() => useSettings(), { wrapper })

      expect(document.documentElement.classList.contains('dark')).toBe(false)

      act(() => {
        result.current.setLocale('fr')
      })

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  describe('theme resolution', () => {
    it('resolves system theme to dark when OS prefers dark', () => {
      prefersDark = true
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.resolvedTheme).toBe('dark')
    })

    it('resolves system theme to light when OS prefers light', () => {
      prefersDark = false
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.resolvedTheme).toBe('light')
    })

    it('updates resolvedTheme on OS preference change when theme is system', () => {
      prefersDark = false
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.resolvedTheme).toBe('light')

      act(() => {
        prefersDark = true
        for (const listener of changeListeners) {
          listener()
        }
      })

      expect(result.current.resolvedTheme).toBe('dark')
    })

    it('does not update resolvedTheme on OS change when theme is explicit', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })

      act(() => {
        result.current.setTheme('light')
      })

      act(() => {
        prefersDark = true
        for (const listener of changeListeners) {
          listener()
        }
      })

      expect(result.current.resolvedTheme).toBe('light')
    })
  })
})
