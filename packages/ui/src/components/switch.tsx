'use client'

import { motion } from 'motion/react'
import { Switch as SwitchPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '../lib/utils'

const SIZES = {
  sm: {
    TRACK_WIDTH: 26,
    THUMB_SIZE: 14,
    THUMB_STRETCH: 18,
    className: 'h-4 w-6.5',
  },
  md: {
    TRACK_WIDTH: 32,
    THUMB_SIZE: 16,
    THUMB_STRETCH: 25,
    className: 'h-[1.15rem] w-8',
  },
  lg: {
    TRACK_WIDTH: 48,
    THUMB_SIZE: 24,
    THUMB_STRETCH: 40,
    className: 'h-7 w-12',
  },
}

const STRETCH_DURATION = 75 // ms

type Size = keyof typeof SIZES

interface SwitchProps
  extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  size?: Size
}

function Switch({
  className,
  size = 'md',
  checked,
  defaultChecked,
  onCheckedChange,
  ...rest
}: SwitchProps) {
  const {
    TRACK_WIDTH,
    THUMB_SIZE,
    THUMB_STRETCH,
    className: sizeClassName,
  } = SIZES[size]
  // Controlled (`checked` given): the owner's value is the only truth, so a
  // change the owner refuses (a failed save) leaves the switch as it was.
  // Uncontrolled: the switch keeps its own state from `defaultChecked`.
  const isControlled = checked !== undefined
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(
    defaultChecked ?? false,
  )
  const isChecked = isControlled ? checked : uncontrolledChecked
  const [isStretching, setIsStretching] = React.useState(false)
  const stretchTimeout = React.useRef<ReturnType<typeof setTimeout>>(null)

  React.useEffect(() => {
    return () => clearTimeout(stretchTimeout.current ?? undefined)
  }, [])

  const triggerStretch = React.useCallback(() => {
    clearTimeout(stretchTimeout.current ?? undefined)
    setIsStretching(true)
    stretchTimeout.current = setTimeout(
      () => setIsStretching(false),
      STRETCH_DURATION,
    )
  }, [])

  const handleCheckedChange = (newChecked: boolean) => {
    if (!isControlled) setUncontrolledChecked(newChecked)
    triggerStretch()
    onCheckedChange?.(newChecked)
  }

  const thumbWidth = isStretching ? THUMB_STRETCH : THUMB_SIZE
  const thumbLeft = isChecked ? TRACK_WIDTH - thumbWidth - 2 : 0

  return (
    <SwitchPrimitive.Root
      data-slot='switch'
      className={cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 dark:data-[state=unchecked]:border-foreground/35 relative before:absolute before:-inset-1 inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors duration-150 outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        sizeClassName,
        className,
      )}
      {...rest}
      checked={isChecked}
      onCheckedChange={handleCheckedChange}>
      <SwitchPrimitive.Thumb asChild>
        <motion.span
          data-slot='switch-thumb'
          className='bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none absolute block rounded-full ring-0'
          animate={{
            width: thumbWidth,
            left: thumbLeft,
            transition: { duration: STRETCH_DURATION / 1000 },
          }}
          style={{
            height: THUMB_SIZE,
            minWidth: THUMB_SIZE,
            maxWidth: THUMB_STRETCH,
          }}
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
