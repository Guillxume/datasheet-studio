'use client'

import { useEffect, useRef } from 'react'
import type { Key, Modifier } from '../lib/keyboard'
import { matchesHotkey, parseHotkey } from '../lib/keyboard'

type HotkeyOptions = {
  modifiers?: Modifier[]
  enabled?: boolean
  enableOnInput?: boolean
}

const EMPTY_MODIFIERS: Modifier[] = []
const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

const useHotkey = (
  key: Key,
  callback: () => void,
  options: HotkeyOptions = {},
) => {
  const {
    modifiers = EMPTY_MODIFIERS,
    enabled = true,
    enableOnInput = false,
  } = options

  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    const parsed = parseHotkey(key, modifiers)

    const handler = (event: KeyboardEvent) => {
      if (!enableOnInput) {
        const target = event.target as HTMLElement
        if (
          INPUT_TAGS.has(target.tagName) ||
          target.isContentEditable ||
          target.contentEditable === 'true'
        ) {
          return
        }
      }

      if (matchesHotkey(event, parsed)) {
        event.preventDefault()
        callbackRef.current()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [key, modifiers, enabled, enableOnInput])
}

export { useHotkey }
export type { HotkeyOptions }
