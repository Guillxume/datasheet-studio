# ScannerInput

A locale-agnostic barcode scanner input component that supports three input modes: HID (hardware scanner), manual keyboard entry, and camera-based scanning with the Web BarcodeDetector API (ZXing fallback).

## Import

```tsx
import {
  ScannerInput,
  type ScannerFormat,
  type ScannerInputHandle,
  playScanSuccess,
  playScanError,
} from '@guillxume/ui/components/scanner-input'
```

## Props

### ScannerInput

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onScan` | `(value: string) => void` | — | Called when a value is successfully captured and validated |
| `labels` | `ScannerInputLabels` | — | All display strings (see below) |
| `allowManualEntry` | `boolean` | `true` | Show the manual entry toggle button |
| `allowCameraFallback` | `boolean` | auto-detect mobile+camera | Show the camera button |
| `cameraFormats` | `ScannerFormat[]` | all supported | Restrict which barcode formats the camera fallback will decode (see below). Memoize the array to avoid rebuilding the camera on parent re-renders |
| `autoFocus` | `boolean` | `true` | Keep HID input focused; re-focuses on blur |
| `disabled` | `boolean` | `false` | Disables all interaction |
| `initialValue` | `string` | `''` | Pre-fills the input |
| `validate` | `RegExp` | — | When provided, captured values must match before dispatch. The regex is cloned per test, so consumer-supplied `/g` and `/y` patterns are safe |
| `onValidationError` | `(value: string) => void` | — | Called when validation fails, before clearing the input |

`ScannerInput` forwards a ref exposing `ScannerInputHandle`:

```ts
type ScannerInputHandle = {
  focus: () => void
}
```

Use this when a parent needs to move DOM focus explicitly (e.g. a screen with
several `ScannerInput`s that hands focus between fields on scan, tap, or
reset) instead of relying on `autoFocus`'s built-in blur-refocus, which
re-steals focus and fights a parent trying to move it elsewhere. Pass
`autoFocus={false}` on any instance driven this way, then call
`ref.current?.focus()` at the moments focus should move.

### ScannerFormat

Lowercase snake_case format names mirroring the native `BarcodeDetector` spec vocabulary. The zxing fallback is mapped onto its `BarcodeFormat` enum internally.

```ts
type ScannerFormat =
  | 'aztec'
  | 'codabar'
  | 'code_128'
  | 'code_39'
  | 'code_93'
  | 'data_matrix'
  | 'ean_13'
  | 'ean_8'
  | 'itf'
  | 'pdf417'
  | 'qr_code'
  | 'upc_a'
  | 'upc_e'
```

### ScannerInputLabels

| Key | Description |
|-----|-------------|
| `inputLabel` | Accessible label for the input (`aria-label`) |
| `inputPlaceholder` | Optional placeholder text |
| `manualEntryToggle` | Label for the manual entry toggle button |
| `submitManualEntry` | Label for the manual submit button |
| `cameraButton` | Label for the camera open button and the camera dialog (`aria-label`) |
| `cameraCloseButton` | Label for the camera close button |
| `validationError` | Error message shown when `validate` does not match |
| `cameraUnavailable` | Error message shown when `getUserMedia` fails |

## Input Modes

### HID scanner (default)

A hidden-but-focused `<input>` with `inputMode="none"` to suppress the on-screen keyboard. The HID scanner device acts as a keyboard — keystrokes are buffered until `Enter` or `Tab` is received, at which point `onScan` fires.

`autoFocus: true` ensures the input stays focused so it always captures scanner events. On blur, focus is restored via `requestAnimationFrame`.

### Manual entry

Toggled by the keyboard button. Switches to a normal `<input>` with `inputMode="text"` plus a Submit button. Useful for operators who need to type a code or correct a misread.

### Camera fallback

On mobile devices that report camera access (`navigator.mediaDevices.getUserMedia` + mobile user agent), a camera button appears. Clicking it opens a full-screen camera overlay (`role="dialog"`, `aria-modal="true"`, focus-trapped).

Detection priority:
1. **`BarcodeDetector` Web API** — native on Chrome/Android; most performant.
2. **`@zxing/browser`** — dynamic-imported as fallback for iOS Safari and older browsers.

On successful detection, the overlay closes and `onScan` fires.

If `cameraFormats` is provided, the detector is configured to only emit
matches for those formats — off-format barcodes (e.g. an EAN-13 sticker
when the workflow only expects QR codes) are filtered at the source rather
than rejected after the fact. `cameraFormats` has no effect on HID or
manual entry, where the device sends raw text and the OS owns format
decoding.

Closing the dialog stops the camera tracks immediately, even if
`getUserMedia` or `BarcodeDetector.detect` was still resolving — `onScan`
will never fire after the dialog has been dismissed.

## Sound feedback

**The component itself is silent.** Consumers call the helpers at API-response boundaries:

```ts
import { playScanSuccess, playScanError } from '@guillxume/ui/components/scanner-input'

// After a successful API call
playScanSuccess()

// After a failed API call
playScanError()
```

The helpers lazy-load the audio elements on first call (skipped during SSR) and use bundled MP3 files.

## Accessibility

- HID input always has `aria-label` from `labels.inputLabel`.
- Validation errors render as `<p role="alert" aria-live="polite">`.
- Manual entry toggle has `aria-pressed` state.
- Camera overlay has `role="dialog"` and `aria-modal="true"`.
- All buttons have `type="button"` to avoid accidental form submission.
- Touch targets are ≥44px (via the `sm` button size + padding).

## Imperative focus

```tsx
const productRef = useRef<ScannerInputHandle>(null)

<ScannerInput ref={productRef} autoFocus={false} onScan={handleScan} labels={labels} />

// Elsewhere, e.g. after a scan resolves or the operator taps this field:
productRef.current?.focus()
```

## Example

```tsx
import { useTranslations } from 'next-intl'
import {
  ScannerInput,
  type ScannerFormat,
  playScanSuccess,
  playScanError,
} from '@guillxume/ui/components/scanner-input'

// Module-level constant so the array reference is stable across re-renders.
const CAMERA_FORMATS: ScannerFormat[] = ['ean_13']

const MyScanner = () => {
  const t = useTranslations('dolibarr.shared.scanner')

  const handleScan = async (barcode: string) => {
    try {
      await api.processBarcode(barcode)
      playScanSuccess()
    } catch {
      playScanError()
    }
  }

  return (
    <ScannerInput
      onScan={handleScan}
      validate={/^\d{13}$/}
      cameraFormats={CAMERA_FORMATS}
      labels={{
        inputLabel: t('inputLabel'),
        inputPlaceholder: t('inputPlaceholder'),
        manualEntryToggle: t('manualEntryToggle'),
        submitManualEntry: t('submitManualEntry'),
        cameraButton: t('cameraButton'),
        cameraCloseButton: t('cameraCloseButton'),
        validationError: t('validationError'),
        cameraUnavailable: t('cameraUnavailable'),
      }}
    />
  )
}
```
