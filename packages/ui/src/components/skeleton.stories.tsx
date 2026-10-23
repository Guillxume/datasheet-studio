import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton } from './skeleton'

const meta = {
  title: 'General/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    className: 'h-4 w-[200px]',
  },
}

export const CardLoading: Story = {
  render: () => (
    <div className='flex items-center gap-4'>
      <Skeleton className='size-12 rounded-full' />
      <div className='space-y-2'>
        <Skeleton className='h-4 w-[200px]' />
        <Skeleton className='h-4 w-[140px]' />
      </div>
    </div>
  ),
}

export const TextLines: Story = {
  render: () => (
    <div className='w-[300px] space-y-2'>
      <Skeleton className='h-4 w-full' />
      <Skeleton className='h-4 w-4/5' />
      <Skeleton className='h-4 w-3/5' />
    </div>
  ),
}
