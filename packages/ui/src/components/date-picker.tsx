'use client'

import { type FormatOptions, format } from 'date-fns'
import type { Locale } from 'date-fns/locale'
import { CalendarIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import type { Matcher } from 'react-day-picker'

import { Button } from '../components/button'
import { Calendar, type DateRange } from '../components/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/popover'
import { cn } from '../lib/utils'

function DatePicker({
  value,
  onValueChange,
  placeholder = 'Pick a date',
  formatStr = 'PPP',
  locale,
  disabled,
  disabledDates,
  className,
  id,
  'aria-label': ariaLabel,
  ...calendarProps
}: {
  value?: Date
  onValueChange?: (date: Date | undefined) => void
  placeholder?: string
  formatStr?: string
  locale?: Locale
  disabled?: boolean
  disabledDates?: Matcher | Matcher[]
  className?: string
  id?: string
  'aria-label'?: string
} & Omit<
  React.ComponentProps<typeof Calendar>,
  'mode' | 'selected' | 'onSelect' | 'disabled' | 'locale'
>) {
  const fmtOpts: FormatOptions | undefined = locale ? { locale } : undefined
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          data-slot='date-picker'
          variant='outline'
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}>
          <CalendarIcon aria-hidden='true' />
          {value ? (
            format(value, formatStr, fmtOpts)
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          selected={value}
          onSelect={date => {
            onValueChange?.(date)
            if (date) setOpen(false)
          }}
          disabled={disabledDates}
          locale={locale}
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  )
}

function DateRangePicker({
  value,
  onValueChange,
  placeholder = 'Pick a date range',
  formatStr = 'LLL dd, y',
  locale,
  disabled,
  disabledDates,
  className,
  numberOfMonths = 2,
  id,
  resetLabel,
  'aria-label': ariaLabel,
  ...calendarProps
}: {
  value?: DateRange
  onValueChange?: (range: DateRange | undefined) => void
  placeholder?: string
  formatStr?: string
  locale?: Locale
  disabled?: boolean
  disabledDates?: Matcher | Matcher[]
  className?: string
  numberOfMonths?: number
  id?: string
  resetLabel?: string
  'aria-label'?: string
} & Omit<
  React.ComponentProps<typeof Calendar>,
  'mode' | 'selected' | 'onSelect' | 'numberOfMonths' | 'disabled' | 'locale'
>) {
  const from = value?.from
  const to = value?.to
  const fmtOpts: FormatOptions | undefined = locale ? { locale } : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          data-slot='date-range-picker'
          variant='outline'
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          className={cn(
            'w-[300px] justify-start text-left font-normal',
            !from && 'text-muted-foreground',
            className,
          )}>
          <CalendarIcon aria-hidden='true' />
          {from ? (
            to ? (
              <>
                {format(from, formatStr, fmtOpts)} -{' '}
                {format(to, formatStr, fmtOpts)}
              </>
            ) : (
              format(from, formatStr, fmtOpts)
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='range'
          selected={value}
          onSelect={onValueChange}
          numberOfMonths={numberOfMonths}
          disabled={disabledDates}
          locale={locale}
          {...calendarProps}
        />
        {from && (
          <div className='border-t p-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='w-full'
              onClick={() => onValueChange?.(undefined)}>
              <XIcon aria-hidden='true' className='size-4' />
              {resetLabel ?? 'Reset'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, DateRangePicker }
