import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertTriangle, ChevronRight, Mail, Package, Plus } from 'lucide-react'
import { Fragment } from 'react'
import { Button } from './button'
import { Icon } from './icon'

const variantList = ['solid', 'outline', 'ghost', 'link'] as const
const colorList = ['default', 'secondary', 'destructive'] as const

const meta = {
  title: 'General/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['solid', 'outline', 'ghost', 'link'],
    },
    color: {
      control: 'select',
      options: ['default', 'secondary', 'destructive'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon', 'icon-sm'],
    },
    disabled: {
      control: 'boolean',
    },
    children: {
      control: 'text',
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Button',
  },
}

export const VariantsAndColors: Story = {
  render: () => (
    <div className='grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-x-4 gap-y-3'>
      {/* Column headers */}
      <div />
      {colorList.map(c => (
        <span
          key={c}
          className='text-muted-foreground text-center text-xs font-medium'>
          {c}
        </span>
      ))}
      {/* Rows: one per variant */}
      {variantList.map(v => (
        <Fragment key={v}>
          <span className='text-muted-foreground text-right text-xs font-medium'>
            {v}
          </span>
          {colorList.map(c => (
            <Button key={`${v}-${c}`} variant={v} color={c}>
              {v}
            </Button>
          ))}
        </Fragment>
      ))}
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-wrap items-end gap-3'>
      <Button size='sm'>Small</Button>
      <Button size='default'>Default</Button>
      <Button size='lg'>Large</Button>
      <Button size='icon' aria-label='Add'>
        <Icon icon={Plus} />
      </Button>
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-3'>
      {variantList.map(v => (
        <Button key={v} variant={v} disabled>
          {v}
        </Button>
      ))}
    </div>
  ),
}

export const WithIcons: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-3'>
      <Button>
        <Icon icon={Mail} /> Login with Email
      </Button>
      <Button variant='outline'>
        Next <Icon icon={ChevronRight} />
      </Button>
      <Button variant='outline' color='destructive'>
        <Icon icon={AlertTriangle} /> Cancel
      </Button>
      <Button color='secondary'>
        <Icon icon={Package} /> Export
      </Button>
      <Button variant='ghost' color='destructive'>
        <Icon icon={AlertTriangle} /> Delete
      </Button>
      <Button variant='ghost' size='icon' aria-label='Add'>
        <Icon icon={Plus} />
      </Button>
      <Button
        variant='ghost'
        color='destructive'
        size='icon'
        aria-label='Delete'>
        <Icon icon={AlertTriangle} />
      </Button>
    </div>
  ),
}
