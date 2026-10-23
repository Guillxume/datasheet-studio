import type { Meta, StoryObj } from '@storybook/react-vite'
import { BoldIcon, ItalicIcon, UnderlineIcon } from 'lucide-react'
import { useState } from 'react'
import { Toggle } from './toggle'

const meta = {
  title: 'General/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline'],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Toggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [pressed, setPressed] = useState(false)
    return (
      <Toggle
        aria-label='Toggle bold'
        pressed={pressed}
        onPressedChange={setPressed}>
        <BoldIcon className='size-4' />
      </Toggle>
    )
  },
}

export const Variants: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-3'>
      <Toggle aria-label='Toggle bold'>
        <BoldIcon className='size-4' />
      </Toggle>
      <Toggle variant='outline' aria-label='Toggle bold outline'>
        <BoldIcon className='size-4' />
      </Toggle>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-wrap items-end gap-3'>
      <Toggle size='sm' aria-label='Small'>
        <BoldIcon className='size-4' />
      </Toggle>
      <Toggle aria-label='Default'>
        <BoldIcon className='size-4' />
      </Toggle>
      <Toggle size='lg' aria-label='Large'>
        <BoldIcon className='size-4' />
      </Toggle>
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-3'>
      <Toggle disabled aria-label='Disabled'>
        <BoldIcon className='size-4' />
      </Toggle>
      <Toggle variant='outline' disabled aria-label='Disabled outline'>
        <ItalicIcon className='size-4' />
      </Toggle>
    </div>
  ),
}

export const WithText: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-3'>
      <Toggle aria-label='Toggle bold'>
        <BoldIcon className='size-4' /> Bold
      </Toggle>
      <Toggle aria-label='Toggle italic'>
        <ItalicIcon className='size-4' /> Italic
      </Toggle>
      <Toggle aria-label='Toggle underline'>
        <UnderlineIcon className='size-4' /> Underline
      </Toggle>
    </div>
  ),
}
