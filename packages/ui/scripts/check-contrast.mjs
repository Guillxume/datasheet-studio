// Checks every theme in src/themes/ against WCAG 2 level AA, in light (:root)
// and dark (.dark): 4.5:1 for text on its background, 3:1 for UI components.
// Also checks what Button and Badge actually render for destructive in dark
// mode: white text on bg-destructive/60 (and /80 on hover) over the background.
// Exits 1 and lists every pair below its minimum.
import { readdirSync, readFileSync } from 'node:fs'

// [text token, background token, minimum]
const PAIRS = [
  ['foreground', 'background', 4.5],
  ['card-foreground', 'card', 4.5],
  ['popover-foreground', 'popover', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'muted', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['destructive', 'background', 4.5],
  ['sidebar-foreground', 'sidebar', 4.5],
  ['sidebar-primary-foreground', 'sidebar-primary', 4.5],
  ['sidebar-accent-foreground', 'sidebar-accent', 4.5],
  ['ring', 'background', 3],
  ['primary', 'background', 3],
]

const encode = c =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
const decode = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

const fromHsl = (h, s, l) => {
  s /= 100
  l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  return [0, 8, 4].map(
    n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)),
  )
}

// OKLCH -> OKLab -> linear sRGB (Björn Ottosson's matrices) -> gamma-encoded
const fromOklch = (L, C, H) => {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(v => encode(Math.min(1, Math.max(0, v))))
}

/** Gamma-encoded sRGB in 0..1, or null for translucent / unsupported values. */
const parse = value => {
  let m = value.match(/^hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)$/)
  if (m) return fromHsl(+m[1], +m[2], +m[3])
  m = value.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/)
  if (m) return fromOklch(+m[1], +m[2], +m[3])
  m = value.match(/^#([0-9a-f]{6})$/i)
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
  return null
}

const luminance = rgb => {
  const [r, g, b] = rgb.map(decode)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
// Alpha compositing as browsers do it, in gamma-encoded sRGB
const over = (fg, bg, alpha) =>
  fg.map((c, i) => alpha * c + (1 - alpha) * bg[i])

const failures = []
let checked = 0
for (const file of readdirSync('src/themes').filter(f => f.endsWith('.css'))) {
  const css = readFileSync(`src/themes/${file}`, 'utf8')
  for (const [mode, selector] of [
    ['light', ':root,\\s*\\.light'],
    ['dark', '\\.dark'],
  ]) {
    const body = css.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1]
    if (!body) {
      failures.push(`${file} ${mode}: no ${selector} block`)
      continue
    }
    const vars = Object.fromEntries(
      [...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(m => [
        m[1],
        m[2].trim(),
      ]),
    )
    const color = name => {
      const rgb = vars[name] && parse(vars[name])
      if (!rgb)
        failures.push(`${file} ${mode}: --${name} missing or not hsl/oklch/hex`)
      return rgb
    }

    const checks = PAIRS.map(([fg, bg, min]) => [
      `--${fg} on --${bg}`,
      color(fg),
      color(bg),
      min,
    ])
    if (mode === 'dark') {
      const destructive = color('destructive')
      const background = color('background')
      if (destructive && background)
        for (const alpha of [0.6, 0.8])
          checks.push([
            `white on bg-destructive/${alpha * 100}`,
            [1, 1, 1],
            over(destructive, background, alpha),
            4.5,
          ])
    }
    for (const [label, fg, bg, min] of checks) {
      if (!fg || !bg) continue
      checked++
      const r = ratio(fg, bg)
      if (r < min)
        failures.push(
          `${file} ${mode}: ${label} = ${r.toFixed(2)}:1 (min ${min}:1)`,
        )
    }
  }
}

if (failures.length > 0) {
  console.error(
    `check-contrast: ${failures.length} problem(s)\n${failures.join('\n')}`,
  )
  process.exit(1)
}
console.log(`check-contrast: ${checked} pairs pass WCAG 2 AA`)
