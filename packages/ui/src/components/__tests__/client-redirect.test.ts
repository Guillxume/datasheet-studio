import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS_STORAGE_KEY } from '../../lib/settings-storage'
import { buildLocaleRedirectScript } from '../client-redirect'

const LOCALES = ['en', 'fr'] as const

/**
 * Runs the inline script against a fake `localStorage` and `location`
 * (passed as parameters that take precedence over the real globals) and
 * returns the URL it redirected to. `'throws'` simulates blocked storage
 * (e.g. Safari private browsing), where `getItem` raises.
 */
const run = (script: string, storage: Record<string, string> | 'throws') => {
  const replace = vi.fn()
  new Function('localStorage', 'location', script)(
    {
      getItem: (key: string) => {
        if (storage === 'throws') throw new Error('SecurityError')
        return storage[key] ?? null
      },
    },
    { replace },
  )
  return replace.mock.calls[0]?.[0]
}

describe('buildLocaleRedirectScript', () => {
  it('redirects to the locale saved under the default key', () => {
    const script = buildLocaleRedirectScript(LOCALES, '/en/')
    const storage = {
      [DEFAULT_SETTINGS_STORAGE_KEY]: JSON.stringify({ locale: 'fr' }),
    }
    expect(run(script, storage)).toBe('/fr/')
  })

  it('reads the key it was built with, not the default one', () => {
    const script = buildLocaleRedirectScript(LOCALES, '/en/', 'my-app-settings')
    const storage = {
      [DEFAULT_SETTINGS_STORAGE_KEY]: JSON.stringify({ locale: 'en' }),
      'my-app-settings': JSON.stringify({ locale: 'fr' }),
    }
    expect(run(script, storage)).toBe('/fr/')
  })

  it('falls back to the default URL when nothing is saved', () => {
    const script = buildLocaleRedirectScript(LOCALES, '/en/', 'k')
    expect(run(script, {})).toBe('/en/')
  })

  it('falls back to the default URL for a locale that is not configured', () => {
    const script = buildLocaleRedirectScript(LOCALES, '/en/', 'k')
    expect(run(script, { k: JSON.stringify({ locale: 'de' }) })).toBe('/en/')
  })

  it('falls back to the default URL on corrupt JSON', () => {
    const script = buildLocaleRedirectScript(LOCALES, '/en/', 'k')
    expect(run(script, { k: 'not-json' })).toBe('/en/')
  })

  it('falls back to the default URL when storage access throws', () => {
    const script = buildLocaleRedirectScript(LOCALES, '/en/', 'k')
    expect(run(script, 'throws')).toBe('/en/')
  })

  it('escapes the key so it cannot close the surrounding script tag', () => {
    const key = '</script><script>alert(1)'
    const script = buildLocaleRedirectScript(LOCALES, '/en/', key)
    expect(script).not.toContain('</script>')
    // The escaped key must still be the exact key once the script runs
    expect(run(script, { [key]: JSON.stringify({ locale: 'fr' }) })).toBe(
      '/fr/',
    )
  })
})
