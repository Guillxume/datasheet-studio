import type { Meta, StoryObj } from '@storybook/react-vite'
import { Separator } from './separator'

const meta = {
  title: 'General/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
    decorative: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className='space-y-4'>
      <p className='text-sm'>Content above</p>
      <Separator />
      <p className='text-sm'>Content below</p>
    </div>
  ),
}

export const Horizontal: Story = {
  render: () => (
    <div className='w-full space-y-4'>
      <p className='text-sm'>Content above</p>
      <Separator />
      <p className='text-sm'>Content below</p>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className='flex h-6 items-center gap-4'>
      <span className='text-sm'>Blog</span>
      <Separator orientation='vertical' />
      <span className='text-sm'>Docs</span>
      <Separator orientation='vertical' />
      <span className='text-sm'>Source</span>
    </div>
  ),
}
