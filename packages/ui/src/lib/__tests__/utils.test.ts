import { describe, expect, it } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden')).toBe('base')
    expect(cn('base', true && 'visible')).toBe('base visible')
  })

  it('handles undefined and null inputs', () => {
    expect(cn('base', undefined, null)).toBe('base')
  })

  it('returns empty string when given no arguments', () => {
    expect(cn()).toBe('')
  })

  it('merges conflicting Tailwind variants correctly', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})
