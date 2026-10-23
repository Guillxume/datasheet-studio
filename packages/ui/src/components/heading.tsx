import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'

const headingVariants = cva('font-bold tracking-tight text-foreground', {
  variants: {
    size: {
      '4xl': 'text-3xl lg:text-4xl',
      '3xl': 'text-2xl lg:text-3xl',
      '2xl': 'text-xl lg:text-2xl',
      xl: 'text-lg lg:text-xl',
      lg: 'text-base lg:text-lg',
      base: 'text-sm lg:text-base',
    },
  },
  defaultVariants: {
    size: '3xl',
  },
})

type HeadingElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

function Heading({
  className,
  as: Elem = 'h2',
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'h1'> &
  VariantProps<typeof headingVariants> & {
    as?: HeadingElement
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : Elem

  return (
    <Comp
      data-slot='heading'
      className={cn(headingVariants({ size, className }))}
      {...props}
    />
  )
}

export { Heading, headingVariants }
