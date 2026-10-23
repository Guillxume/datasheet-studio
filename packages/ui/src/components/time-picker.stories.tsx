import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TimePicker } from './time-picker'

const meta = {
  title: 'Forms/TimePicker',
  component: TimePicker,
  tags: ['autodocs'],
} satisfies Meta<typeof TimePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: () => {
    const [time, setTime] = useState('10:30')
    return (
      <TimePicker
        value={time}
        onValueChange={setTime}
        aria-label='Basic time'
      />
    )
  },
}

export const WithSeconds: Story = {
  render: () => {
    const [time, setTime] = useState('14:30:00')
    return (
      <TimePicker
        value={time}
        onValueChange={setTime}
        step={1}
        aria-label='Time with seconds'
      />
    )
  },
}

export const Disabled: Story = {
  args: {
    value: '09:00',
    disabled: true,
    'aria-label': 'Disabled time',
  },
}
