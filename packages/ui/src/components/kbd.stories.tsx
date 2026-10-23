import type { Meta, StoryObj } from '@storybook/react-vite'
import { Kbd } from './kbd'

const meta = {
  title: 'General/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  argTypes: {
    keyName: {
      control: 'text',
    },
  },
} satisfies Meta<typeof Kbd>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    keyName: 's',
  },
}

export const WithModifier: Story = {
  args: {
    keyName: 'k',
    modifiers: ['ctrl'],
  },
}

export const Keys: Story = {
  args: { keyName: 'k' },
  render: () => (
    <div className='space-y-3'>
      <div className='flex items-center gap-3'>
        <code className='text-muted-foreground w-56 text-xs'>
          {'<Kbd keyName="k" modifiers={["ctrl"]} />'}
        </code>
        <Kbd keyName='k' modifiers={['ctrl']} />
      </div>
      <div className='flex items-center gap-3'>
        <code className='text-muted-foreground w-56 text-xs'>
          {'<Kbd keyName="p" modifiers={["ctrl", "shift"]} />'}
        </code>
        <Kbd keyName='p' modifiers={['ctrl', 'shift']} />
      </div>
      <div className='flex items-center gap-3'>
        <code className='text-muted-foreground w-56 text-xs'>
          {'<Kbd keyName="n" modifiers={["alt"]} />'}
        </code>
        <Kbd keyName='n' modifiers={['alt']} />
      </div>
      <div className='flex items-center gap-3'>
        <code className='text-muted-foreground w-56 text-xs'>
          {'<Kbd keyName="s" />'}
        </code>
        <Kbd keyName='s' />
      </div>
    </div>
  ),
}

export const InlineUsage: Story = {
  args: { keyName: 's' },
  render: () => (
    <div className='space-y-2'>
      <p className='text-sm'>
        Press <Kbd keyName='s' modifiers={['ctrl']} /> to save your changes.
      </p>
      <p className='text-sm'>
        Open the command palette with{' '}
        <Kbd keyName='p' modifiers={['ctrl', 'shift']} /> or search with{' '}
        <Kbd keyName='k' modifiers={['ctrl']} />.
      </p>
      <p className='text-sm'>
        Press <Kbd keyName='q' modifiers={['ctrl']} /> to quit.
      </p>
    </div>
  ),
}
