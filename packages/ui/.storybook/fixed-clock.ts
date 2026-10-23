/**
 * Chromatic captures stories on different days. A story that shows "today"
 * (a calendar, a date picker) would differ from its baseline on every build,
 * so during Chromatic captures the clock is frozen. Chromatic marks its
 * browser with "Chromatic" in the user agent; `?chromatic=true` does the same
 * locally, to check a story as Chromatic will capture it.
 *
 * The date is the one the main baselines were captured on.
 */
const FIXED_NOW = new Date(2026, 9, 12, 12).getTime()

const inChromatic =
  typeof window !== 'undefined' &&
  (/Chromatic/.test(window.navigator.userAgent) ||
    /[?&]chromatic=true\b/.test(window.location.search))

if (inChromatic) {
  const RealDate = Date
  class FixedDate extends RealDate {
    constructor(...args: [] | ConstructorParameters<DateConstructor>) {
      if (args.length === 0) super(FIXED_NOW)
      else super(...(args as ConstructorParameters<DateConstructor>))
    }

    static override now() {
      return FIXED_NOW
    }
  }
  globalThis.Date = FixedDate as DateConstructor
}
