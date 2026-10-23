'use client'

import { CameraIcon, KeyboardIcon, ScanBarcodeIcon, XIcon } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Button } from '../button'
import { Icon } from '../icon'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '../input-group'

export type ScannerInputLabels = {
  inputLabel: string
  inputPlaceholder?: string
  manualEntryToggle: string
  submitManualEntry: string
  cameraButton: string
  cameraCloseButton: string
  validationError: string
  cameraUnavailable: string
}

/**
 * Barcode format names accepted by the camera fallback. Vocabulary mirrors the
 * native `BarcodeDetector` spec (lowercase snake_case). The zxing fallback is
 * mapped onto its `BarcodeFormat` enum internally.
 */
export type ScannerFormat =
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

export type ScannerInputProps = {
  onScan: (value: string) => void
  allowManualEntry?: boolean
  allowCameraFallback?: boolean
  /**
   * Restrict which barcode formats the camera will decode. Has no effect on
   * HID/manual entry (the device sends raw text and the OS owns format
   * decoding). Defaults to all formats the active detector supports.
   *
   * Memoize this array (e.g. via `useMemo` or a module-level constant): a new
   * reference on each render rebuilds the camera while the dialog is open.
   */
  cameraFormats?: ScannerFormat[]
  autoFocus?: boolean
  disabled?: boolean
  initialValue?: string
  validate?: RegExp
  onValidationError?: (value: string) => void
  labels: ScannerInputLabels
}

/**
 * Imperative handle for parents that need to move DOM focus explicitly
 * rather than via the `autoFocus` prop (e.g. a screen with several
 * ScannerInputs, where autoFocus's own blur-refocus would fight a parent
 * that wants to hand focus between fields on its own terms).
 */
export type ScannerInputHandle = {
  focus: () => void
}

const isTouchscreen = (): boolean => {
  if (typeof navigator === 'undefined') return false
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true
  // iPadOS 13+ Safari uses a desktop-class user agent (no "iPad", no "Mobile"),
  // so fall back to maxTouchPoints. True touchscreens report >0; desktop Macs
  // (including those with touch trackpads) report 0.
  return navigator.maxTouchPoints > 0
}

const isMobileWithCamera = (): boolean =>
  isTouchscreen() &&
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia)

