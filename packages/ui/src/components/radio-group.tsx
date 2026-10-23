'use client'

import { CircleIcon } from 'lucide-react'
import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '../lib/utils'

type RadioGroupItemProps = React.ComponentProps<
  typeof RadioGroupPrimitive.Item
> &
  HTMLMotionProps<'button'>

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot='radio-group'
      className={cn('grid gap-3', className)}
      {...props}
    />
  )
}

function RadioGroupItem({ className, ...props }: RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item asChild {...props}>
      <motion.button
        data-slot='radio-group-item'
        className={cn(
          'border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 relative before:absolute before:-inset-1 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}>
        <RadioGroupPrimitive.Indicator
          data-slot='radio-group-indicator'
          className='relative flex items-center justify-center'>
          <AnimatePresence>
            <motion.div
              key='radio-group-indicator-circle'
              data-slot='radio-group-indicator-circle'
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                transition: { duration: 0.15, delay: 0.1 },
              }}
              exit={{
                opacity: 0,
                scale: 0,
                transition: { duration: 0.1 },
              }}>
              <CircleIcon
                aria-hidden='true'
                className='size-2 fill-current text-current'
              />
            </motion.div>
          </AnimatePresence>
        </RadioGroupPrimitive.Indicator>
      </motion.button>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
