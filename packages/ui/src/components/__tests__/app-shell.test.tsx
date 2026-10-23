// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { HomeIcon, PackageIcon, SettingsIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS_STORAGE_KEY } from '../../lib/settings-storage'
import { AppHeader } from '../app-header'
import {
  AppSidebar,
  type AppSidebarLinkProps,
  type AppSidebarNav,
} from '../app-sidebar'
import { DropdownMenuItem } from '../dropdown-menu'
import { SettingsProvider } from '../settings-provider'
import { SidebarProvider } from '../sidebar'
import { UserMenu } from '../user-menu'

const mobile = vi.hoisted(() => ({ value: false }))
vi.mock('../../hooks/use-mobile', () => ({ useIsMobile: () => mobile.value }))

// jsdom lacks both; Radix menus and SettingsProvider use them on mount.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

const Link = ({ href, children, ...rest }: AppSidebarLinkProps) => (
  <a href={href} data-app-link {...rest}>
    {children}
  </a>
)

const NAV: AppSidebarNav = {
  main: [
    { title: 'Home', href: '/', icon: HomeIcon },
    {
      title: 'Orders',
      href: '/orders',
      icon: PackageIcon,
      items: [
        { title: 'All orders', href: '/orders' },
        { title: 'To confirm', href: '/orders?status=to_do' },
      ],
    },
  ],
  secondary: [{ title: 'Settings', href: '/settings', icon: SettingsIcon }],
}

const renderSidebar = (props: Partial<Parameters<typeof AppSidebar>[0]> = {}) =>
  render(
    <SidebarProvider>
      <AppSidebar
        nav={NAV}
        header={<div>Brand</div>}
        pathname='/'
        linkComponent={Link}
        onMobileNavigate={() => {}}
        {...props}
      />
    </SidebarProvider>,
  )

const withSettings = (ui: ReactNode) => (
  <SettingsProvider>
    <SidebarProvider>{ui}</SidebarProvider>
  </SettingsProvider>
)

beforeEach(() => {
  mobile.value = false
  localStorage.clear()
})

