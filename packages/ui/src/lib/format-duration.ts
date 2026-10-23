// Intl.DurationFormat is Stage 4 and supported in all modern browsers,
// but TypeScript's lib.d.ts doesn't include it yet.
declare namespace Intl {
  interface DurationFormatOptions {
    style?: 'long' | 'short' | 'narrow' | 'digital'
    hoursDisplay?: 'auto' | 'always'
    minutesDisplay?: 'auto' | 'always'
  }

  class DurationFormat {
    constructor(locale: string, options?: DurationFormatOptions)
    format(duration: { hours?: number; minutes?: number }): string
  }
}

const formatterCache = new Map<string, Intl.DurationFormat>()

const getFormatter = (locale: string): Intl.DurationFormat => {
  let formatter = formatterCache.get(locale)
  if (!formatter) {
    formatter = new Intl.DurationFormat(locale, { style: 'narrow' })
    formatterCache.set(locale, formatter)
  }
  return formatter
}

/**
 * Format a duration in minutes using `Intl.DurationFormat`.
 *
 * @param minutes - Duration in minutes, or `null`/`undefined` for a dash placeholder.
 * @param locale  - BCP 47 locale tag (e.g. `"en"`, `"fr"`). Defaults to `"en"`.
 * @returns Formatted string like `"2h 30min"` (narrow style) or `"—"` if null.
 */
export const formatDuration = (
  minutes: number | null | undefined,
  locale = 'en',
): string => {
  if (minutes === null || minutes === undefined) return '—'
  const totalMinutes = Math.round(minutes)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  // Only pass non-zero units to the formatter so a 20-minute duration renders
  // as "20min" (not "0h 20min") and a 60-minute duration renders as "1h" (not
  // "1h 0min"). When the total is exactly zero we still want a value to show,
  // so fall through to "0min".
  const duration =
    h > 0 && m > 0
      ? { hours: h, minutes: m }
      : h > 0
        ? { hours: h }
        : { minutes: m }
  return getFormatter(locale).format(duration)
}
