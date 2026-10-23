import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { ScannerInput } from './scanner-input'
import { playScanError, playScanSuccess } from './sounds'

const defaultLabels = {
  inputLabel: 'Scan a barcode',
  inputPlaceholder: 'Scan or type…',
  manualEntryToggle: 'Manual entry',
  submitManualEntry: 'Submit',
  cameraButton: 'Use camera',
  cameraCloseButton: 'Close camera',
  validationError: 'Invalid barcode format',
  cameraUnavailable: 'Camera unavailable',
}

const meta = {
  title: 'Forms/ScannerInput',
  component: ScannerInput,
  tags: ['autodocs'],
  args: {
    labels: defaultLabels,
    // Consumer-side sound + alert. In real apps the consumer plays
    // playScanSuccess / playScanError at the API-resolution boundary;
    // here the alert simulates the workflow's response. The alert is
    // deferred so audio playback gets to start before alert() blocks
    // the main thread.
    onScan: (value: string) => {
      playScanSuccess()
      setTimeout(() => alert(`Scanned: ${value}`), 0)
    },
  },
} satisfies Meta<typeof ScannerInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    allowManualEntry: false,
    allowCameraFallback: false,
    autoFocus: false,
  },
}

export const Autofocus: Story = {
  args: {
    allowManualEntry: true,
    allowCameraFallback: false,
    autoFocus: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'With `autoFocus={true}` (the default), the input grabs focus on mount and refocuses on blur. This keeps the next scan ready without requiring the operator to tap the input — critical for HID-scanner workflows where the scanner gun emits keystrokes directly into the focused element.',
      },
    },
  },
}

export const WithManualEntry: Story = {
  args: {
    allowManualEntry: true,
    allowCameraFallback: false,
    autoFocus: false,
  },
}

export const WithCameraFallback: Story = {
  args: {
    allowManualEntry: true,
    allowCameraFallback: true,
    autoFocus: false,
  },
}

export const ManualModeWithCamera: Story = {
  args: {
    allowManualEntry: true,
    allowCameraFallback: true,
    autoFocus: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Manual entry active alongside the camera fallback button. Submit appears at the leftmost position; the keyboard toggle (pressed) and the camera button stay accessible to the right. Best viewed on a real touch device — the manual entry toggle is gated on `isTouchscreen()` and only renders in mobile-class environments.',
      },
    },
    // Chromatic runs in desktop headless Chromium where `isTouchscreen()` is
    // false, so the manual-entry toggle this story's `play` function clicks is
    // never rendered and `getByLabelText` throws. Skip the snapshot — the
    // story remains useful for live testing on a device (see docs/storybook.md).
    chromatic: { disableSnapshot: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByLabelText('Manual entry')
    await userEvent.click(toggle)
  },
}

export const WithValidationError: Story = {
  args: {
    allowManualEntry: true,
    allowCameraFallback: false,
    autoFocus: false,
    validate: /^\d{13}$/,
    onValidationError: (value: string) => {
      playScanError()
      setTimeout(() => alert(`Validation error for: ${value}`), 0)
    },
    labels: {
      ...defaultLabels,
      validationError: 'Must be a 13-digit EAN barcode',
    },
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    allowManualEntry: true,
    allowCameraFallback: false,
    autoFocus: false,
  },
}

export const WithInitialValue: Story = {
  args: {
    initialValue: '1234567890128',
    allowManualEntry: true,
    allowCameraFallback: false,
    autoFocus: false,
  },
}
