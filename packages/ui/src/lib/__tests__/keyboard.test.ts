// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { matchesHotkey, parseHotkey } from '../keyboard'

describe('parseHotkey', () => {
  it('parses a key with no modifiers', () => {
    expect(parseHotkey('k')).toEqual({
      ctrl: false,
      shift: false,
      alt: false,
      key: 'k',
    })
  })

  it('parses a key with a single modifier', () => {
    expect(parseHotkey('k', ['ctrl'])).toEqual({
      ctrl: true,
      shift: false,
      alt: false,
      key: 'k',
    })
  })

  it('parses a key with multiple modifiers', () => {
    expect(parseHotkey('s', ['ctrl', 'shift'])).toEqual({
      ctrl: true,
      shift: true,
      alt: false,
      key: 's',
    })
  })

  it('parses all three modifiers', () => {
    expect(parseHotkey('a', ['ctrl', 'shift', 'alt'])).toEqual({
      ctrl: true,
      shift: true,
      alt: true,
      key: 'a',
    })
  })
})

describe('matchesHotkey', () => {
  it('returns true when event matches exactly', () => {
    const parsed = parseHotkey('k', ['ctrl'])
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    expect(matchesHotkey(event, parsed)).toBe(true)
  })

  it('returns false when key does not match', () => {
    const parsed = parseHotkey('k', ['ctrl'])
    const event = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true })
    expect(matchesHotkey(event, parsed)).toBe(false)
  })

  it('returns false when a required modifier is missing', () => {
    const parsed = parseHotkey('k', ['ctrl'])
    const event = new KeyboardEvent('keydown', { key: 'k' })
    expect(matchesHotkey(event, parsed)).toBe(false)
  })

  it('returns false when event has an extra modifier', () => {
    const parsed = parseHotkey('k', ['ctrl'])
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(matchesHotkey(event, parsed)).toBe(false)
  })

  it('matches case-insensitively', () => {
    const parsed = parseHotkey('k')
    const event = new KeyboardEvent('keydown', { key: 'K' })
    expect(matchesHotkey(event, parsed)).toBe(true)
  })

  it('matches a key with no modifiers', () => {
    const parsed = parseHotkey('a')
    const event = new KeyboardEvent('keydown', { key: 'a' })
    expect(matchesHotkey(event, parsed)).toBe(true)
  })
})
