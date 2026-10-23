import { useEffect, useMemo } from 'react'
import { renderBwipSvg } from './_internal/bwip-svg'
import { SvgHost } from './_internal/svg-host'

export type QRCodeLabels = {
  invalid?: string
  defaultAriaLabel?: (value: string) => string
}

export type QRCodeProps = {
  value: string
  className?: string
  'aria-label'?: string
  onError?: (err: Error) => void
  labels?: QRCodeLabels
}

export const QRCode = ({
  value,
  className,
  'aria-label': ariaLabel,
  onError,
  labels,
}: QRCodeProps) => {
  const result = useMemo<{ svg: string } | { error: Error }>(() => {
    try {
      return { svg: renderBwipSvg({ symbol: 'qrcode', value }) }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }, [value])

  const error = 'error' in result ? result.error : undefined
  useEffect(() => {
    if (error) onError?.(error)
  }, [error, onError])

  const label =
    ariaLabel ?? labels?.defaultAriaLabel?.(value) ?? `QR code: ${value}`

  if ('error' in result) {
    return (
      <span data-error role='img' aria-label={label} className={className}>
        {labels?.invalid ?? 'Invalid QR code'}
      </span>
    )
  }

  return <SvgHost svg={result.svg} aria-label={label} className={className} />
}
