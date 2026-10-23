import type { Meta, StoryObj } from '@storybook/react-vite'
import { InputFile } from './input-file'

const noop = async (file: File) => file

const meta = {
  title: 'Forms/InputFile',
  component: InputFile,
  tags: ['autodocs'],
  args: {
    onFileAdded: noop,
  },
} satisfies Meta<typeof InputFile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAccept: Story = {
  args: {
    accept: '.pdf,.doc,.docx',
  },
}

export const Multiple: Story = {
  args: {
    multiple: true,
    accept: 'image/*',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const Variants: Story = {
  render: () => (
    <div className='space-y-4 max-w-sm'>
      <InputFile accept='.pdf,.doc,.docx' onFileAdded={noop} />
      <InputFile multiple accept='image/*' onFileAdded={noop} />
      <InputFile disabled onFileAdded={noop} />
    </div>
  ),
}
