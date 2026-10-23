'use client'

import type { ReactNode } from 'react'
import { Separator } from './separator'
import { SidebarTrigger } from './sidebar'

type AppHeaderProps = {
  /** Rendered right after the sidebar toggle, before the separator (e.g. a status badge). */
  leading?: ReactNode
  /** Rendered after the separator (e.g. a search field). */
  children?: ReactNode
  /** Rendered at the right end (e.g. the user menu). */
  actions?: ReactNode
  labels?: { toggleSidebar?: string }
}

/**
 * The sticky application header shared by internal tools: sidebar toggle on
 * the left, free slots, actions on the right. Must be rendered inside a
 * `SidebarProvider`.
 */
function AppHeader({ leading, children, actions, labels }: AppHeaderProps) {
  return (
    <header className='bg-background sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4'>
      <SidebarTrigger
        className='-ml-1'
        aria-label={labels?.toggleSidebar ?? 'Toggle Sidebar'}
      />
      {leading}
      <Separator orientation='vertical' className='mr-2 !h-4' />
      {children}
      <div className='ml-auto'>{actions}</div>
    </header>
  )
}

export { AppHeader }
