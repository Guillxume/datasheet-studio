import type { Meta, StoryObj } from '@storybook/react-vite'
import { Package, StarIcon } from 'lucide-react'
import { useState } from 'react'
import { Badge } from './badge'
import { BadgeClosable } from './badge-closable'
import { Icon } from './icon'

const meta = {
  title: 'General/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'outline',
        'ghost',
        'link',
      ],
    },
    children: {
      control: 'text',
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Badge',
  },
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
}

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive',
  },
}

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
}

export const Variants: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge>Default</Badge>
      <Badge variant='secondary'>Secondary</Badge>
      <Badge variant='destructive'>Destructive</Badge>
      <Badge variant='outline'>Outline</Badge>
    </div>
  ),
}

export const WithIcon: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge>
        <Icon icon={StarIcon} /> Featured
      </Badge>
      <Badge variant='secondary'>
        <Icon icon={Package} /> Shipped
      </Badge>
    </div>
  ),
}

const closableBadges = ['React', 'TypeScript', 'Tailwind']

export const Closable: Story = {
  render: () => {
    const [active, setActive] = useState(new Set(closableBadges))

    const handleClose = (label: string) => {
      setActive(prev => {
        const next = new Set(prev)
        next.delete(label)
        return next
      })
    }

    const handleReset = () => {
      setActive(new Set(closableBadges))
    }

    return (
      <div className='flex flex-wrap items-center gap-3'>
        {closableBadges.map(
          label =>
            active.has(label) && (
              <BadgeClosable key={label} onClose={() => handleClose(label)}>
                {label}
              </BadgeClosable>
            ),
        )}
        {active.size < closableBadges.length && (
          <button
            type='button'
            className='text-muted-foreground hover:text-foreground text-xs underline underline-offset-2'
            onClick={handleReset}>
            Reset
          </button>
        )}
      </div>
    )
  },
}
