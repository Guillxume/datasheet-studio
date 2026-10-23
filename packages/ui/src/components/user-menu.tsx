'use client'

import {
  GlobeIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useSettings } from '../hooks/use-settings'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { useGlobalLoading } from './global-loading'
import { Icon } from './icon'

type UserMenuLabels = {
  menu: string
  language: string
  appearance: string
  light: string
  dark: string
  system: string
  signOut: string
}

const DEFAULT_LABELS: UserMenuLabels = {
  menu: 'User menu',
  language: 'Language',
  appearance: 'Appearance',
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  signOut: 'Sign out',
}

type UserMenuProps = {
  /** Content of the round trigger button, e.g. an avatar or an icon. */
  trigger: ReactNode
  /** Shown at the top of the menu when set, e.g. the email and the role. */
  user?: { name: string; detail?: string }
  /** App-specific items, rendered after Appearance. Bring your own separators. */
  children?: ReactNode
  /** Called after the global loading indicator starts. Sign the user out here. */
  onSignOut: () => void
  labels?: Partial<UserMenuLabels>
} & (
  | {
      /** Languages offered, in display order. */
      locales: { value: string; label: string }[]
      locale: string
      /**
       * Called after the new locale is saved in the settings. Navigate to the
       * localized URL here.
       */
      onLocaleChange: (locale: string) => void
    }
  | {
      /** Without `locales`, the menu has no Language entry (single-language app). */
      locales?: undefined
      locale?: undefined
      onLocaleChange?: undefined
    }
)

const themeIcons = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
} as const

/**
 * The user menu shared by internal tools: language, appearance (theme saved
 * by `SettingsProvider`), app-specific items, sign out. Authentication stays
 * in the app: it provides the user details and the sign-out action.
 */
function UserMenu({
  trigger,
  user,
  locales,
  locale,
  onLocaleChange,
  children,
  onSignOut,
  labels: labelsProp,
}: UserMenuProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const { theme, setTheme, setLocale } = useSettings()
  const { startLoading } = useGlobalLoading()
  const ThemeIcon = themeIcons[theme]

  const changeLanguage = (lng: string) => {
    setLocale(lng)
    onLocaleChange?.(lng)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' aria-label={labels.menu}>
          {trigger}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        {user && (
          <>
            <DropdownMenuLabel className='font-normal'>
              <div className='flex flex-col gap-1'>
                <p className='text-sm font-medium leading-none'>{user.name}</p>
                <p className='text-muted-foreground text-xs capitalize leading-none'>
                  {user.detail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {locales && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Icon icon={GlobeIcon} />
              {labels.language}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={locale}
                onValueChange={changeLanguage}>
                {locales.map(l => (
                  <DropdownMenuRadioItem key={l.value} value={l.value}>
                    {l.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icon icon={ThemeIcon} />
            {labels.appearance}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={v => setTheme(v as 'light' | 'dark' | 'system')}>
              <DropdownMenuRadioItem value='light'>
                <Icon icon={SunIcon} />
                {labels.light}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value='dark'>
                <Icon icon={MoonIcon} />
                {labels.dark}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value='system'>
                <Icon icon={MonitorIcon} />
                {labels.system}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {children}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant='destructive'
          onSelect={() => {
            startLoading()
            onSignOut()
          }}>
          <Icon icon={LogOutIcon} />
          {labels.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { UserMenu }
