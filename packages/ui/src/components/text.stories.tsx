import type { Meta, StoryObj } from '@storybook/react-vite'
import { Text } from './text'

const meta = {
  title: 'Typography/Text',
  component: Text,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'muted', 'accent', 'destructive'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'base', 'lg', 'xl'],
    },
    weight: {
      control: 'select',
      options: ['normal', 'medium', 'semibold', 'bold'],
    },
    as: {
      control: 'select',
      options: ['p', 'span', 'div', 'label', 'em', 'strong'],
    },
    children: {
      control: 'text',
    },
  },
} satisfies Meta<typeof Text>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Text',
  },
}

export const Variants: Story = {
  render: () => (
    <div className='flex flex-col gap-1'>
      <Text variant='default'>Default text</Text>
      <Text variant='muted'>Muted text</Text>
      <Text variant='accent'>Accent text</Text>
      <Text variant='destructive'>Destructive text</Text>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-col gap-1'>
      <Text size='xs'>Extra small text</Text>
      <Text size='sm'>Small text</Text>
      <Text size='base'>Base text</Text>
      <Text size='lg'>Large text</Text>
      <Text size='xl'>Extra large text</Text>
    </div>
  ),
}

export const Weights: Story = {
  render: () => (
    <div className='flex flex-col gap-1'>
      <Text weight='normal'>Normal weight</Text>
      <Text weight='medium'>Medium weight</Text>
      <Text weight='semibold'>Semibold weight</Text>
      <Text weight='bold'>Bold weight</Text>
    </div>
  ),
}

export const SemanticElements: Story = {
  render: () => (
    <div className='flex flex-col gap-1'>
      <Text as='p'>Paragraph (p)</Text>
      <Text as='span'>Inline span</Text>
      <Text as='div'>Division (div)</Text>
      <Text as='label'>Label element</Text>
      <Text as='em'>Emphasis (em)</Text>
      <Text as='strong'>Strong importance</Text>
    </div>
  ),
}
