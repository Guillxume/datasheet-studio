import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr_auto] grid-cols-[0_1fr_auto] has-[>svg]:gap-x-3 gap-x-2 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'border-red-600/20 bg-red-600/10 text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-400 [&>svg]:text-current *:data-[slot=alert-description]:text-red-600/90 *:data-[slot=alert-description]:dark:text-red-400/90',
        success:
          'border-green-600/20 bg-green-600/10 text-green-600 dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-400 [&>svg]:text-current *:data-[slot=alert-description]:text-green-600/90 *:data-[slot=alert-description]:dark:text-green-400/90',
        warning:
          'border-amber-600/20 bg-amber-600/10 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400 [&>svg]:text-current *:data-[slot=alert-description]:text-amber-600/90 *:data-[slot=alert-description]:dark:text-amber-400/90',
        info: 'border-blue-600/20 bg-blue-600/10 text-blue-600 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-400 [&>svg]:text-current *:data-[slot=alert-description]:text-blue-600/90 *:data-[slot=alert-description]:dark:text-blue-400/90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot='alert'
      role={
        variant === 'destructive' || variant === 'warning' ? 'alert' : undefined
      }
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-title'
      className={cn(
        'col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight',
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-description'
      className={cn(
        'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-action'
      className={cn(
        'col-start-3 row-span-2 row-start-1 self-center',
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
