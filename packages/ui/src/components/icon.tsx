import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '../lib/utils'

const iconVariants = cva('shrink-0', {
  variants: {
    size: {
      xs: 'size-3',
      sm: 'size-4',
      md: 'size-5',
      lg: 'size-6',
      xl: 'size-8',
    },
    variant: {
      default: 'text-current',
      muted: 'text-muted-foreground',
      accent: 'text-accent-foreground',
      destructive: 'text-destructive',
      primary: 'text-primary',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
})

function Icon({
  icon: IconComponent,
  className,
  size,
  variant,
  ...props
}: Omit<React.SVGProps<SVGSVGElement>, 'ref'> &
  VariantProps<typeof iconVariants> & {
    icon: LucideIcon
  }) {
  return (
    <IconComponent
      data-slot='icon'
      aria-hidden='true'
      className={cn(iconVariants({ size, variant, className }))}
      {...props}
    />
  )
}

export { Icon, iconVariants }
