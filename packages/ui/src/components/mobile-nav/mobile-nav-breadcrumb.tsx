'use client'

import { ArrowLeftIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../icon'
import type { DrilldownState } from './use-mobile-nav-drilldown'

const springTransition = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
  mass: 1,
}

type MobileNavBreadcrumbLabels = {
  backToNavigation?: string
  backToItem?: (title: string) => string
}

const MobileNavBreadcrumb = ({
  state,
  onBack,
  labels,
}: {
  state: Extract<DrilldownState, { level: 1 } | { level: 2 }>
  onBack: () => void
  labels?: MobileNavBreadcrumbLabels
}) => {
  const backLabel =
    state.level === 2
      ? (labels?.backToItem?.(state.item.title) ??
        `Go back to ${state.item.title}`)
      : (labels?.backToNavigation ?? 'Go back to navigation')

  return (
    <div className='flex items-center gap-2.5 border-b px-4 py-2.5'>
      <button
        type='button'
        className='text-primary -ml-1 flex size-9 items-center justify-center rounded-lg transition-opacity duration-100 active:opacity-60'
        onClick={onBack}
        aria-label={backLabel}>
        <ArrowLeftIcon className='size-5' />
      </button>

      {/* Top-level icon, a shared element visible at both L2 and L3 */}
      <motion.div
        layoutId={`nav-icon-${state.item.id}`}
        className='bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg'
        transition={springTransition}>
        <Icon icon={state.item.icon} className='size-4' />
      </motion.div>

      {state.level === 1 && (
        <motion.span
          layoutId={`nav-label-${state.item.id}`}
          className='text-base font-semibold'
          transition={springTransition}>
          {state.item.title}
        </motion.span>
      )}

      {state.level === 2 && (
        <>
          <span className='text-muted-foreground text-base'>
            {state.item.title}
          </span>
          <span className='text-muted-foreground text-sm'>/</span>
          <AnimatePresence mode='wait'>
            <motion.span
              key={state.subItem.href}
              className='text-base font-semibold'
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}>
              {state.subItem.title}
            </motion.span>
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

export { MobileNavBreadcrumb }
