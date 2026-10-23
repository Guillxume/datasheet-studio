// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHotkey } from '../use-hotkey'

const fireKey = (
  key: string,
  opts: Partial<KeyboardEventInit> = {},
  target?: HTMLElement,
) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  ;(target ?? document).dispatchEvent(event)
  return event
}

describe('useHotkey', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild)
    }
  })

  it('fires callback on matching key press', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('k', callback))
    fireKey('k')
    expect(callback).toHaveBeenCalledOnce()
  })

  it('fires callback with matching key + ctrl modifier', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('s', callback, { modifiers: ['ctrl'] }))
    fireKey('s', { ctrlKey: true })
    expect(callback).toHaveBeenCalledOnce()
  })

  it('fires callback with multiple modifiers', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('s', callback, { modifiers: ['ctrl', 'shift'] }))
    fireKey('s', { ctrlKey: true, shiftKey: true })
    expect(callback).toHaveBeenCalledOnce()
  })

  it('does not fire when key does not match', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('k', callback))
    fireKey('j')
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not fire when required modifier is missing', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('s', callback, { modifiers: ['ctrl'] }))
    fireKey('s')
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not fire when extra modifier is present', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('s', callback, { modifiers: ['ctrl'] }))
    fireKey('s', { ctrlKey: true, shiftKey: true })
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not fire when enabled is false', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('k', callback, { enabled: false }))
    fireKey('k')
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not fire when target is an INPUT element', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('k', callback))
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireKey('k', {}, input)
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not fire when target is a TEXTAREA element', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('k', callback))
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    fireKey('k', {}, textarea)
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not fire when target is a SELECT element', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('k', callback))
    const select = document.createElement('select')
    document.body.appendChild(select)
    fireKey('k', {}, select)
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not fire when target is contentEditable', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('k', callback))
    const div = document.createElement('div')
    div.contentEditable = 'true'
    document.body.appendChild(div)
    fireKey('k', {}, div)
    expect(callback).not.toHaveBeenCalled()
  })

  it('fires on INPUT when enableOnInput is true', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('k', callback, { enableOnInput: true }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireKey('k', {}, input)
    expect(callback).toHaveBeenCalledOnce()
  })

  it('calls preventDefault on match', () => {
    const callback = vi.fn()
    renderHook(() => useHotkey('k', callback))
    const event = fireKey('k')
    expect(event.defaultPrevented).toBe(true)
  })

  it('cleans up listener on unmount', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useHotkey('k', callback))
    unmount()
    fireKey('k')
    expect(callback).not.toHaveBeenCalled()
  })
})
