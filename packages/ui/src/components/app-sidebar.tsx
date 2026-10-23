'use client'

import { ChevronRightIcon, type LucideIcon } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { activeTopLevel, isInSection } from './_internal/nav-match'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Icon } from './icon'
import { MobileNavDrawer, type MobileNavItem } from './mobile-nav'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from './sidebar'

type AppNavLink = { title: string; href: string }

type AppNavSubItem = AppNavLink & {
  /** One more level, rendered as a nested collapsible. */
  items?: AppNavLink[]
}

type AppNavItem = AppNavLink & {
  icon: LucideIcon
  items?: AppNavSubItem[]
}

type AppNavGroup = {
  /** Visible group title, already translated. */
  label: string
  items: AppNavItem[]
}

type AppSidebarNav = {
  /** Items at the top of the sidebar, under `labels.mainGroup`. */
  main: AppNavItem[]
  /**
   * More titled groups, rendered in order after `main` (e.g. Catalog, Data
   * model, Settings). Empty groups are skipped. On mobile they follow `main`
   * in the drawer.
   */
  groups?: AppNavGroup[]
  /** Items pinned to the bottom (settings, configuration). */
  secondary: AppNavItem[]
}

type AppSidebarLinkProps = {
  href: string
  onClick?: () => void
  className?: string
  children: ReactNode
}

type AppSidebarLabels = {
  mainGroup: string
  secondaryGroup: string
  sidebarTitle: string
  sidebarDescription: string
  toggleSidebar: string
  mobileNavBackToNavigation: string
  mobileNavBackToItem: (title: string) => string
}

const DEFAULT_LABELS: AppSidebarLabels = {
  mainGroup: 'Main',
  secondaryGroup: 'Configuration',
  sidebarTitle: 'Navigation',
  sidebarDescription: 'Main navigation',
  toggleSidebar: 'Toggle Sidebar',
  mobileNavBackToNavigation: 'Back to navigation',
  mobileNavBackToItem: title => `Back to ${title}`,
}

type AppSidebarProps = {
  /**
   * Items the current user may see, already filtered by the app (roles, auth
   * provider). `null` while they are still being resolved: renders skeletons.
   */
  nav: AppSidebarNav | null
  /** Brand block at the top, usually a `SidebarHeader` with the logo. */
  header: ReactNode
  /** Current path as the app's router reports it (without locale prefix). */
  pathname: string
  /** Current query string, without `?`. Sub-items whose href has a query are active when the URL contains all of its params. */
  search?: string
  /** The app's link component, e.g. next-intl's `Link`, which adds the locale prefix. */
  linkComponent: ComponentType<AppSidebarLinkProps>
  /** Navigation from the mobile drawer, which navigates programmatically. */
  onMobileNavigate: (href: string) => void
  /** Skeleton rows shown while `nav` is `null`. */
  skeleton?: { main: number; secondary: number }
  labels?: Partial<AppSidebarLabels>
}

/** Check if a nav sub-item href matches the current URL (pathname + search). */
const isSubItemActive = (
  subHref: string,
  pathname: string,
  fullUrl: string,
) => {
  if (!subHref.includes('?')) return pathname === subHref

  const [subPath, subSearch] = subHref.split('?')
  if (pathname !== subPath) return false

  // Subset match: the current URL must contain at least all query params from subHref
  const requiredParams = new URLSearchParams(subSearch)
  const currentParams = new URLSearchParams(fullUrl.split('?')[1] ?? '')

  for (const [key, value] of requiredParams) {
    if (!currentParams.getAll(key).includes(value)) return false
  }
  return true
}

/** Query params an href requires: 0 for a bare path. */
const specificity = (href: string) =>
  href.includes('?') ? [...new URLSearchParams(href.split('?')[1])].length : 0

/**
 * Among sibling sub-items, the hrefs to highlight: those matching the current
 * URL with the most query params. On a filtered list, "To confirm"
 * (/orders?status=to_do) wins over "All orders" (/orders); with no filter, or
 * params no sibling asks for (e.g. page=2), "All orders" stays highlighted.
 */
const activeSubItems = (
  items: readonly { href: string; items?: unknown }[],
  pathname: string,
  fullUrl: string,
) => {
  const matching = items
    .filter(item => !item.items)
    .map(item => item.href)
    .filter(href => isSubItemActive(href, pathname, fullUrl))
  const best = Math.max(-1, ...matching.map(specificity))
  return new Set(matching.filter(href => specificity(href) === best))
}

type NavItemProps = {
  item: AppNavItem
  /** Top-level item the current page belongs to (see `activeTopLevel`). */
  activeHref: string | undefined
  pathname: string
  fullUrl: string
  Link: ComponentType<AppSidebarLinkProps>
  onNavigate: () => void
}

const NavItemSimple = ({
  item,
  activeHref,
  Link,
  onNavigate,
}: NavItemProps) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      asChild
      isActive={activeHref === item.href}
      tooltip={item.title}>
      <Link href={item.href} onClick={onNavigate}>
        <Icon icon={item.icon} />
        <span>{item.title}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
)

