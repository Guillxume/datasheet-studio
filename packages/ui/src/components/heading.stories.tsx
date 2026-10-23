import type { Meta, StoryObj } from '@storybook/react-vite'
import { Heading } from './heading'

const meta = {
  title: 'Typography/Heading',
  component: Heading,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['4xl', '3xl', '2xl', 'xl', 'lg', 'base'],
    },
    as: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    },
    children: {
      control: 'text',
    },
  },
} satisfies Meta<typeof Heading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Heading',
  },
}

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-col gap-2'>
      <Heading as='h4' size='4xl'>
        Heading 4xl
      </Heading>
      <Heading as='h4' size='3xl'>
        Heading 3xl
      </Heading>
      <Heading as='h4' size='2xl'>
        Heading 2xl
      </Heading>
      <Heading as='h4' size='xl'>
        Heading xl
      </Heading>
      <Heading as='h4' size='lg'>
        Heading lg
      </Heading>
      <Heading as='h4' size='base'>
        Heading base
      </Heading>
    </div>
  ),
}

export const SemanticElements: Story = {
  render: () => (
    <div className='flex flex-col gap-2'>
      <Heading as='h1'>Heading as h1</Heading>
      <Heading as='h2'>Heading as h2</Heading>
      <Heading as='h3'>Heading as h3</Heading>
      <Heading as='h4'>Heading as h4</Heading>
      <Heading as='h5'>Heading as h5</Heading>
      <Heading as='h6'>Heading as h6</Heading>
    </div>
  ),
}
