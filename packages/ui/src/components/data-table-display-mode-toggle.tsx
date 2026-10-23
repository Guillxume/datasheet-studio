'use client'

import { CalendarIcon, LayoutGridIcon, LayoutListIcon } from 'lucide-react'

import type { DisplayMode } from '../hooks/use-settings'
import { cn } from '../lib/utils'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

type DataTableDisplayModeToggleLabels = {
  table?: string
  card?: string
  calendar?: string
}

type DataTableDisplayModeToggleProps = {
  displayMode: DisplayMode
  onDisplayModeChange: (mode: DisplayMode) => void
  labels?: DataTableDisplayModeToggleLabels
  showCard?: boolean
  showCalendar?: boolean
  className?: string
}

const DataTableDisplayModeToggle = ({
  displayMode,
  onDisplayModeChange,
  labels,
  showCard,
  showCalendar,
  className,
}: DataTableDisplayModeToggleProps) => (
  <ToggleGroup
    type='single'
    variant='outline'
    value={displayMode}
    onValueChange={(value: string) => {
      if (
        value === 'table' ||
        (showCard && value === 'card') ||
        (showCalendar && value === 'calendar')
      ) {
        onDisplayModeChange(value)
      }
    }}
    className={cn('h-9', className)}>
    <ToggleGroupItem
      value='table'
      aria-label={labels?.table ?? 'Table view'}
      size='sm'>
      <LayoutListIcon className='size-4' />
    </ToggleGroupItem>
    {showCard && (
      <ToggleGroupItem
        value='card'
        aria-label={labels?.card ?? 'Card view'}
        size='sm'>
        <LayoutGridIcon className='size-4' />
      </ToggleGroupItem>
    )}
    {showCalendar && (
      <ToggleGroupItem
        value='calendar'
        aria-label={labels?.calendar ?? 'Calendar view'}
        size='sm'>
        <CalendarIcon className='size-4' />
      </ToggleGroupItem>
    )}
  </ToggleGroup>
)

export { DataTableDisplayModeToggle }
export type {
  DataTableDisplayModeToggleLabels,
  DataTableDisplayModeToggleProps,
}
