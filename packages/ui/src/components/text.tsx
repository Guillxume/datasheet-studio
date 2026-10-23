import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'

const textVariants = cva('', {
  variants: {
    variant: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      accent: 'text-accent-foreground',
      destructive: 'text-destructive',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'base',
    weight: 'normal',
  },
})

type TextElement = 'p' | 'span' | 'div' | 'label' | 'em' | 'strong'

function Text({
  className,
  as: Elem = 'p',
  variant,
  size,
  weight,
  asChild = false,
  ...props
}: React.HTMLAttributes<HTMLElement> &
  React.RefAttributes<HTMLElement> &
  VariantProps<typeof textVariants> & {
    as?: TextElement
    asChild?: boolean
  }) {
  const Comp = (asChild ? Slot : Elem) as React.ElementType

  return (
    <Comp
      data-slot='text'
      className={cn(textVariants({ variant, size, weight, className }))}
      {...props}
    />
  )
}

export { Text, textVariants }
