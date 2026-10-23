'use client'

import type { Meta, StoryObj } from '@storybook/react-vite'
import { Calculator, Calendar, CreditCard, Settings, User } from 'lucide-react'
import { useState } from 'react'
import { Button } from './button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command'

const meta = {
  title: 'Navigation/Command',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const CommandItems = () => (
  <>
    <CommandGroup heading='Suggestions'>
      <CommandItem>
        <Calendar />
        Calendar
      </CommandItem>
      <CommandItem>
        <CreditCard />
        Billing
        <CommandShortcut>Ctrl+B</CommandShortcut>
      </CommandItem>
      <CommandItem>
        <Calculator />
        Calculator
      </CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading='Settings'>
      <CommandItem>
        <User />
        Profile
        <CommandShortcut>Ctrl+P</CommandShortcut>
      </CommandItem>
      <CommandItem>
        <Settings />
        Settings
        <CommandShortcut>Ctrl+S</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </>
)

export const Inline: Story = {
  render: () => {
    const [value, setValue] = useState('_')

    return (
      <Command
        value={value}
        onValueChange={setValue}
        className='rounded-lg border shadow-md md:min-w-[450px]'>
        <CommandInput placeholder='Type a command or search...' />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandItems />
        </CommandList>
      </Command>
    )
  },
}

export const Dialog: Story = {
  render: () => {
    const [open, setOpen] = useState(false)

    return (
      <>
        <Button variant='outline' onClick={() => setOpen(true)}>
          Open Command Palette
        </Button>
        <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput placeholder='Type a command or search...' />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandItems />
          </CommandList>
        </CommandDialog>
      </>
    )
  },
}

export const WithShortcuts: Story = {
  render: () => (
    <Command className='rounded-lg border shadow-md md:min-w-[450px]'>
      <CommandInput placeholder='Search...' />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading='Actions'>
          <CommandItem>
            <Calendar />
            New Order
            <CommandShortcut>Ctrl+N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <CreditCard />
            View Invoice
            <CommandShortcut>Ctrl+I</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Settings />
            Settings
            <CommandShortcut>Ctrl+,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
}
