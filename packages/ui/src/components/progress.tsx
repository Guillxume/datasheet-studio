'use client'

import { Progress as ProgressPrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '../lib/utils'

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot='progress'
      className={cn(
        'bg-primary/20 relative h-2 w-full overflow-hidden rounded-full',
        className,
      )}
      {...props}>
      <ProgressPrimitive.Indicator
        data-slot='progress-indicator'
        className='bg-primary h-full w-full flex-1 transition-all'
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

const VIEWBOX = 36
const STROKE = 7
const R = (VIEWBOX - STROKE) / 2
const C = 2 * Math.PI * R

const circleSizeMap = {
  sm: 'size-8',
  default: 'size-10',
  lg: 'size-16',
}

type ProgressCircleProps = React.ComponentProps<'div'> & {
  value?: number
  size?: keyof typeof circleSizeMap
}

function ProgressCircle({
  value = 0,
  size = 'default',
  className,
  children,
  ...props
}: ProgressCircleProps) {
  const offset = C - (Math.min(100, Math.max(0, value)) / 100) * C

  return (
    <div
      data-slot='progress-circle'
      role='progressbar'
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'relative inline-flex items-center justify-center',
        circleSizeMap[size],
        className,
      )}
      {...props}>
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        fill='none'
        className='absolute inset-0 size-full -rotate-90'
        aria-hidden='true'>
        <circle
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={R}
          strokeWidth={STROKE}
          className='stroke-primary/20'
        />
        <circle
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={R}
          strokeWidth={STROKE}
          className='stroke-primary transition-[stroke-dashoffset] duration-300'
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      {children && (
        <span className='absolute text-xs font-medium'>{children}</span>
      )}
    </div>
  )
}

export { Progress, ProgressCircle }