export const ScannerInput = forwardRef<ScannerInputHandle, ScannerInputProps>(
  (
    {
      onScan,
      allowManualEntry = true,
      allowCameraFallback,
      cameraFormats,
      autoFocus = true,
      disabled = false,
      initialValue = '',
      validate,
      onValidationError,
      labels,
    },
    ref,
  ) => {
    const [value, setValue] = useState(initialValue)
    const [isManual, setIsManual] = useState(false)
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const formRef = useRef<HTMLFormElement>(null)
    // Mirror isCameraOpen in a ref so the blur-refocus rAF can read the
    // latest value. Without this, clicking the camera button blurs the
    // input → handleBlur captures the pre-click `false` from its closure
    // → rAF refocuses the background input after the camera modal opens,
    // breaking aria-modal focus semantics.
    const isCameraOpenRef = useRef(false)
    useEffect(() => {
      isCameraOpenRef.current = isCameraOpen
    }, [isCameraOpen])

    // Mirror autoFocus in a ref for the same reason: the blur-refocus rAF
    // below is scheduled with whatever `autoFocus` handleBlur closed over at
    // blur time. If autoFocus flips to false before that rAF fires (e.g. the
    // operator tapped a DIFFERENT field, which un-marks this one as active)
    // the callback must not steal focus back using the stale, now-wrong value.
    const autoFocusRef = useRef(autoFocus)
    useEffect(() => {
      autoFocusRef.current = autoFocus
    }, [autoFocus])

    // Robust focus that doesn't rely on ref-forwarding through wrapper
    // components (InputGroupInput → Input). Queries the rendered DOM directly.
    // Memoized so the autoFocus effect's dep array stays stable.
    const focusInput = useCallback(() => {
      const el =
        inputRef.current ??
        formRef.current?.querySelector<HTMLInputElement>('input')
      el?.focus()
    }, [])

    // Exposes imperative focus to parents that manage focus explicitly
    // instead of via `autoFocus` (see ScannerInputHandle above).
    useImperativeHandle(ref, () => ({ focus: focusInput }), [focusInput])

    const showCameraButton = allowCameraFallback ?? isMobileWithCamera()
    // Manual entry only matters on touchscreens: `inputMode='none'` suppresses
    // the soft keyboard there, so users need a way to opt back into typing.
    // On desktop the toggle has no functional effect (the physical keyboard
    // works regardless of inputMode), so it's hidden.
    const showManualToggle = allowManualEntry && isTouchscreen()

    useEffect(() => {
      if (autoFocus && !disabled && !isCameraOpen) {
        focusInput()
      }
    }, [autoFocus, disabled, isCameraOpen, focusInput])

    const handleBlur = () => {
      // Consult the ref, not the closure-captured state. Clicking the
      // camera button blurs the input synchronously before the state
      // update commits, so the closure value is stale.
      if (!autoFocus || disabled || isCameraOpenRef.current) return
      requestAnimationFrame(() => {
        // Re-check after the state has committed: the camera may have just
        // opened, or (with three ScannerInputs now sharing one screen)
        // autoFocus may have flipped to false because a different field
        // became the active one. Either makes refocusing here wrong.
        if (isCameraOpenRef.current || !autoFocusRef.current) return
        focusInput()
      })
    }

    const dispatchScan = (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) return
      if (validate) {
        // Clone the regex per-test. RegExp.test() mutates `lastIndex` for /g and
        // /y patterns, which would make the same barcode alternate between valid
        // and invalid across consecutive scans. The consumer's regex stays untouched.
        const fresh = new RegExp(validate.source, validate.flags)
        if (!fresh.test(trimmed)) {
          setValidationError(labels.validationError)
          onValidationError?.(trimmed)
          setValue('')
          return
        }
      }
      setValidationError(null)
      onScan(trimmed)
      setValue('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        dispatchScan(value)
      }
    }

    const handleManualSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      dispatchScan(value)
    }

    return (
      <div className='space-y-2'>
        <form ref={formRef} onSubmit={handleManualSubmit}>
          <InputGroup>
            <InputGroupAddon align='inline-start' className='pl-3'>
              <InputGroupText>
                <Icon
                  icon={ScanBarcodeIcon}
                  className='text-muted-foreground size-4'
                />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={isManual ? undefined : handleKeyDown}
              onBlur={isManual ? undefined : handleBlur}
              disabled={disabled}
              inputMode={isManual ? 'text' : 'none'}
              aria-label={labels.inputLabel}
              placeholder={labels.inputPlaceholder}
            />
            <InputGroupAddon align='inline-end' className='gap-1 pr-1'>
              {isManual && (
                <InputGroupButton
                  type='submit'
                  size='sm'
                  disabled={disabled || !value.trim()}>
                  {labels.submitManualEntry}
                </InputGroupButton>
              )}
              {showManualToggle && (
                <InputGroupButton
                  size='icon-sm'
                  aria-pressed={isManual}
                  aria-label={labels.manualEntryToggle}
                  disabled={disabled}
                  onClick={() => {
                    setIsManual(m => !m)
                    // Focus synchronously inside the user-gesture handler.
                    // Mobile browsers block programmatic focus that happens
                    // after the gesture window closes (e.g. from rAF callbacks).
                    focusInput()
                  }}>
                  <Icon icon={KeyboardIcon} className='size-4' />
                </InputGroupButton>
              )}
              {showCameraButton && (
                <InputGroupButton
                  size='icon-sm'
                  aria-label={labels.cameraButton}
                  disabled={disabled}
                  onClick={() => setIsCameraOpen(true)}>
                  <Icon icon={CameraIcon} className='size-4' />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </form>

        {validationError && (
          <p
            role='alert'
            aria-live='polite'
            className='text-destructive text-sm'>
            {validationError}
          </p>
        )}

        {isCameraOpen && (
          <CameraScanner
            onScan={scanned => {
              setIsCameraOpen(false)
              dispatchScan(scanned)
            }}
            onClose={() => setIsCameraOpen(false)}
            formats={cameraFormats}
            labels={labels}
          />
        )}
      </div>
    )
  },
)
ScannerInput.displayName = 'ScannerInput'

