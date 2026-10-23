// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  ScannerInput,
  type ScannerInputHandle,
  type ScannerInputLabels,
} from '../scanner-input'

const labels: ScannerInputLabels = {
  inputLabel: 'Scan',
  inputPlaceholder: 'Scan or type a code',
  manualEntryToggle: 'Enter manually',
  submitManualEntry: 'Submit',
  cameraButton: 'Scan with camera',
  cameraCloseButton: 'Close camera',
  validationError: 'Unrecognised code',
  cameraUnavailable: 'Camera unavailable',
}

// Waits a couple of animation frames: the scheduled `requestAnimationFrame`
// refocus callback runs on the frame after it was scheduled, and this gives
// it room to fire without relying on fake timers (banned near this kind of
// scan-loop code elsewhere in the repo, and unnecessary here).
const flushAnimationFrames = async () => {
  await new Promise(resolve => requestAnimationFrame(resolve))
  await new Promise(resolve => requestAnimationFrame(resolve))
}

describe('ScannerInput blur-refocus', () => {
  it('does not steal focus back if autoFocus flips to false between the blur and the scheduled refocus', async () => {
    const { rerender, getByLabelText } = render(
      <ScannerInput onScan={vi.fn()} autoFocus labels={labels} />,
    )
    const input = getByLabelText('Scan') as HTMLInputElement

    const other = document.createElement('button')
    document.body.appendChild(other)

    // Blur while autoFocus is STILL true: this is what schedules the rAF,
    // with the closure over `autoFocus=true` that was current at the time
    // handleBlur ran (mirroring a real card-switch: the browser blurs the
    // old field before React commits the new activeSlot).
    fireEvent.blur(input)

    // NOW autoFocus flips to false, before the scheduled rAF has fired -
    // e.g. the operator tapped a different field, so this one is no longer
    // active. Without re-checking a live ref inside the rAF, the callback
    // still holds the STALE `autoFocus=true` it closed over at blur time,
    // and steals focus back regardless.
    rerender(
      <ScannerInput onScan={vi.fn()} autoFocus={false} labels={labels} />,
    )
    other.focus()
    expect(document.activeElement).toBe(other)

    await flushAnimationFrames()

    expect(document.activeElement).toBe(other)

    document.body.removeChild(other)
  })
})

describe('ScannerInput imperative handle', () => {
  it('exposes focus() via the forwarded ref, for parents that manage focus explicitly instead of via autoFocus', () => {
    const ref = createRef<ScannerInputHandle>()
    const { getByLabelText } = render(
      <ScannerInput
        ref={ref}
        onScan={vi.fn()}
        autoFocus={false}
        labels={labels}
      />,
    )
    const input = getByLabelText('Scan')

    expect(document.activeElement).not.toBe(input)

    ref.current?.focus()

    expect(document.activeElement).toBe(input)
  })
})
