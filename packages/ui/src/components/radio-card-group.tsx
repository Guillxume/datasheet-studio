'use client'

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '../lib/utils'

function RadioCardGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot='radio-card-group'
      className={cn('group grid grid-cols-2 gap-3', className)}
      {...props}
    />
  )
}

function RadioCardGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot='radio-card-group-item'
      className={cn(
        'border-input bg-card text-card-foreground hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center text-sm font-medium shadow-xs transition-[color,box-shadow,background-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-primary data-[state=checked]:ring-primary/40 data-[state=checked]:ring-2',
        'group-aria-[invalid=true]:border-destructive group-aria-[invalid=true]:ring-destructive/20',
        className,
      )}
      {...props}>
      {children}
    </RadioGroupPrimitive.Item>
  )
}

export { RadioCardGroup, RadioCardGroupItem }
