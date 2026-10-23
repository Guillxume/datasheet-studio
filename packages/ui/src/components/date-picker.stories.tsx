import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { DateRange } from './calendar'
import { DatePicker, DateRangePicker } from './date-picker'

const meta = {
  title: 'Forms/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

export const SingleDate: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>()
    return <DatePicker value={date} onValueChange={setDate} />
  },
}

export const CustomFormat: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>()
    return (
      <DatePicker
        value={date}
        onValueChange={setDate}
        formatStr='dd/MM/yyyy'
        placeholder='DD/MM/YYYY'
      />
    )
  },
}

export const DisabledDates: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>()
    return (
      <DatePicker
        value={date}
        onValueChange={setDate}
        disabledDates={[
          (d: Date) => d < new Date(new Date().toDateString()),
          {
            from: new Date(),
            to: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        ]}
      />
    )
  },
}

export const WithDropdownNavigation: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>()
    return (
      <DatePicker
        value={date}
        onValueChange={setDate}
        headerLayout='dropdown'
      />
    )
  },
}

export const Range: Story = {
  render: () => {
    const [range, setRange] = useState<DateRange | undefined>()
    return <DateRangePicker value={range} onValueChange={setRange} />
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Cannot select',
  },
}
