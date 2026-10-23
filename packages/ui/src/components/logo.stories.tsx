import type { Meta, StoryObj } from '@storybook/react-vite'
import { Logo } from './logo'

const meta = {
  title: 'General/Logo',
  component: Logo,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg', 'xl'],
    },
    mono: {
      control: 'boolean',
    },
    label: {
      control: 'text',
    },
  },
} satisfies Meta<typeof Logo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    size: 'default',
  },
}

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-wrap items-end gap-4'>
      <Logo size='sm' />
      <Logo />
      <Logo size='lg' />
      <Logo size='xl' />
    </div>
  ),
}

export const Mono: Story = {
  render: () => (
    <div className='text-primary flex flex-wrap items-end gap-4'>
      <Logo mono size='sm' />
      <Logo mono />
      <Logo mono size='lg' />
      <Logo mono size='xl' />
    </div>
  ),
}

export const WithWordmark: Story = {
  render: () => (
    <div className='flex items-center gap-3'>
      <Logo size='sm' />
      <span className='text-lg font-semibold'>Datasheet Studio</span>
    </div>
  ),
}

export const WithLabel: Story = {
  render: () => <Logo label='Datasheet Studio home' />,
}
