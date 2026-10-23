import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  AlertTriangle,
  Package,
  Settings,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { Icon } from './icon'

const meta = {
  title: 'General/Icon',
  component: Icon,
  tags: ['autodocs'],
  args: {
    icon: ShoppingCart,
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    variant: {
      control: 'select',
      options: ['default', 'muted', 'accent', 'destructive', 'primary'],
    },
  },
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-wrap items-end gap-4'>
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(s => (
        <div key={s} className='flex flex-col items-center gap-1'>
          <Icon icon={ShoppingCart} size={s} />
          <span className='text-muted-foreground text-xs'>{s}</span>
        </div>
      ))}
    </div>
  ),
}

export const Variants: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4'>
      <Icon icon={Package} variant='default' />
      <Icon icon={Truck} variant='muted' />
      <Icon icon={Settings} variant='accent' />
      <Icon icon={AlertTriangle} variant='destructive' />
      <Icon icon={ShoppingCart} variant='primary' />
    </div>
  ),
}
