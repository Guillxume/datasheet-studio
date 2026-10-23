'use client'

import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '../lib/utils'
import { Badge } from './badge'
import { Button, buttonVariants } from './button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

type ComboboxOption = {
  value: string
  label: string
  disabled?: boolean
}

type ComboboxProps = {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selectedOption = options.find(option => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-slot='combobox-trigger'
          role='combobox'
          variant='outline'
          aria-expanded={open}
          aria-haspopup='listbox'
          disabled={disabled}
          className={cn(
            'w-[200px] justify-between font-normal',
            !selectedOption && 'text-muted-foreground',
            className,
          )}>
          {selectedOption?.label ?? placeholder}
          <ChevronsUpDownIcon aria-hidden='true' className='opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent data-slot='combobox-content' className='w-[200px] p-0'>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  keywords={[option.label]}
                  onSelect={currentValue => {
                    onValueChange?.(currentValue === value ? '' : currentValue)
                    setOpen(false)
                  }}>
                  {option.label}
                  <CheckIcon
                    aria-hidden='true'
                    className={cn(
                      'ml-auto',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

type ComboboxMultiProps = {
  options: ComboboxOption[]
  value?: string[]
  onValueChange?: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

function ComboboxMulti({
  options,
  value = [],
  onValueChange,
  placeholder = 'Select options...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled = false,
  className,
}: ComboboxMultiProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOptions = options.filter(option => value.includes(option.value))

  const handleRemove = (
    e: React.MouseEvent | React.KeyboardEvent,
    optionValue: string,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    onValueChange?.(value.filter(v => v !== optionValue))
  }

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <div
          data-slot='combobox-multi-trigger'
          role='combobox'
          tabIndex={disabled ? undefined : 0}
          aria-expanded={open}
          aria-disabled={disabled || undefined}
          onKeyDown={e => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              e.currentTarget.click()
            }
          }}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'h-auto min-h-9 w-[200px] cursor-pointer justify-between font-normal',
            selectedOptions.length === 0 && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}>
          {selectedOptions.length > 0 ? (
            <span className='flex flex-wrap gap-1'>
              {selectedOptions.map(option => (
                <ComboboxChip
                  key={option.value}
                  label={option.label}
                  disabled={disabled}
                  onRemove={e => handleRemove(e, option.value)}
                />
              ))}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronsUpDownIcon
            aria-hidden='true'
            className='shrink-0 opacity-50'
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        data-slot='combobox-multi-content'
        className='w-[200px] p-0'>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map(option => {
                const isSelected = value.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    keywords={[option.label]}
                    onSelect={currentValue => {
                      const next = isSelected
                        ? value.filter(v => v !== currentValue)
                        : [...value, currentValue]
                      onValueChange?.(next)
                    }}>
                    {option.label}
                    <CheckIcon
                      aria-hidden='true'
                      className={cn(
                        'ml-auto',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ComboboxChip({
  label,
  disabled,
  onRemove,
}: {
  label: string
  disabled?: boolean
  onRemove: (e: React.MouseEvent | React.KeyboardEvent) => void
}) {
  return (
    <Badge
      data-slot='combobox-chip'
      variant='secondary'
      className='gap-0.5 pr-0.5'>
      {label}
      <button
        type='button'
        aria-label={`Remove ${label}`}
        disabled={disabled}
        className='text-muted-foreground hover:text-foreground rounded-full p-0.5 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
        onClick={onRemove}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            onRemove(e)
          }
        }}>
        <XIcon aria-hidden='true' className='size-3' />
      </button>
    </Badge>
  )
}

export { Combobox, ComboboxMulti, ComboboxChip }
export type { ComboboxOption, ComboboxProps, ComboboxMultiProps }
