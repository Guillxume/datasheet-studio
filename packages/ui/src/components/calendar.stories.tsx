import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Calendar, type DateRange } from './calendar'
import { SettingsProvider } from './settings-provider'

const meta = {
  title: 'Forms/Calendar',
  component: Calendar,
  tags: ['autodocs'],
  decorators: [
    Story => (
      <SettingsProvider>
        <Story />
      </SettingsProvider>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const SingleDate: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date())
    return (
      <Calendar
        mode='single'
        selected={date}
        onSelect={setDate}
        className='rounded-lg border'
      />
    )
  },
}

export const DateRangeStory: Story = {
  name: 'Date Range',
  render: () => {
    const [range, setRange] = useState<DateRange | undefined>({
      from: new Date(),
      to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    return (
      <Calendar
        mode='range'
        selected={range}
        onSelect={setRange}
        numberOfMonths={2}
        className='rounded-lg border'
      />
    )
  },
}

export const WithDropdownNavigation: Story = {
  render: () => (
    <Calendar
      mode='single'
      headerLayout='dropdown'
      className='rounded-lg border'
    />
  ),
}
