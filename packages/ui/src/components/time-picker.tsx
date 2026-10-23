'use client'

import { ClockIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '../lib/utils'

interface TimePickerProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  value?: string
  onValueChange?: (value: string) => void
}

function TimePicker({
  value,
  onValueChange,
  step,
  disabled,
  className,
  'aria-label': ariaLabel,
  ...props
}: TimePickerProps) {
  return (
    <div
      data-slot='time-picker'
      className={cn(
        'border-input focus-within:border-ring focus-within:ring-ring/50 has-[[aria-invalid]]:ring-destructive/20 dark:has-[[aria-invalid]]:ring-destructive/40 has-[[aria-invalid]]:border-destructive dark:bg-input/30 flex h-9 w-fit items-center gap-2 rounded-md border bg-transparent px-3 shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}>
      <ClockIcon
        className='text-muted-foreground size-4 shrink-0'
        aria-hidden='true'
      />
      <input
        type='time'
        aria-label={ariaLabel ?? 'Time'}
        value={value}
        onChange={e => onValueChange?.(e.target.value)}
        step={step}
        disabled={disabled}
        className='bg-transparent text-sm outline-none disabled:cursor-not-allowed placeholder:text-muted-foreground appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none'
        {...props}
      />
    </div>
  )
}

export { TimePicker }
export type { TimePickerProps }
