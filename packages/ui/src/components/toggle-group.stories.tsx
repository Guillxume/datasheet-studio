import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ItalicIcon,
  LayoutGridIcon,
  LayoutListIcon,
  UnderlineIcon,
} from 'lucide-react'
import { useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

const meta = {
  title: 'General/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs'],
  args: { type: 'single' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline'],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
    },
    spacing: {
      control: 'number',
    },
  },
} satisfies Meta<typeof ToggleGroup>

export default meta
type Story = StoryObj<typeof meta>

export const SingleSelection: Story = {
  render: () => {
    const [alignment, setAlignment] = useState('center')
    return (
      <ToggleGroup
        type='single'
        value={alignment}
        onValueChange={v => {
          if (v) setAlignment(v)
        }}>
        <ToggleGroupItem value='left' aria-label='Align left'>
          <AlignLeftIcon className='size-4' />
        </ToggleGroupItem>
        <ToggleGroupItem value='center' aria-label='Align center'>
          <AlignCenterIcon className='size-4' />
        </ToggleGroupItem>
        <ToggleGroupItem value='right' aria-label='Align right'>
          <AlignRightIcon className='size-4' />
        </ToggleGroupItem>
      </ToggleGroup>
    )
  },
}

export const MultipleSelection: Story = {
  render: () => {
    const [formatting, setFormatting] = useState<string[]>([])
    return (
      <ToggleGroup
        type='multiple'
        value={formatting}
        onValueChange={setFormatting}>
        <ToggleGroupItem value='bold' aria-label='Bold'>
          <BoldIcon className='size-4' />
        </ToggleGroupItem>
        <ToggleGroupItem value='italic' aria-label='Italic'>
          <ItalicIcon className='size-4' />
        </ToggleGroupItem>
        <ToggleGroupItem value='underline' aria-label='Underline'>
          <UnderlineIcon className='size-4' />
        </ToggleGroupItem>
      </ToggleGroup>
    )
  },
}

export const OutlineVariant: Story = {
  render: () => {
    const [view, setView] = useState('table')
    return (
      <ToggleGroup
        type='single'
        variant='outline'
        value={view}
        onValueChange={v => {
          if (v) setView(v)
        }}>
        <ToggleGroupItem value='table' aria-label='Table view'>
          <LayoutListIcon className='size-4' />
        </ToggleGroupItem>
        <ToggleGroupItem value='card' aria-label='Card view'>
          <LayoutGridIcon className='size-4' />
        </ToggleGroupItem>
      </ToggleGroup>
    )
  },
}

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-wrap items-end gap-4'>
      <ToggleGroup type='single' defaultValue='a' size='sm'>
        <ToggleGroupItem value='a'>A</ToggleGroupItem>
        <ToggleGroupItem value='b'>B</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup type='single' defaultValue='a'>
        <ToggleGroupItem value='a'>A</ToggleGroupItem>
        <ToggleGroupItem value='b'>B</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup type='single' defaultValue='a' size='lg'>
        <ToggleGroupItem value='a'>A</ToggleGroupItem>
        <ToggleGroupItem value='b'>B</ToggleGroupItem>
      </ToggleGroup>
    </div>
  ),
}

export const WithSpacing: Story = {
  render: () => (
    <ToggleGroup type='single' defaultValue='left' spacing={2}>
      <ToggleGroupItem value='left' aria-label='Align left'>
        <AlignLeftIcon className='size-4' />
      </ToggleGroupItem>
      <ToggleGroupItem value='center' aria-label='Align center'>
        <AlignCenterIcon className='size-4' />
      </ToggleGroupItem>
      <ToggleGroupItem value='right' aria-label='Align right'>
        <AlignRightIcon className='size-4' />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}
