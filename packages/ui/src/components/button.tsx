import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        solid: '',
        outline: 'border shadow-xs',
        ghost: '',
        link: 'underline-offset-4 hover:underline active:scale-100',
      },
      color: {
        default: '',
        secondary: '',
        destructive: '',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-6',
      },
    },
    compoundVariants: [
      // solid + colors
      {
        variant: 'solid',
        color: 'default',
        className:
          'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
      },
      {
        variant: 'solid',
        color: 'secondary',
        className:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
      },
      {
        variant: 'solid',
        color: 'destructive',
        className:
          'bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 dark:hover:bg-destructive/80 dark:active:bg-destructive/70',
      },
      // outline + colors
      {
        variant: 'outline',
        color: 'default',
        className:
          'bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
      },
      {
        variant: 'outline',
        color: 'secondary',
        className:
          'bg-background border-secondary hover:bg-secondary/10 active:bg-secondary/20 dark:bg-input/30 dark:border-secondary/50 dark:hover:bg-secondary/20',
      },
      {
        variant: 'outline',
        color: 'destructive',
        className:
          'border-destructive/50 text-destructive hover:bg-destructive/10 active:bg-destructive/20 focus-visible:ring-destructive/20 dark:border-destructive/40 dark:hover:bg-destructive/20',
      },
      // ghost + colors
      {
        variant: 'ghost',
        color: 'default',
        className:
          'hover:bg-accent hover:text-accent-foreground active:bg-accent dark:hover:bg-accent/50',
      },
      {
        variant: 'ghost',
        color: 'secondary',
        className:
          'hover:bg-secondary/80 hover:text-secondary-foreground active:bg-secondary/70 dark:hover:bg-secondary/50',
      },
      {
        variant: 'ghost',
        color: 'destructive',
        className:
          'text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 dark:hover:bg-destructive/20',
      },
      // link + colors
      {
        variant: 'link',
        color: 'default',
        className: 'text-primary',
      },
      {
        variant: 'link',
        color: 'secondary',
        className: 'text-secondary-foreground',
      },
      {
        variant: 'link',
        color: 'destructive',
        className: 'text-destructive',
      },
    ],
    defaultVariants: {
      variant: 'solid',
      color: 'default',
      size: 'default',
    },
  },
)

type ButtonBaseProps = Omit<React.ComponentProps<'button'>, 'color'> &
  Omit<VariantProps<typeof buttonVariants>, 'size'> & {
    asChild?: boolean
  }

type ButtonProps =
  | (ButtonBaseProps & { size: 'icon' | 'icon-sm'; 'aria-label': string })
  | (ButtonBaseProps & {
      size?: Exclude<
        VariantProps<typeof buttonVariants>['size'],
        'icon' | 'icon-sm'
      >
    })

function Button({
  className,
  variant,
  color,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, color, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
