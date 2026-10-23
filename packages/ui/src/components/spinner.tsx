import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'

const spinnerVariants = cva('animate-spin motion-reduce:animate-none', {
  variants: {
    size: {
      sm: 'size-4',
      default: 'size-5',
      lg: 'size-8',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

type SpinnerProps = React.ComponentProps<'svg'> &
  VariantProps<typeof spinnerVariants> & {
    label?: string
  }

function Spinner({ className, size, label, ...props }: SpinnerProps) {
  const svg = (
    <svg
      data-slot='spinner'
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
      aria-hidden='true'
      className={cn(spinnerVariants({ size }), className)}
      {...props}>
      <circle
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
        className='opacity-25'
      />
      <circle
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
        strokeLinecap='round'
        strokeDasharray='62.83'
        strokeDashoffset='47.12'
        className='opacity-75'
      />
    </svg>
  )

  if (!label) return svg

  return (
    <output className='inline-flex items-center'>
      {svg}
      <span className='sr-only'>{label}</span>
    </output>
  )
}

export { Spinner, spinnerVariants }
