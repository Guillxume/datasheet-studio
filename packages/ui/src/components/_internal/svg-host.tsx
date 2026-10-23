import { useEffect, useRef } from 'react'

export type SvgHostProps = {
  svg: string
  className?: string
  'aria-label': string
}

export const SvgHost = ({
  svg,
  className,
  'aria-label': ariaLabel,
}: SvgHostProps) => {
  const ref = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const svgEl = doc.documentElement
    if (svgEl.nodeName !== 'svg') {
      node.replaceChildren()
      return
    }
    const adopted = node.ownerDocument.importNode(svgEl, true)
    node.replaceChildren(adopted)
  }, [svg])

  return (
    <span ref={ref} role='img' aria-label={ariaLabel} className={className} />
  )
}
