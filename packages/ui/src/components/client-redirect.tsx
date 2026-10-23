import type { Metadata } from 'next'

import { DEFAULT_SETTINGS_STORAGE_KEY } from '../lib/settings-storage'

/**
 * Metadata for a page that only exists to bounce visitors to a
 * locale-prefixed URL — marks it non-indexable since it has no content of
 * its own worth surfacing in search results.
 */
export const redirectPageMetadata: Metadata = {
  title: 'Redirecting...',
  robots: { index: false, follow: false },
}

/**
 * Builds the inline script for `ClientRedirect`: checks localStorage for a
 * saved locale preference, validates it against the configured locales, and
 * redirects. Falls back to `defaultUrl`. No user input involved — only reads
 * a value previously set by the app.
 *
 * `storageKey` must match the one given to `SettingsProvider`, otherwise the
 * saved locale is never found and every visit lands on `defaultUrl`.
 */
export function buildLocaleRedirectScript(
  locales: readonly string[],
  defaultUrl: string,
  storageKey: string = DEFAULT_SETTINGS_STORAGE_KEY,
) {
  const localesJson = JSON.stringify(locales).replace(/</g, '\\u003c')
  const defaultUrlJson = JSON.stringify(defaultUrl).replace(/</g, '\\u003c')
  const storageKeyJson = JSON.stringify(storageKey).replace(/</g, '\\u003c')
  return `(function () {
  try {
    var s = JSON.parse(localStorage.getItem(${storageKeyJson}) || "{}");
    var l = s.locale;
  } catch (e) {}
  if (l && ${localesJson}.includes(l)) {
    location.replace("/" + l + "/");
  } else {
    location.replace(${defaultUrlJson});
  }
})();`
}

type ClientRedirectProps = {
  /** Inline script executed on the client to perform the redirect. */
  script: string
  /** URL used for the `<noscript>` meta-refresh fallback and the visible link. */
  fallbackUrl: string
}

export function ClientRedirect({ script, fallbackUrl }: ClientRedirectProps) {
  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: script is caller-provided, not user input
        dangerouslySetInnerHTML={{ __html: script }}
      />
      <noscript>
        <meta httpEquiv='refresh' content={`0;url=${fallbackUrl}`} />
      </noscript>
      {/* No labels prop: this text renders before locale is known. */}
      <p>
        Redirecting to <a href={fallbackUrl}>{fallbackUrl}</a>...
      </p>
    </>
  )
}
