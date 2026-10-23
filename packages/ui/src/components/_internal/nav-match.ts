type NavNode = { href: string; items?: readonly NavNode[] }

/**
 * True when `pathname` is the page of `href` or a page below it: `/orders`
 * matches `/orders` and `/orders/123`, not `/orders-archive`. `/` only matches
 * itself. The query string of `href` is ignored: this answers "is the current
 * page in this section", not "is this exact filtered view open".
 */
export const isUnderPath = (pathname: string, href: string) => {
  const path = href.split('?')[0]
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * True when the current page belongs to a navigation group: its own page or
 * the page of any of its descendants. A group's href does not have to be a
 * prefix of its children's (e.g. "Deliveries" → /deliveries/dashboard with a
 * child at /deliveries/tours).
 */
export const isInSection = (pathname: string, node: NavNode): boolean =>
  isUnderPath(pathname, node.href) ||
  (node.items ?? []).some(child => isInSection(pathname, child))

/**
 * The top-level href to highlight among `hrefs`: the one whose section holds
 * the current page, the longest when several do. `/products` stays active on
 * `/products/123`, but a sibling `/products/archive` wins on its own pages.
 */
export const activeTopLevel = (
  pathname: string,
  hrefs: readonly string[],
): string | undefined =>
  hrefs
    .filter(href => isUnderPath(pathname, href))
    .sort((a, b) => b.split('?')[0].length - a.split('?')[0].length)[0]
