// First: freezes the clock before any story module reads the date.
import './fixed-clock'
import { useEffect, useLayoutEffect } from 'react'
import type { Decorator, Preview } from '@storybook/react-vite'

import './storybook.css'
import datasheetStudioCssRaw from '../src/themes/datasheet-studio.css?raw'
import { DEFAULT_SETTINGS_STORAGE_KEY } from '../src/lib/settings-storage'

const BRAND_STYLE_ID = 'storybook-brand-theme'
const SETTINGS_KEY = DEFAULT_SETTINGS_STORAGE_KEY

/**
 * Extract only the :root and .dark blocks (CSS custom property declarations)
 * from a raw theme file. The shared base is already loaded with the neutral
 * theme by storybook.css, so only the variables need to be swapped.
 */
const extractVariables = (css: string) =>
  [...css.matchAll(/(?::root,\s*\.light|\.dark)\s*\{[^}]+\}/g)]
    .map(m => m[0])
    .join('\n')

// Variables that override the neutral ones loaded by storybook.css
const BRAND_VARIABLES: Record<string, string> = {
  'datasheet-studio': extractVariables(datasheetStudioCssRaw),
}

const withBrandAndMode: Decorator = (Story, context) => {
  const brand = context.globals.brand ?? 'neutral'
  const mode = context.globals.mode ?? 'light'

  useEffect(() => {
    document.getElementById(BRAND_STYLE_ID)?.remove()

    const variables = BRAND_VARIABLES[brand]
    if (variables) {
      const style = document.createElement('style')
      style.id = BRAND_STYLE_ID
      style.textContent = variables
      document.head.appendChild(style)
    }
  }, [brand])

  // Sync the mode toolbar with SettingsProvider's localStorage.
  // SettingsProvider reads theme from localStorage and applies it via
  // useLayoutEffect on every render. We write the toolbar value to
  // localStorage so SettingsProvider picks it up automatically.
  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      const settings = raw ? JSON.parse(raw) : {}
      settings.theme = mode
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [mode])

  return <Story />
}

const preview: Preview = {
  globalTypes: {
    brand: {
      description: 'Brand theme',
      toolbar: {
        title: 'Brand',
        icon: 'paintbrush',
        items: [
          { value: 'neutral', title: 'Neutral' },
          { value: 'datasheet-studio', title: 'Datasheet Studio' },
        ],
        dynamicTitle: true,
      },
    },
    mode: {
      description: 'Color mode',
      toolbar: {
        title: 'Mode',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    brand: 'neutral',
    mode: 'light',
  },
  decorators: [withBrandAndMode],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },
  },
}

export default preview