describe('AppSidebar', () => {
  it('renders links through the app link component', () => {
    renderSidebar()
    const home = screen.getByRole('link', { name: 'Home' })
    expect(home).toHaveAttribute('href', '/')
    expect(home).toHaveAttribute('data-app-link')
  })

  it('renders the header slot and both groups with their labels', () => {
    renderSidebar({ labels: { mainGroup: 'Menu', secondaryGroup: 'Admin' } })
    expect(screen.getByText('Brand')).toBeInTheDocument()
    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it('renders extra titled groups between main and secondary', () => {
    renderSidebar({
      nav: {
        ...NAV,
        groups: [
          {
            label: 'Data model',
            items: [{ title: 'Families', href: '/families', icon: HomeIcon }],
          },
          { label: 'Empty group', items: [] },
        ],
      },
    })
    expect(screen.getByText('Data model')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Families' })).toBeInTheDocument()
    expect(screen.queryByText('Empty group')).not.toBeInTheDocument()
  })

  it('keeps a simple item active on the pages below it', () => {
    renderSidebar({
      nav: {
        ...NAV,
        groups: [
          {
            label: 'Data model',
            items: [{ title: 'Families', href: '/families', icon: HomeIcon }],
          },
        ],
      },
      pathname: '/families/chairs',
    })
    expect(
      screen.getByRole('link', { name: 'Families' }).closest('[data-active]'),
    ).toHaveAttribute('data-active', 'true')
    expect(
      screen.getByRole('link', { name: 'Home' }).closest('[data-active]'),
    ).toHaveAttribute('data-active', 'false')
  })

  it('omits a group with no items', () => {
    renderSidebar({ nav: { ...NAV, secondary: [] } })
    expect(screen.queryByText('Configuration')).not.toBeInTheDocument()
  })

  it('marks the item matching the pathname as active', () => {
    renderSidebar({ pathname: '/' })
    expect(
      screen.getByRole('link', { name: 'Home' }).closest('[data-active]'),
    ).toHaveAttribute('data-active', 'true')
  })

  it('opens the group containing the current page', () => {
    renderSidebar({ pathname: '/orders' })
    expect(screen.getByRole('link', { name: 'All orders' })).toBeInTheDocument()
  })

  it('activates a sub-item with a query only when the URL has all its params', () => {
    renderSidebar({ pathname: '/orders', search: 'status=to_do&page=2' })
    expect(screen.getByRole('link', { name: 'To confirm' })).toHaveAttribute(
      'data-active',
      'true',
    )
  })

  it('does not activate a sub-item with a query when a param is missing', () => {
    renderSidebar({ pathname: '/orders', search: 'page=2' })
    expect(screen.getByRole('link', { name: 'To confirm' })).toHaveAttribute(
      'data-active',
      'false',
    )
  })

  describe('only the most specific sub-item is active (STK-574)', () => {
    const active = (name: string) =>
      screen.getByRole('link', { name }).getAttribute('data-active')

    it('on a filtered list, the filtered view wins over the bare path', () => {
      renderSidebar({ pathname: '/orders', search: 'status=to_do&page=2' })
      expect(active('To confirm')).toBe('true')
      expect(active('All orders')).toBe('false')
    })

    it('with no filter, the bare path is active', () => {
      renderSidebar({ pathname: '/orders' })
      expect(active('All orders')).toBe('true')
      expect(active('To confirm')).toBe('false')
    })

    it('with params no sibling asks for, the bare path stays active', () => {
      renderSidebar({ pathname: '/orders', search: 'page=2' })
      expect(active('All orders')).toBe('true')
    })
  })

  describe('a group is active anywhere in its section (STK-573)', () => {
    // Same shape as WMS: the group's href is not a prefix of its children's
    const DELIVERIES: AppSidebarNav = {
      main: [
        {
          title: 'Deliveries',
          href: '/deliveries/dashboard',
          icon: PackageIcon,
          items: [
            { title: 'Delivery dashboard', href: '/deliveries/dashboard' },
            {
              title: 'Tours',
              href: '/deliveries/tours',
              items: [
                { title: 'Tour list', href: '/deliveries/tours' },
                { title: 'Tour report', href: '/deliveries/tours/report' },
              ],
            },
          ],
        },
      ],
      secondary: [],
    }
    // Two buttons carry the group title: the collapsible trigger, then the
    // flyout trigger shown only when the sidebar is collapsed to icons
    const groupButton = () =>
      screen.getAllByRole('button', { name: 'Deliveries' })[0]

    it('opens and highlights the group and its nested level on a child page', () => {
      renderSidebar({ nav: DELIVERIES, pathname: '/deliveries/tours/report' })
      expect(groupButton()).toHaveAttribute('data-active', 'true')
      // The nested level's trigger is an <a> without href, so it has no role
      expect(
        screen.getByText('Tours').closest('[data-active]'),
      ).toHaveAttribute('data-active', 'true')
      expect(screen.getByRole('link', { name: 'Tour report' })).toHaveAttribute(
        'data-active',
        'true',
      )
      expect(screen.getByRole('link', { name: 'Tour list' })).toHaveAttribute(
        'data-active',
        'false',
      )
    })

    it('stays closed outside its section, even on a lookalike path', () => {
      renderSidebar({ nav: DELIVERIES, pathname: '/deliveries/dashboard-old' })
      expect(groupButton()).toHaveAttribute('data-active', 'false')
      expect(screen.queryByRole('link', { name: 'Tour list' })).toBeNull()
    })
  })

  it('renders skeleton rows while nav is null', () => {
    const { container } = renderSidebar({
      nav: null,
      skeleton: { main: 3, secondary: 2 },
    })
    expect(
      container.querySelectorAll('[data-sidebar="menu-skeleton"]'),
    ).toHaveLength(5)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders the mobile drawer instead of the sidebar on mobile', () => {
    mobile.value = true
    const { container } = renderSidebar()
    expect(container.querySelector('[data-sidebar="sidebar"]')).toBeNull()
    expect(screen.queryByText('Brand')).not.toBeInTheDocument()
  })
})

describe('AppHeader', () => {
  it('places the slots around the separator and the actions last', () => {
    render(
      withSettings(
        <AppHeader
          leading={<span>badge</span>}
          actions={<span>user</span>}
          labels={{ toggleSidebar: 'Toggle' }}>
          <span>search</span>
        </AppHeader>,
      ),
    )
    const header = screen.getByRole('banner')
    const text = header.textContent ?? ''
    expect(text.indexOf('badge')).toBeLessThan(text.indexOf('search'))
    expect(text.indexOf('search')).toBeLessThan(text.indexOf('user'))
    expect(screen.getByRole('button', { name: 'Toggle' })).toBeInTheDocument()
  })
})

describe('UserMenu', () => {
  const LOCALES = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
  ]

  const open = async () => {
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'User menu' }), {
        key: 'Enter',
      })
    })
  }

  const renderMenu = (props: Partial<Parameters<typeof UserMenu>[0]> = {}) =>
    render(
      withSettings(
        <UserMenu
          trigger='U'
          locales={LOCALES}
          locale='en'
          onLocaleChange={() => {}}
          onSignOut={() => {}}
          {...props}
        />,
      ),
    )

  it('shows the user details when given', async () => {
    renderMenu({ user: { name: 'jane@example.com', detail: 'admin' } })
    await open()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('has no Language entry without locales', async () => {
    render(withSettings(<UserMenu trigger='U' onSignOut={() => {}} />))
    await open()
    expect(screen.queryByText('Language')).not.toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })

  it('renders app-specific items', async () => {
    renderMenu({
      children: <DropdownMenuItem>Warehouse settings</DropdownMenuItem>,
    })
    await open()
    expect(
      screen.getByRole('menuitem', { name: 'Warehouse settings' }),
    ).toBeInTheDocument()
  })

  it('saves the chosen locale in the settings, then calls onLocaleChange', async () => {
    const onLocaleChange = vi.fn()
    renderMenu({ onLocaleChange })
    await open()
    await act(async () => {
      fireEvent.keyDown(
        screen.getByText('Language').closest('[role="menuitem"]') as Element,
        { key: 'ArrowRight' },
      )
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Français' }))
    })
    expect(onLocaleChange).toHaveBeenCalledWith('fr')
    const saved = JSON.parse(
      localStorage.getItem(DEFAULT_SETTINGS_STORAGE_KEY) ?? '{}',
    )
    expect(saved.locale).toBe('fr')
  })

  it('calls onSignOut when signing out', async () => {
    const onSignOut = vi.fn()
    renderMenu({ onSignOut })
    await open()
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    })
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
