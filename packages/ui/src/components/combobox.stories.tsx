import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Combobox, ComboboxMulti } from './combobox'

const suppliers = [
  { value: 'acme', label: 'Acme Co.' },
  { value: 'global', label: 'Global Supply' },
  { value: 'quick', label: 'Quick Ship Ltd.' },
  { value: 'prime', label: 'Prime Logistics' },
  { value: 'express', label: 'Express Freight' },
]

const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled', disabled: true },
]

const meta = {
  title: 'Forms/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  args: {
    options: suppliers,
    value: '',
    placeholder: 'Select an option...',
  },
} satisfies Meta<typeof Combobox>

export default meta
type Story = StoryObj<typeof meta>

export const SingleSelect: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return (
      <Combobox
        options={suppliers}
        value={value}
        onValueChange={setValue}
        placeholder='Select supplier...'
        searchPlaceholder='Search suppliers...'
        aria-label='Supplier'
      />
    )
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Cannot select',
  },
}

export const MultiSelect: Story = {
  render: () => {
    const [selected, setSelected] = useState<string[]>([])
    return (
      <ComboboxMulti
        options={statuses}
        value={selected}
        onValueChange={setSelected}
        placeholder='Filter by status...'
        className='w-[250px]'
        aria-label='Status filter'
      />
    )
  },
}

export const MultiSelectWithDisabledOption: Story = {
  render: () => {
    const [selected, setSelected] = useState<string[]>(['pending'])
    return (
      <ComboboxMulti
        options={statuses}
        value={selected}
        onValueChange={setSelected}
        placeholder='Filter by status...'
        className='w-[250px]'
        aria-label='Status filter'
      />
    )
  },
}
