// Scan-feedback sound utilities. The component itself is silent — consumers
// invoke `playScanSuccess` / `playScanError` at API-resolution boundaries
// (not on scan capture).
//
// Audio URLs are not bundled with this package because Turbopack lacks a
// native MP3 loader. Instead, each consuming app provides its own URLs via
// `configureScanSounds` (call once at boot) and serves the files from
// wherever it likes — typically `public/sounds/`. Until configured, the
// play functions are no-ops, so stories and SSR render without crashing.

type ScanSoundConfig = {
  success: string
  error: string
}

let config: ScanSoundConfig | null = null
let successAudio: HTMLAudioElement | null = null
let errorAudio: HTMLAudioElement | null = null

export const configureScanSounds = (next: ScanSoundConfig): void => {
  config = next
  // Reset any cached <audio> elements so the new URLs take effect.
  successAudio = null
  errorAudio = null
}

const ensureLoaded = () => {
  if (typeof window === 'undefined' || !config) return
  if (!successAudio) successAudio = new Audio(config.success)
  if (!errorAudio) errorAudio = new Audio(config.error)
}

export const playScanSuccess = (): void => {
  ensureLoaded()
  successAudio?.play().catch(() => {
    /* autoplay-policy rejection — irrelevant since scans are user-initiated */
  })
}

export const playScanError = (): void => {
  ensureLoaded()
  errorAudio?.play().catch(() => {})
}
