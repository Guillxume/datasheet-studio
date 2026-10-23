import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'
import { Separator } from './separator'

const buttonGroupVariants = cva(
  "flex w-fit items-stretch *:focus-visible:z-10 *:focus-visible:relative [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          '[&>[data-slot]:not(:last-child)]:rounded-r-none [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0',
        vertical:
          'flex-col [&>[data-slot]:not(:last-child)]:rounded-b-none [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  },
)

function ButtonGroup({
  className,
  orientation,
  label,
  children,
  ...props
}: React.ComponentProps<'fieldset'> &
  VariantProps<typeof buttonGroupVariants> & {
    /** Visually hidden label for screen readers. Renders a sr-only `<legend>`. */
    label?: string
  }) {
  return (
    <fieldset
      data-slot='button-group'
      data-orientation={orientation}
      className={cn(
        'border-none p-0 m-0',
        buttonGroupVariants({ orientation }),
        className,
      )}
      {...props}>
      {label && <legend className='sr-only'>{label}</legend>}
      {children}
    </fieldset>
  )
}

function ButtonGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot='button-group-separator'
      orientation={orientation}
      className={cn(
        'relative self-stretch data-[orientation=horizontal]:mx-px data-[orientation=horizontal]:w-auto data-[orientation=vertical]:my-px data-[orientation=vertical]:h-auto',
        className,
      )}
      {...props}
    />
  )
}

function ButtonGroupText({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='button-group-text'
      className={cn('flex items-center [&_svg]:pointer-events-none', className)}
      {...props}
    />
  )
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
}
