import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'
import { Badge } from './badge'

const badgeStatusVariants = cva('border-none focus-visible:outline-none', {
  variants: {
    status: {
      green:
        'bg-green-600/10 text-green-800 focus-visible:ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:focus-visible:ring-green-400/40 [a&]:hover:bg-green-600/5 dark:[a&]:hover:bg-green-400/5',
      blue: 'bg-blue-600/10 text-blue-700 focus-visible:ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-400 dark:focus-visible:ring-blue-400/40 [a&]:hover:bg-blue-600/5 dark:[a&]:hover:bg-blue-400/5',
      amber:
        'bg-amber-600/10 text-amber-800 focus-visible:ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:focus-visible:ring-amber-400/40 [a&]:hover:bg-amber-600/5 dark:[a&]:hover:bg-amber-400/5',
      red: 'bg-red-600/10 text-red-700 focus-visible:ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:focus-visible:ring-red-400/40 [a&]:hover:bg-red-600/5 dark:[a&]:hover:bg-red-400/5',
    },
    dotOnly: {
      true: 'p-1',
      false: '',
      default: '',
    },
  },
})

const dotVariants = cva('size-1.5 rounded-full', {
  variants: {
    status: {
      green: 'bg-green-600 dark:bg-green-400',
      blue: 'bg-blue-600 dark:bg-blue-400',
      amber: 'bg-amber-600 dark:bg-amber-400',
      red: 'bg-red-600 dark:bg-red-400',
    },
  },
})

type BadgeStatusVariantProps = VariantProps<typeof badgeStatusVariants>

type BadgeStatusProps = React.ComponentProps<'span'> &
  Omit<BadgeStatusVariantProps, 'status'> &
  Required<Pick<BadgeStatusVariantProps, 'status'>>

function BadgeStatus({
  status,
  dotOnly = false,
  className,
  children,
  ...props
}: BadgeStatusProps) {
  return (
    <Badge
      data-slot='badge-status'
      className={cn(badgeStatusVariants({ status, dotOnly }), className)}
      {...props}>
      <span className={dotVariants({ status })} aria-hidden='true' />
      {children}
    </Badge>
  )
}

export { BadgeStatus, badgeStatusVariants }
