import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  HomeIcon,
  PackageIcon,
  SettingsIcon,
  TruckIcon,
  UserIcon,
} from 'lucide-react'
import { useState } from 'react'
import { themeModes } from '../../.storybook/modes'
import { AppHeader } from './app-header'
import {
  AppSidebar,
  type AppSidebarLinkProps,
  type AppSidebarNav,
} from './app-sidebar'
import { DropdownMenuItem, DropdownMenuSeparator } from './dropdown-menu'
import { Icon } from './icon'
import { Input } from './input'
import { SettingsProvider } from './settings-provider'
import { SidebarHeader, SidebarInset, SidebarProvider } from './sidebar'
import { UserMenu } from './user-menu'

const meta = {
  title: 'Navigation/App Shell',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const NAV: AppSidebarNav = {
  main: [
    { title: 'Dashboard', href: '/', icon: HomeIcon },
    {
      title: 'Orders',
      href: '/orders',
      icon: PackageIcon,
      items: [
        { title: 'All orders', href: '/orders' },
        { title: 'To confirm', href: '/orders?status=to_do' },
        { title: 'Shipped', href: '/orders?status=shipped' },
      ],
    },
    {
      // Like WMS: the group's href is not a prefix of all its children's
      title: 'Deliveries',
      href: '/deliveries/dashboard',
      icon: TruckIcon,
      items: [
        { title: 'Dashboard', href: '/deliveries/dashboard' },
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
  secondary: [{ title: 'Settings', href: '/settings', icon: SettingsIcon }],
}

/**
 * Stands in for the app's router: in a real app, pass next-intl's `Link`
 * and navigate with its router.
 */
const Shell = ({
  loading = false,
  initialUrl = '/orders?status=to_do',
}: {
  loading?: boolean
  initialUrl?: string
}) => {
  const [url, setUrl] = useState(initialUrl)
  const [pathname, search = ''] = url.split('?')

  const Link = ({ href, onClick, ...rest }: AppSidebarLinkProps) => (
    <a
      href={href}
      onClick={event => {
        event.preventDefault()
        setUrl(href)
        onClick?.()
      }}
      {...rest}
    />
  )

  return (
    <SettingsProvider>
      <SidebarProvider>
        <AppSidebar
          nav={loading ? null : NAV}
          header={
            <SidebarHeader className='p-4'>
              <span className='font-semibold'>Internal tool</span>
            </SidebarHeader>
          }
          pathname={pathname}
          search={search}
          linkComponent={Link}
          onMobileNavigate={setUrl}
          skeleton={{ main: 3, secondary: 1 }}
        />
        <SidebarInset>
          <AppHeader
            actions={
              <UserMenu
                trigger={<Icon icon={UserIcon} className='size-4' />}
                user={{ name: 'jane@example.com', detail: 'admin' }}
                locales={[
                  { value: 'en', label: 'English' },
                  { value: 'fr', label: 'Français' },
                ]}
                locale='en'
                onLocaleChange={() => {}}
                onSignOut={() => {}}>
                <DropdownMenuSeparator />
                <DropdownMenuItem>App-specific item</DropdownMenuItem>
              </UserMenu>
            }>
            <Input placeholder='Search…' className='max-w-xs' />
          </AppHeader>
          <main className='text-muted-foreground p-6 text-sm'>
            Current URL: <code>{url}</code>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </SettingsProvider>
  )
}

export const Default: Story = {
  parameters: { chromatic: { modes: themeModes } },
  render: () => <Shell />,
}

export const Loading: Story = {
  render: () => <Shell loading />,
}

/** A page two levels down: its group and the nested level are open. */
export const NestedPage: Story = {
  render: () => <Shell initialUrl='/deliveries/tours/report' />,
}
