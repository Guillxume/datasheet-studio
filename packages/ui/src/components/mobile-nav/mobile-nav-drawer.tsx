'use client'

import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '../drawer'
import { useSidebar } from '../sidebar'
import { MobileNavBreadcrumb } from './mobile-nav-breadcrumb'
import { MobileNavDrillDown } from './mobile-nav-drilldown'
import { MobileNavGrid } from './mobile-nav-grid'
import type { MobileNavItem, MobileNavSubItem } from './types'
import { useMobileNavDrilldown } from './use-mobile-nav-drilldown'

type MobileNavDrawerLabels = {
  backToNavigation?: string
  backToItem?: (title: string) => string
  /** Names the drawer for assistive technology. Radix requires a title on
   * every dialog and warns to the console without one, so this has a default
   * rather than being optional in practice. */
  title?: string
  description?: string
}

const MobileNavDrawer = ({
  items,
  configItems,
  activeHref,
  onNavigate,
  labels,
}: {
  items: MobileNavItem[]
  configItems: MobileNavItem[]
  activeHref: string
  onNavigate: (href: string) => void
  labels?: MobileNavDrawerLabels
}) => {
  const { openMobile, setOpenMobile } = useSidebar()
  const { state, drillInto, drillDeeper, goBack, reset } =
    useMobileNavDrilldown()

  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleResetAfterClose = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current)
    }
    resetTimeoutRef.current = setTimeout(() => {
      reset()
      resetTimeoutRef.current = null
    }, 300)
  }, [reset])

  const navigateTo = useCallback(
    (href: string) => {
      setOpenMobile(false)
      scheduleResetAfterClose()
      onNavigate(href)
    },
    [setOpenMobile, scheduleResetAfterClose, onNavigate],
  )

  const handleLeafTap = useCallback(
    (item: MobileNavItem | MobileNavSubItem) => {
      navigateTo(item.href)
    },
    [navigateTo],
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
        resetTimeoutRef.current = null
      }
      setOpenMobile(open)
      if (!open) {
        scheduleResetAfterClose()
      }
    },
    [setOpenMobile, scheduleResetAfterClose],
  )

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current)
    }
  }, [])

  // Determine current sub-items to display
  const currentSubItems =
    state.level === 2
      ? (state.subItem.items ?? [])
      : state.level === 1
        ? (state.item.items ?? [])
        : []

  // Minimum height: 2 rows of grid items (~140px) to prevent a too-short drawer
  const minContentHeight = 140

  return (
    <Drawer open={openMobile} onOpenChange={handleOpenChange}>
      <DrawerContent showCloseButton={false}>
        {/* sr-only, the same shape the desktop Sidebar uses for its own
            sheet: the drawer's visible chrome is the grid itself, but a
            dialog with no title is announced as unlabelled, and Radix logs
            an error for it. The name stays constant across drill-down
            levels; the breadcrumb carries the changing context visibly. */}
        <DrawerHeader className='sr-only'>
          <DrawerTitle>{labels?.title ?? 'Navigation'}</DrawerTitle>
          <DrawerDescription>
            {labels?.description ?? 'Choose a section to open.'}
          </DrawerDescription>
        </DrawerHeader>
        <LayoutGroup>
          <div className='flex flex-col'>
            {/* Breadcrumb (levels 1+) */}
            {state.level > 0 && (
              <MobileNavBreadcrumb
                state={
                  state as Extract<typeof state, { level: 1 } | { level: 2 }>
                }
                onBack={goBack}
                labels={labels}
              />
            )}

            {/* Main content: grid or drill-down */}
            {/* `layout`, not a measured height. A ResizeObserver can only
                report a size that already exists, so driving the height from
                one put the drawer a commit behind its contents: the sub-items
                mounted and began their stagger, and only then did the height
                start moving. A layout animation is measured before and after
                the same commit that mounts them, so the drawer grows and the
                sub-items animate together. */}
            <motion.div
              layout
              transition={{
                layout: {
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                  mass: 1,
                },
              }}
              style={{ minHeight: minContentHeight, overflow: 'hidden' }}>
              {/* popLayout, not wait. `wait` holds the incoming panel until the
                  outgoing one has finished every animation in its subtree, and
                  the grid's tile icon and label carry `layoutId` springs that
                  fly up into the breadcrumb. Measured on a Pixel 7 viewport,
                  that made the sub-items mount 641ms after the tap. popLayout
                  lets them enter immediately and takes the exiting grid out of
                  layout flow, so the drawer never sizes itself to both panels
                  at once. */}
              <AnimatePresence mode='popLayout' initial={false}>
                {state.level === 0 ? (
                  <MobileNavGrid
                    key='grid'
                    items={items}
                    activeHref={activeHref}
                    onLeafTap={handleLeafTap}
                    onParentTap={drillInto}
                  />
                ) : (
                  <MobileNavDrillDown
                    key={`drilldown-${state.level === 1 ? state.item.id : `${state.item.id}-${state.subItem.href}`}`}
                    items={currentSubItems}
                    activeHref={activeHref}
                    onLeafTap={handleLeafTap}
                    onParentTap={drillDeeper}
                  />
                )}
              </AnimatePresence>
            </motion.div>

            {/* Config links: always visible */}
            {configItems.length > 0 && (
              <>
                <div className='mx-4 border-t' />
                <div className='flex items-center justify-center gap-4 px-4 py-2.5'>
                  {configItems.map(item => (
                    <button
                      key={item.id}
                      type='button'
                      className='text-muted-foreground flex items-center gap-1.5 text-xs transition-opacity duration-100 active:opacity-60'
                      onClick={() => navigateTo(item.href)}>
                      <item.icon className='size-3.5' />
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </LayoutGroup>
      </DrawerContent>
    </Drawer>
  )
}

export { MobileNavDrawer }
