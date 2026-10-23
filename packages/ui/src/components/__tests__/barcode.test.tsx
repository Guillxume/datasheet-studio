// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Barcode, type BarcodeFormat } from '../barcode'

afterEach(cleanup)

const SAMPLES: Record<BarcodeFormat, string> = {
  code128: 'ABC-123',
  code39: 'HELLO',
  ean13: '5901234123457',
  ean8: '96385074',
  upca: '036000291452',
  upce: '01234565',
  itf: '1234567890',
  itf14: '10012345678902',
  datamatrix: 'hello',
  pdf417: 'hello',
  aztec: 'hello',
}

describe('Barcode', () => {
  for (const [format, value] of Object.entries(SAMPLES) as Array<
    [BarcodeFormat, string]
  >) {
    it(`renders ${format}`, async () => {
      const { container } = render(<Barcode format={format} value={value} />)
      await Promise.resolve()
      expect(container.querySelector('svg')).not.toBeNull()
    })
  }

  it('uses default aria-label including format', () => {
    const { getByRole } = render(<Barcode format='code128' value='ABC-123' />)
    expect(getByRole('img').getAttribute('aria-label')).toBe(
      'code128 barcode: ABC-123',
    )
  })

  it('uses a custom aria-label when provided', () => {
    const { getByRole } = render(
      <Barcode format='code128' value='x' aria-label='Order label' />,
    )
    expect(getByRole('img').getAttribute('aria-label')).toBe('Order label')
  })

  it('calls onError and renders fallback for invalid EAN-13 checksum', () => {
    const onError = vi.fn()
    const { container } = render(
      <Barcode format='ean13' value='0000000000001' onError={onError} />,
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-error]')).not.toBeNull()
  })
})
