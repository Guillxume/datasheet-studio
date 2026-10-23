'use client'

import { type HTMLMotionProps, motion } from 'motion/react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '../lib/utils'

const shown = {
  pathLength: 1,
  opacity: 1,
  transition: { duration: 0.15, delay: 0.1 },
}
const hidden = {
  pathLength: 0,
  opacity: 0,
  transition: { duration: 0.1 },
}

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> &
  HTMLMotionProps<'button'>

function Checkbox({ className, onCheckedChange, ...props }: CheckboxProps) {
  // Controlled (`checked` given): the owner's value drives the tick too, so a
  // change the owner refuses does not leave a tick on an unchecked box.
  const isControlled = props.checked !== undefined
  const [uncontrolledChecked, setUncontrolledChecked] =
    React.useState<CheckboxPrimitive.CheckedState>(
      props.defaultChecked ?? false,
    )
  const isChecked = isControlled
    ? (props.checked as CheckboxPrimitive.CheckedState)
    : uncontrolledChecked

  const handleCheckedChange = React.useCallback(
    (checked: CheckboxPrimitive.CheckedState) => {
      if (!isControlled) setUncontrolledChecked(checked)
      onCheckedChange?.(checked)
    },
    [isControlled, onCheckedChange],
  )

  // 'indeterminate' is truthy: without its own state the tick would show.
  const indicatorState =
    isChecked === 'indeterminate'
      ? 'indeterminate'
      : isChecked
        ? 'checked'
        : 'unchecked'

  return (
    <CheckboxPrimitive.Root
      {...props}
      onCheckedChange={handleCheckedChange}
      asChild>
      <motion.button
        data-slot='checkbox'
        className={cn(
          'peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive relative before:absolute before:-inset-1 size-4 shrink-0 rounded-[4px] border shadow-xs transition-colors duration-200 outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}>
        <CheckboxPrimitive.Indicator forceMount asChild>
          <motion.svg
            aria-hidden='true'
            data-slot='checkbox-indicator'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            strokeWidth='3.5'
            stroke='currentColor'
            className='size-3.5'
            initial='unchecked'
            animate={indicatorState}>
            <motion.path
              data-slot='checkbox-check'
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M4.5 12.75l6 6 9-13.5'
              variants={{
                checked: shown,
                unchecked: hidden,
                indeterminate: hidden,
              }}
            />
            <motion.path
              data-slot='checkbox-dash'
              strokeLinecap='round'
              d='M6 12h12'
              variants={{
                checked: hidden,
                unchecked: hidden,
                indeterminate: shown,
              }}
            />
          </motion.svg>
        </CheckboxPrimitive.Indicator>
      </motion.button>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
