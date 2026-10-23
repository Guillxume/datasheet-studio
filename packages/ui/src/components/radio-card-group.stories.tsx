import type { Meta, StoryObj } from '@storybook/react-vite'
import { PackageXIcon, TruckIcon } from 'lucide-react'
import { useState } from 'react'
import { RadioCardGroup, RadioCardGroupItem } from './radio-card-group'

const meta = {
  title: 'General/RadioCardGroup',
  component: RadioCardGroup,
  tags: ['autodocs'],
} satisfies Meta<typeof RadioCardGroup>

export default meta
type Story = StoryObj<typeof meta>

export const YesNo: Story = {
  render: () => {
    const [value, setValue] = useState<string>('')
    return (
      <RadioCardGroup
        value={value}
        onValueChange={setValue}
        className='max-w-md'>
        <RadioCardGroupItem value='yes'>
          <TruckIcon className='size-6' />
          Yes, carrier known
        </RadioCardGroupItem>
        <RadioCardGroupItem value='no'>
          <PackageXIcon className='size-6' />
          No, carrier unknown
        </RadioCardGroupItem>
      </RadioCardGroup>
    )
  },
}

export const Invalid: Story = {
  render: () => (
    <RadioCardGroup aria-invalid className='max-w-md'>
      <RadioCardGroupItem value='yes'>
        <TruckIcon className='size-6' />
        Yes, carrier known
      </RadioCardGroupItem>
      <RadioCardGroupItem value='no'>
        <PackageXIcon className='size-6' />
        No, carrier unknown
      </RadioCardGroupItem>
    </RadioCardGroup>
  ),
}
