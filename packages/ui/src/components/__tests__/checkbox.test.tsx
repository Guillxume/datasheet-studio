// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from '../checkbox'

describe('Checkbox', () => {
  it('exposes the indeterminate state as mixed and shows the dash, not the tick', async () => {
    const { container } = render(
      <Checkbox checked='indeterminate' aria-label='All rows' />,
    )

    const box = screen.getByRole('checkbox', { name: 'All rows' })
    expect(box).toHaveAttribute('aria-checked', 'mixed')
    expect(box).toHaveAttribute('data-state', 'indeterminate')
    // 'indeterminate' is truthy: it used to animate the tick in.
    await waitFor(() => {
      expect(
        container.querySelector('[data-slot="checkbox-dash"]'),
      ).toHaveAttribute('opacity', '1')
      expect(
        container.querySelector('[data-slot="checkbox-check"]'),
      ).toHaveAttribute('opacity', '0')
    })
  })

  it('reports true when an indeterminate box is clicked', () => {
    const onCheckedChange = vi.fn()
    render(
      <Checkbox
        checked='indeterminate'
        onCheckedChange={onCheckedChange}
        aria-label='All rows'
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'All rows' }))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('keeps the tick off when its owner refuses the change (controlled)', async () => {
    // E.g. a save rejected by the server: the owner never updates `checked`.
    const onCheckedChange = vi.fn()
    const { container } = render(
      <Checkbox
        checked={false}
        onCheckedChange={onCheckedChange}
        aria-label='Row'
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Row' }))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('checkbox', { name: 'Row' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(
      container.querySelector('[data-slot="checkbox-check"]'),
    ).toHaveAttribute('opacity', '0')
  })
})
