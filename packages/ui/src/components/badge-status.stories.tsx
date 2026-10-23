import type { Meta, StoryObj } from '@storybook/react-vite'
import { BadgeStatus } from './badge-status'

const meta = {
  title: 'General/BadgeStatus',
  component: BadgeStatus,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['green', 'blue', 'amber', 'red'],
    },
    dotOnly: {
      control: 'boolean',
    },
    children: {
      control: 'text',
    },
  },
} satisfies Meta<typeof BadgeStatus>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    status: 'blue',
    children: 'Pending',
  },
}

export const Statuses: Story = {
  args: { status: 'blue', children: 'Pending' },
  render: () => (
    <div className='flex flex-wrap items-center gap-2'>
      <BadgeStatus status='blue'>Pending</BadgeStatus>
      <BadgeStatus status='amber'>In Progress</BadgeStatus>
      <BadgeStatus status='red'>Blocked</BadgeStatus>
      <BadgeStatus status='green'>Completed</BadgeStatus>
    </div>
  ),
}

export const DotOnly: Story = {
  args: { status: 'blue' },
  render: () => (
    <div className='flex flex-wrap items-center gap-2'>
      <BadgeStatus status='blue' dotOnly />
      <BadgeStatus status='amber' dotOnly />
      <BadgeStatus status='red' dotOnly />
      <BadgeStatus status='green' dotOnly />
    </div>
  ),
}
