import { describe, expect, it } from 'vitest'
import { activeTopLevel, isInSection } from '../_internal/nav-match'

describe('isInSection', () => {
  it('matches the own page and the pages below it', () => {
    expect(isInSection('/orders', { href: '/orders' })).toBe(true)
    expect(isInSection('/orders/123', { href: '/orders' })).toBe(true)
  })

  it('does not match a path that only shares a prefix', () => {
    expect(isInSection('/orders-archive', { href: '/orders' })).toBe(false)
  })

  it('matches the root only on the root', () => {
    expect(isInSection('/', { href: '/' })).toBe(true)
    expect(isInSection('/orders', { href: '/' })).toBe(false)
  })

  it('ignores the query string of the href', () => {
    expect(isInSection('/orders', { href: '/orders?status=to_do' })).toBe(true)
  })

  it('matches the pages of any descendant, at any depth', () => {
    const deliveries = {
      href: '/deliveries/dashboard',
      items: [
        {
          href: '/deliveries/tours',
          items: [{ href: '/deliveries/tours/report' }],
        },
      ],
    }
    expect(isInSection('/deliveries/tours', deliveries)).toBe(true)
    expect(isInSection('/deliveries/tours/report', deliveries)).toBe(true)
    expect(isInSection('/deliveries/other', deliveries)).toBe(false)
  })
})

describe('activeTopLevel', () => {
  const hrefs = ['/', '/products', '/products/archive', '/families']

  it('keeps a section active on the pages below it', () => {
    expect(activeTopLevel('/products/123', hrefs)).toBe('/products')
  })

  it('prefers the most specific item when several match', () => {
    expect(activeTopLevel('/products/archive/9', hrefs)).toBe(
      '/products/archive',
    )
  })

  it('matches the root only on the root', () => {
    expect(activeTopLevel('/', hrefs)).toBe('/')
    expect(activeTopLevel('/unknown', hrefs)).toBeUndefined()
  })
})