const CameraScanner = ({
  onScan,
  onClose,
  formats,
  labels,
}: {
  onScan: (value: string) => void
  onClose: () => void
  formats?: ScannerFormat[]
  labels: ScannerInputLabels
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let zxingControls: { stop: () => void } | null = null
    let stopped = false

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        // Cleanup may have run while getUserMedia was in flight. The cleanup
        // closure captured `stream === null` (assignment above hadn't committed),
        // so the just-acquired tracks would leak unless we stop them here.
        if (stopped || !videoRef.current) {
          for (const track of stream.getTracks()) track.stop()
          return
        }
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        const BarcodeDetectorCtor = (
          globalThis as unknown as {
            BarcodeDetector?: new (init?: {
              formats?: string[]
            }) => {
              detect: (
                source: ImageBitmapSource,
              ) => Promise<{ rawValue: string }[]>
            }
          }
        ).BarcodeDetector

        if (BarcodeDetectorCtor) {
          // Native BarcodeDetector accepts the same lowercase snake_case
          // vocabulary we expose, so pass them straight through. Empty array
          // would be invalid (some impls throw), so omit the option entirely.
          const detector = new BarcodeDetectorCtor(
            formats && formats.length > 0 ? { formats } : undefined,
          )
          const tick = async () => {
            if (stopped || !videoRef.current) return
            try {
              const results = await detector.detect(videoRef.current)
              // Re-check after the await — the dialog may have closed mid-detect.
              if (stopped) return
              if (results.length > 0) {
                onScan(results[0].rawValue)
                return
              }
            } catch {
              /* keep ticking */
            }
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        } else {
          const { BrowserMultiFormatReader, BarcodeFormat } = await import(
            '@zxing/browser'
          )
          const { DecodeHintType } = await import('@zxing/library')
          // Map BarcodeDetector vocabulary → zxing's BarcodeFormat enum names.
          // Most are a simple toUpperCase, but `pdf417` → `PDF_417` is the
          // exception that keeps us from doing it mechanically.
          const ZXING_NAME: Record<ScannerFormat, keyof typeof BarcodeFormat> =
            {
              aztec: 'AZTEC',
              codabar: 'CODABAR',
              code_128: 'CODE_128',
              code_39: 'CODE_39',
              code_93: 'CODE_93',
              data_matrix: 'DATA_MATRIX',
              ean_13: 'EAN_13',
              ean_8: 'EAN_8',
              itf: 'ITF',
              pdf417: 'PDF_417',
              qr_code: 'QR_CODE',
              upc_a: 'UPC_A',
              upc_e: 'UPC_E',
            }
          const allowed = formats?.map(name => BarcodeFormat[ZXING_NAME[name]])
          const hints =
            allowed && allowed.length > 0
              ? new Map<number, unknown>([
                  [DecodeHintType.POSSIBLE_FORMATS, allowed],
                ])
              : undefined
          const reader = new BrowserMultiFormatReader(
            hints as Map<number, unknown> | undefined,
          )
          const controls = await reader.decodeFromVideoElement(
            videoRef.current,
            result => {
              if (stopped) return
              if (result) onScan(result.getText())
            },
          )
          zxingControls = controls
        }
      } catch (e) {
        // Log the underlying error so dev / QA can diagnose. Common causes:
        //  - Self-signed certificate not trusted by the device → browser
        //    refuses getUserMedia on the origin.
        //  - User denied camera permission.
        //  - Browser doesn't support mediaDevices at all.
        console.error('[ScannerInput] camera unavailable:', e)
        setError(labels.cameraUnavailable)
      }
    }

    start()

    return () => {
      stopped = true
      zxingControls?.stop()
      for (const track of stream?.getTracks() ?? []) {
        track.stop()
      }
    }
  }, [onScan, labels.cameraUnavailable, formats])

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-label={labels.cameraButton}
      className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4'>
      {/* biome-ignore lint/a11y/useMediaCaption: camera viewfinder — no captions apply */}
      <video ref={videoRef} className='max-h-full max-w-full rounded' />
      {error && <p className='mt-2 text-destructive'>{error}</p>}
      <Button
        type='button'
        variant='outline'
        className='mt-4'
        onClick={onClose}>
        <Icon icon={XIcon} />
        {labels.cameraCloseButton}
      </Button>
    </div>
  )
}
