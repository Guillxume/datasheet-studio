// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { SettingsContextValue } from '../use-settings'
import { SettingsContext, useSettings } from '../use-settings'

const mockSettingsValue: SettingsContextValue = {
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
  locale: 'en',
  setLocale: () => {},
  getTableLayout: () => null,
  saveTableLayout: () => {},
  clearTableLayout: () => {},
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsContext value={mockSettingsValue}>{children}</SettingsContext>
)

describe('useSettings', () => {
  it('throws when used outside SettingsProvider', () => {
    expect(() => renderHook(() => useSettings())).toThrow(
      'useSettings must be used within a SettingsProvider',
    )
  })

  it('returns context value when used inside provider', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    expect(result.current.theme).toBe('system')
    expect(result.current.locale).toBe('en')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('exposes table layout methods', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    expect(result.current.getTableLayout('test')).toBeNull()
    expect(typeof result.current.saveTableLayout).toBe('function')
    expect(typeof result.current.clearTableLayout).toBe('function')
  })
})
