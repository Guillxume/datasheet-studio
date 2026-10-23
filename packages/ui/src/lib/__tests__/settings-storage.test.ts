import { describe, expect, it } from 'vitest'
import {
  buildThemeScript,
  DEFAULT_SETTINGS_STORAGE_KEY,
} from '../settings-storage'

/**
 * Runs the inline script against fake globals and reports whether it added
 * the `dark` class. The script reads `localStorage`, `window.matchMedia` and
 * `document`, so each is passed in as a parameter that takes precedence over
 * the real one. `'throws'` simulates blocked storage (e.g. Safari private
 * browsing), where `getItem` raises.
 */
const run = (
  script: string,
  storage: Record<string, string> | 'throws',
  prefersDark = false,
) => {
  const classes = new Set<string>()
  new Function('localStorage', 'window', 'document', script)(
    {
      getItem: (key: string) => {
        if (storage === 'throws') throw new Error('SecurityError')
        return storage[key] ?? null
      },
    },
    { matchMedia: () => ({ matches: prefersDark }) },
    { documentElement: { classList: { add: (c: string) => classes.add(c) } } },
  )
  return classes.has('dark')
}

describe('buildThemeScript', () => {
  it('applies the dark theme saved under the default key', () => {
    const storage = {
      [DEFAULT_SETTINGS_STORAGE_KEY]: JSON.stringify({ theme: 'dark' }),
    }
    expect(run(buildThemeScript(), storage)).toBe(true)
  })

  it('reads the key it was built with, not the default one', () => {
    const storage = {
      [DEFAULT_SETTINGS_STORAGE_KEY]: JSON.stringify({ theme: 'light' }),
      'my-app-settings': JSON.stringify({ theme: 'dark' }),
    }
    expect(run(buildThemeScript('my-app-settings'), storage)).toBe(true)
  })

  it('keeps an explicit light theme even when the OS prefers dark', () => {
    const storage = { k: JSON.stringify({ theme: 'light' }) }
    expect(run(buildThemeScript('k'), storage, true)).toBe(false)
  })

  it('falls back to the OS preference when nothing is saved', () => {
    expect(run(buildThemeScript('k'), {}, true)).toBe(true)
    expect(run(buildThemeScript('k'), {}, false)).toBe(false)
  })

  it('falls back to the OS preference on corrupt JSON', () => {
    expect(run(buildThemeScript('k'), { k: 'not-json' }, true)).toBe(true)
  })

  it('falls back to the OS preference when storage access throws', () => {
    expect(run(buildThemeScript('k'), 'throws', true)).toBe(true)
  })

  it('escapes the key so it cannot close the surrounding script tag', () => {
    const key = '</script><script>alert(1)'
    const script = buildThemeScript(key)
    expect(script).not.toContain('</script>')
    // The escaped key must still be the exact key once the script runs
    expect(run(script, { [key]: JSON.stringify({ theme: 'dark' }) })).toBe(true)
  })
})
