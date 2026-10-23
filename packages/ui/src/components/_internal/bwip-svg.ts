import { toSVG } from '@bwip-js/browser'

export type BwipSymbol =
  | 'qrcode'
  | 'code128'
  | 'code39'
  | 'ean13'
  | 'ean8'
  | 'upca'
  | 'upce'
  | 'itf'
  | 'itf14'
  | 'datamatrix'
  | 'pdf417'
  | 'aztec'

const SYMBOL_TO_BCID: Record<BwipSymbol, string> = {
  qrcode: 'qrcode',
  code128: 'code128',
  code39: 'code39',
  ean13: 'ean13',
  ean8: 'ean8',
  upca: 'upca',
  upce: 'upce',
  itf: 'interleaved2of5',
  itf14: 'itf14',
  datamatrix: 'datamatrix',
  pdf417: 'pdf417',
  aztec: 'azteccode',
}

type RenderBwipSvgOptions = {
  symbol: BwipSymbol
  value: string
}

const stripDimensions = (svg: string): string =>
  svg.replace(/<svg\b([^>]*)>/, (_m, attrs) => {
    const next = attrs.replace(/\s(?:width|height)="[^"]*"/g, '')
    return `<svg${next}>`
  })

export const renderBwipSvg = (opts: RenderBwipSvgOptions): string => {
  const { symbol, value } = opts
  const bcid = SYMBOL_TO_BCID[symbol]

  const bwipOpts: Record<string, unknown> = {
    bcid,
    text: value,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  }

  let svg = toSVG(bwipOpts as unknown as Parameters<typeof toSVG>[0])
  svg = stripDimensions(svg)
  svg = svg.replace(/<svg\b([^>]*)>/, '<svg$1 fill="currentColor">')

  return svg
}
