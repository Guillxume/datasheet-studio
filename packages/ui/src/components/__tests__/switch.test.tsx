// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from '../switch'

describe('Switch', () => {
  it('stays as it was when its owner refuses the change (controlled)', () => {
    // E.g. a save rejected by the server: the owner never updates `checked`.
    const onCheckedChange = vi.fn()
    render(
      <Switch aria-label='Active' checked onCheckedChange={onCheckedChange} />,
    )
    const toggle = screen.getByRole('switch', { name: 'Active' })

    fireEvent.click(toggle)

    expect(onCheckedChange).toHaveBeenCalledWith(false)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('follows its owner when the change is accepted (controlled)', () => {
    const Owner = () => {
      const [on, setOn] = useState(false)
      return <Switch aria-label='Active' checked={on} onCheckedChange={setOn} />
    }
    render(<Owner />)
    const toggle = screen.getByRole('switch', { name: 'Active' })

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps its own state without `checked` (uncontrolled)', () => {
    render(<Switch aria-label='Active' defaultChecked />)
    const toggle = screen.getByRole('switch', { name: 'Active' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