const NavItemCollapsible = ({
  item,
  pathname,
  fullUrl,
  Link,
  onNavigate,
}: NavItemProps) => {
  const isActive = isInSection(pathname, item)
  const activeHrefs = activeSubItems(item.items ?? [], pathname, fullUrl)

  return (
    <SidebarMenuItem>
      <Collapsible
        defaultOpen={isActive}
        className='group/collapsible group-data-[collapsible=icon]:hidden'>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive}>
            <Icon icon={item.icon} />
            <span>{item.title}</span>
            <Icon
              icon={ChevronRightIcon}
              className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90'
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map(subItem =>
              subItem.items ? (
                <Collapsible
                  key={subItem.href}
                  defaultOpen={isInSection(pathname, subItem)}
                  className='group/nested'>
                  <SidebarMenuSubItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuSubButton
                        isActive={isInSection(pathname, subItem)}>
                        <span>{subItem.title}</span>
                        <Icon
                          icon={ChevronRightIcon}
                          className='ml-auto size-3 transition-transform duration-200 group-data-[state=open]/nested:rotate-90'
                        />
                      </SidebarMenuSubButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {subItem.items.map(nested => (
                          <SidebarMenuSubItem key={nested.href}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={activeSubItems(
                                subItem.items ?? [],
                                pathname,
                                fullUrl,
                              ).has(nested.href)}>
                              <Link href={nested.href} onClick={onNavigate}>
                                <span>{nested.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuSubItem>
                </Collapsible>
              ) : (
                <SidebarMenuSubItem key={subItem.href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={activeHrefs.has(subItem.href)}>
                    <Link href={subItem.href} onClick={onNavigate}>
                      <span>{subItem.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ),
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={isActive}
            className='hidden group-data-[collapsible=icon]:flex'>
            <Icon icon={item.icon} />
            <span>{item.title}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' className='min-w-36'>
          <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items?.flatMap(subItem =>
            subItem.items ? (
              subItem.items.map(nested => (
                <DropdownMenuItem key={nested.href} asChild>
                  <Link href={nested.href} onClick={onNavigate}>
                    {nested.title}
                  </Link>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem key={subItem.href} asChild>
                <Link href={subItem.href} onClick={onNavigate}>
                  {subItem.title}
                </Link>
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

const SkeletonGroup = ({
  rows,
  prefix,
  className,
}: {
  rows: number
  prefix: string
  className?: string
}) => (
  <SidebarGroup className={className}>
    <SidebarGroupLabel aria-hidden className='invisible'>
      &nbsp;
    </SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {Array.from({ length: rows }, (_, i) => `${prefix}-${i + 1}`).map(
          key => (
            <SidebarMenuItem key={key}>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          ),
        )}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
)

const toMobileNavItems = (items: AppNavItem[]): MobileNavItem[] =>
  items.map(item => ({
    id: item.href,
    title: item.title,
    href: item.href,
    icon: item.icon,
    items: item.items?.map(sub => ({
      title: sub.title,
      href: sub.href,
      items: sub.items,
    })),
  }))

/**
 * The application sidebar shared by internal tools: collapsible on desktop
 * (flyout menus when collapsed to icons), drill-down drawer on mobile.
 * Must be rendered inside a `SidebarProvider`.
 *
 * It only renders: which items a user may see, and how to navigate, stay in
 * the app.
 */
function AppSidebar({
  nav,
  header,
  pathname,
  search = '',
  linkComponent: Link,
  onMobileNavigate,
  skeleton = { main: 2, secondary: 0 },
  labels: labelsProp,
}: AppSidebarProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const { isMobile, setOpenMobile } = useSidebar()
  const fullUrl = search ? `${pathname}?${search}` : pathname

  const shell = (children: ReactNode) => (
    <Sidebar
      collapsible='icon'
      mobileTitle={labels.sidebarTitle}
      mobileDescription={labels.sidebarDescription}>
      {header}
      <SidebarContent>{children}</SidebarContent>
      <SidebarRail label={labels.toggleSidebar} />
    </Sidebar>
  )

  if (!nav) {
    return shell(
      <>
        <SkeletonGroup rows={skeleton.main} prefix='top' />
        {skeleton.secondary > 0 && (
          <SkeletonGroup
            rows={skeleton.secondary}
            prefix='bottom'
            className='mt-auto border-t'
          />
        )}
      </>,
    )
  }

  const groups = (nav.groups ?? []).filter(group => group.items.length > 0)
  // A simple top-level item is active on its page and the pages below it,
  // unless a more specific top-level item also matches.
  const activeHref = activeTopLevel(
    pathname,
    [...nav.main, ...groups.flatMap(group => group.items), ...nav.secondary]
      .filter(item => !item.items)
      .map(item => item.href),
  )

  if (isMobile) {
    return (
      <MobileNavDrawer
        items={toMobileNavItems([
          ...nav.main,
          ...groups.flatMap(group => group.items),
        ])}
        configItems={toMobileNavItems(nav.secondary)}
        activeHref={pathname}
        onNavigate={onMobileNavigate}
        labels={{
          backToNavigation: labels.mobileNavBackToNavigation,
          backToItem: labels.mobileNavBackToItem,
          title: labels.sidebarTitle,
          description: labels.sidebarDescription,
        }}
      />
    )
  }

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false)
  }

  const renderNavItems = (items: AppNavItem[]) =>
    items.map(item => {
      const props = {
        item,
        activeHref,
        pathname,
        fullUrl,
        Link,
        onNavigate: closeMobileSidebar,
      }
      return item.items ? (
        <NavItemCollapsible key={item.href} {...props} />
      ) : (
        <NavItemSimple key={item.href} {...props} />
      )
    })

  return shell(
    <>
      {nav.main.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>{labels.mainGroup}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(nav.main)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {groups.map(group => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(group.items)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}

      {nav.secondary.length > 0 && (
        <SidebarGroup className='mt-auto border-t'>
          <SidebarGroupLabel>{labels.secondaryGroup}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(nav.secondary)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>,
  )
}

export {
  AppSidebar,
  type AppNavGroup,
  type AppNavItem,
  type AppNavSubItem,
  type AppSidebarLinkProps,
  type AppSidebarNav,
}
