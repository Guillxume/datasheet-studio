'use client'

import { CheckIcon, FilterIcon, XIcon } from 'lucide-react'

import type { DataTableFilterPreset } from '../hooks/use-data-table-url-state'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

type DataTableFilterPresetsLabels = {
  trigger?: string
  clear?: string
}

type DataTableFilterPresetsProps = {
  presets: DataTableFilterPreset[]
  activePreset: string | null
  onPresetChange: (presetId: string | null) => void
  labels?: DataTableFilterPresetsLabels
}

const DataTableFilterPresets = ({
  presets,
  activePreset,
  onPresetChange,
  labels,
}: DataTableFilterPresetsProps) => {
  if (presets.length === 0) return null

  const activePresetDef = activePreset
    ? presets.find(p => p.id === activePreset)
    : undefined

  return (
    <div className='flex items-center gap-1'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={activePresetDef ? 'solid' : 'outline'}
            color={activePresetDef ? 'secondary' : 'default'}
            size='sm'>
            <FilterIcon className='size-4' />
            {activePresetDef?.label ?? labels?.trigger ?? 'Presets'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          {presets.map(preset => {
            const isActive = preset.id === activePreset
            const Icon = preset.icon
            return (
              <DropdownMenuItem
                key={preset.id}
                onSelect={() => onPresetChange(isActive ? null : preset.id)}>
                <span className='flex items-center gap-2'>
                  {isActive ? (
                    <CheckIcon className='size-4' />
                  ) : Icon ? (
                    <Icon className='size-4' />
                  ) : (
                    <span className='size-4' />
                  )}
                  {preset.label}
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {activePresetDef && (
        <Button
          variant='ghost'
          size='icon'
          className='size-7'
          onClick={() => onPresetChange(null)}
          aria-label={labels?.clear ?? 'Clear preset'}>
          <XIcon className='size-3.5' />
        </Button>
      )}
    </div>
  )
}

export { DataTableFilterPresets }
export type { DataTableFilterPresetsLabels, DataTableFilterPresetsProps }
