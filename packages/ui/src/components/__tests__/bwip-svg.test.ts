// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderBwipSvg } from '../_internal/bwip-svg'

describe('renderBwipSvg', () => {
  it('renders a QR code as SVG with viewBox and no fixed width/height', () => {
    const svg = renderBwipSvg({ symbol: 'qrcode', value: 'hello' })
    expect(svg).toMatch(/^<svg\b/)
    expect(svg).toContain('viewBox=')
    expect(svg).not.toMatch(/<svg[^>]*\swidth="\d/)
    expect(svg).not.toMatch(/<svg[^>]*\sheight="\d/)
  })

  it('renders a Code128 barcode as SVG', () => {
    const svg = renderBwipSvg({ symbol: 'code128', value: 'ABC-123' })
    expect(svg).toMatch(/^<svg\b/)
    expect(svg).toContain('viewBox=')
  })

  it('injects fill="currentColor" on the root svg so consumers can color via Tailwind text-*', () => {
    const svg = renderBwipSvg({ symbol: 'qrcode', value: 'x' })
    expect(svg).toMatch(/<svg\b[^>]*fill="currentColor"/)
  })

  it('throws on invalid EAN-13 checksum', () => {
    expect(() =>
      renderBwipSvg({ symbol: 'ean13', value: '0000000000001' }),
    ).toThrow()
  })

  it('throws when value is too long for QR at level M', () => {
    const tooLong = 'x'.repeat(5000)
    expect(() => renderBwipSvg({ symbol: 'qrcode', value: tooLong })).toThrow()
  })
})
