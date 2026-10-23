import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import { Spinner } from './spinner'

const meta = {
  title: 'General/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
    },
    label: {
      control: 'text',
    },
  },
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    size: 'default',
  },
}

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4'>
      <Spinner size='sm' />
      <Spinner />
      <Spinner size='lg' />
    </div>
  ),
}

export const WithLabel: Story = {
  render: () => <Spinner label='Loading orders...' />,
}

export const WithButton: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-3'>
      <Button disabled>
        <Spinner size='sm' /> Loading...
      </Button>
      <Button variant='outline' disabled>
        <Spinner size='sm' /> Please wait
      </Button>
    </div>
  ),
}
