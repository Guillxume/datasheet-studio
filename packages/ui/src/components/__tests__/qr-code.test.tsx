// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QRCode } from '../qr-code'

afterEach(cleanup)

describe('QRCode', () => {
  it('renders an SVG with role=img and default aria-label', async () => {
    const { container, getByRole } = render(<QRCode value='hello' />)
    const wrapper = getByRole('img')
    expect(wrapper.getAttribute('aria-label')).toBe('QR code: hello')
    await Promise.resolve()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('uses a custom aria-label when provided', () => {
    const { getByRole } = render(
      <QRCode value='x' aria-label='Pickup confirmation' />,
    )
    expect(getByRole('img').getAttribute('aria-label')).toBe(
      'Pickup confirmation',
    )
  })

  it('applies className to the wrapper', () => {
    const { getByRole } = render(<QRCode value='x' className='size-32' />)
    expect(getByRole('img').className).toContain('size-32')
  })

  it('calls onError and renders fallback when value exceeds capacity', () => {
    const onError = vi.fn()
    const tooLong = 'x'.repeat(5000)
    const { container } = render(<QRCode value={tooLong} onError={onError} />)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-error]')).not.toBeNull()
  })
})
