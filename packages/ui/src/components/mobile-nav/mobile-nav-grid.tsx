'use client'

import { motion } from 'motion/react'
import type * as React from 'react'
import { cn } from '../../lib/utils'
import { isInSection } from '../_internal/nav-match'
import { Icon } from '../icon'
import type { MobileNavItem } from './types'

const MobileNavGrid = ({
  items,
  activeHref,
  onLeafTap,
  onParentTap,
  ref,
}: {
  items: MobileNavItem[]
  activeHref: string
  onLeafTap: (item: MobileNavItem) => void
  onParentTap: (item: MobileNavItem) => void
  ref?: React.Ref<HTMLDivElement>
}) => {
  return (
    <motion.div
      ref={ref}
      className='grid grid-cols-4 gap-3 px-4 py-3'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}>
      {items.map(item => {
        const hasChildren = item.items && item.items.length > 0
        // A group is active anywhere in its section, children included; a leaf
        // only on its own page (its href may carry filters the path lacks)
        const isActive = hasChildren
          ? isInSection(activeHref, item)
          : activeHref === item.href || activeHref.startsWith(`${item.href}/`)

        return (
          <button
            key={item.id}
            type='button'
            aria-label={item.title}
            className='flex flex-col items-center gap-1.5 rounded-lg p-2 transition-opacity duration-100 active:opacity-60'
            onClick={() => (hasChildren ? onParentTap(item) : onLeafTap(item))}>
            <motion.div
              layoutId={`nav-icon-${item.id}`}
              className={cn(
                'flex size-10 items-center justify-center rounded-xl',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary/10 text-primary',
              )}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
                mass: 1,
              }}>
              <Icon icon={item.icon} className='size-5' />
            </motion.div>
            <motion.span
              layoutId={`nav-label-${item.id}`}
              className={cn(
                'max-w-full truncate text-[11px] leading-tight',
                isActive
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground',
              )}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
                mass: 1,
              }}>
              {item.title}
            </motion.span>
          </button>
        )
      })}
    </motion.div>
  )
}

export { MobileNavGrid }
