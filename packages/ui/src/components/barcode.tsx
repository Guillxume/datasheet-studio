import { useEffect, useMemo } from 'react'
import { type BwipSymbol, renderBwipSvg } from './_internal/bwip-svg'
import { SvgHost } from './_internal/svg-host'

export type BarcodeFormat = Exclude<BwipSymbol, 'qrcode'>

export type BarcodeLabels = {
  invalid?: (format: BarcodeFormat) => string
  defaultAriaLabel?: (format: BarcodeFormat, value: string) => string
}

export type BarcodeProps = {
  value: string
  format: BarcodeFormat
  className?: string
  'aria-label'?: string
  onError?: (err: Error) => void
  labels?: BarcodeLabels
}

export const Barcode = ({
  value,
  format,
  className,
  'aria-label': ariaLabel,
  onError,
  labels,
}: BarcodeProps) => {
  const result = useMemo<{ svg: string } | { error: Error }>(() => {
    try {
      return { svg: renderBwipSvg({ symbol: format, value }) }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }, [format, value])

  const error = 'error' in result ? result.error : undefined
  useEffect(() => {
    if (error) onError?.(error)
  }, [error, onError])

  const label =
    ariaLabel ??
    labels?.defaultAriaLabel?.(format, value) ??
    `${format} barcode: ${value}`

  if ('error' in result) {
    return (
      <span data-error role='img' aria-label={label} className={className}>
        {labels?.invalid?.(format) ?? `Invalid ${format} barcode`}
      </span>
    )
  }

  return <SvgHost svg={result.svg} aria-label={label} className={className} />
}
