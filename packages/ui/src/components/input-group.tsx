'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'
import { Button } from './button'
import { Input } from './input'
import { Textarea } from './textarea'

function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='input-group'
      className={cn(
        'border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex w-full min-w-0 items-center overflow-hidden rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-[3px] has-[>textarea]:h-auto has-[[aria-invalid]]:border-destructive has-[[aria-invalid]]:ring-destructive/20 dark:has-[[aria-invalid]]:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  'flex cursor-text items-center justify-center select-none',
  {
    variants: {
      align: {
        'inline-start': 'order-first',
        'inline-end': 'order-last',
        'block-start': 'order-first w-full justify-start',
        'block-end': 'order-last w-full justify-start',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
)

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking the addon area focuses the sibling input — intentional UX, not a true interactive element
    // biome-ignore lint/a11y/useKeyWithClickEvents: focus delegation only needs pointer, keyboard users tab directly to the input
    <div
      data-slot='input-group-addon'
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={e => {
        if ((e.target as HTMLElement).closest('button')) {
          return
        }
        e.currentTarget.parentElement
          ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            'input, textarea',
          )
          ?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva('shadow-none flex items-center', {
  variants: {
    size: {
      xs: 'h-7 px-2 text-xs',
      sm: 'h-8 px-2.5 text-xs',
      'icon-xs': 'size-7',
      'icon-sm': 'size-8',
    },
  },
  defaultVariants: {
    size: 'xs',
  },
})

function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size' | 'type'> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: 'button' | 'submit' | 'reset'
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot='input-group-text'
      className={cn('flex items-center [&_svg]:pointer-events-none', className)}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <Input
      data-slot='input-group-control'
      className={cn(
        'flex-1 border-none shadow-none focus-visible:ring-0 focus-visible:border-transparent rounded-none dark:bg-transparent',
        className,
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot='input-group-control'
      className={cn(
        'flex-1 border-none shadow-none focus-visible:ring-0 focus-visible:border-transparent rounded-none resize-none dark:bg-transparent',
        className,
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
