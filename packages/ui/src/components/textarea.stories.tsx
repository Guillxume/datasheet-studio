import type { Meta, StoryObj } from '@storybook/react-vite'
import { Textarea } from './textarea'

const meta = {
  title: 'Forms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
    characterLimit: {
      control: 'number',
    },
  },
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Write something...',
    className: 'max-w-sm',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Write something...',
    className: 'max-w-sm',
    disabled: true,
  },
}

export const WithCharacterLimit: Story = {
  args: {
    characterLimit: 200,
    placeholder: 'Write a description...',
    className: 'max-w-sm',
  },
}

export const NearCharacterLimit: Story = {
  args: {
    characterLimit: 200,
    defaultValue:
      'This text is intentionally long to demonstrate the warning state. The textarea shows a visual indicator when fewer than 10% of characters remain. Keep typing to see it change color.',
    className: 'max-w-sm',
  },
}

export const Variants: Story = {
  render: () => (
    <div className='flex flex-col gap-4'>
      <Textarea placeholder='Write something...' className='max-w-sm' />
      <Textarea
        characterLimit={200}
        placeholder='Write a description...'
        className='max-w-sm'
      />
    </div>
  ),
}
