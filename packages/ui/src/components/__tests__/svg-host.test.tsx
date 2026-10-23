// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SvgHost } from '../_internal/svg-host'

afterEach(cleanup)

const SAMPLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10"/></svg>'

describe('SvgHost', () => {
  it('mounts the parsed SVG node inside the wrapper', async () => {
    const { container } = render(<SvgHost svg={SAMPLE} aria-label='test' />)
    await Promise.resolve()
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 10 10')
    expect(svg?.querySelector('rect')).not.toBeNull()
  })

  it('exposes role=img and aria-label on the wrapper', () => {
    const { getByRole } = render(<SvgHost svg={SAMPLE} aria-label='my code' />)
    const wrapper = getByRole('img')
    expect(wrapper.getAttribute('aria-label')).toBe('my code')
  })

  it('forwards className to the wrapper', () => {
    const { getByRole } = render(
      <SvgHost svg={SAMPLE} aria-label='x' className='size-32' />,
    )
    expect(getByRole('img').className).toContain('size-32')
  })
})
