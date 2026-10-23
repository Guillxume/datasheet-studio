'use client'

import { ChevronRightIcon } from 'lucide-react'
import { motion } from 'motion/react'
import type * as React from 'react'
import { cn } from '../../lib/utils'
import { isInSection } from '../_internal/nav-match'
import type { MobileNavSubItem } from './types'

const MAX_STAGGER_ITEMS = 8
const STAGGER_DELAY = 0.035
const ITEM_DURATION = 0.15

const MobileNavDrillDown = ({
  items,
  activeHref,
  onLeafTap,
  onParentTap,
  ref,
}: {
  items: MobileNavSubItem[]
  activeHref: string
  onLeafTap: (item: MobileNavSubItem) => void
  onParentTap: (item: MobileNavSubItem) => void
  ref?: React.Ref<HTMLDivElement>
}) => {
  return (
    // No entrance fade on the container. Nested opacity multiplies, so a
    // container fading 0 to 1 over the same 150ms as the rows inside it left
    // each row at a quarter of its intended opacity halfway through its own
    // animation: the rows looked like they did nothing for the first half and
    // then rushed, which reads as starting late. The rows own the entrance
    // now; the container still fades on exit, where it is the only thing
    // animating and nothing compounds.
    <motion.div
      ref={ref}
      className='flex flex-col gap-1 px-4 py-2'
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.15 }}>
      {items.map((item, index) => {
        const hasChildren = item.items && item.items.length > 0
        // A group is active anywhere in its section, children included; a leaf
        // only on its own page (its href may carry filters the path lacks)
        const isActive = hasChildren
          ? isInSection(activeHref, item)
          : activeHref === item.href || activeHref.startsWith(`${item.href}/`)
        const shouldStagger = index < MAX_STAGGER_ITEMS

        return (
          <motion.button
            key={item.href}
            type='button'
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm',
              'transition-opacity duration-100 active:opacity-60',
              isActive ? 'bg-accent text-accent-foreground' : 'text-foreground',
            )}
            initial={shouldStagger ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldStagger
                ? {
                    delay: index * STAGGER_DELAY,
                    duration: ITEM_DURATION,
                  }
                : undefined
            }
            onClick={() => (hasChildren ? onParentTap(item) : onLeafTap(item))}>
            <span className='truncate'>{item.title}</span>
            {hasChildren && (
              <ChevronRightIcon className='text-muted-foreground size-4 shrink-0' />
            )}
          </motion.button>
        )
      })}
    </motion.div>
  )
}

export { MobileNavDrillDown }
