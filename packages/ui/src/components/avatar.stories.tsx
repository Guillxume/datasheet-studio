import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from './avatar'

/** Deterministic inline placeholder — no remote fetches for Chromatic snapshots */
const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%236c47ff'/%3E%3Ctext x='50%25' y='54%25' text-anchor='middle' fill='white' font-size='32' font-family='sans-serif'%3ESC%3C/text%3E%3C/svg%3E"

const meta = {
  title: 'Data Display/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
    },
  },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: args => (
    <Avatar {...args}>
      <AvatarFallback>AB</AvatarFallback>
    </Avatar>
  ),
}

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src={PLACEHOLDER_IMG} alt='shadcn' />
      <AvatarFallback>SC</AvatarFallback>
    </Avatar>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className='flex items-center gap-4'>
      <Avatar size='sm'>
        <AvatarFallback>S</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>DF</AvatarFallback>
      </Avatar>
      <Avatar size='lg'>
        <AvatarImage src={PLACEHOLDER_IMG} alt='shadcn' />
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
}

export const WithBadge: Story = {
  render: () => (
    <div className='flex items-center gap-4'>
      <Avatar size='sm'>
        <AvatarFallback>S</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <Avatar>
        <AvatarFallback>DF</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <Avatar size='lg'>
        <AvatarFallback>LG</AvatarFallback>
        <AvatarBadge />
      </Avatar>
    </div>
  ),
}

export const Group: Story = {
  render: () => (
    <AvatarGroup aria-label='Team members'>
      <Avatar>
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>B</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>C</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  ),
}

export const GroupSizes: Story = {
  render: () => (
    <div className='flex flex-col gap-4'>
      <AvatarGroup aria-label='Small team members'>
        <Avatar size='sm'>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <Avatar size='sm'>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
        <Avatar size='sm'>
          <AvatarFallback>C</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+5</AvatarGroupCount>
      </AvatarGroup>
      <AvatarGroup aria-label='Default team members'>
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>C</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+5</AvatarGroupCount>
      </AvatarGroup>
      <AvatarGroup aria-label='Large team members'>
        <Avatar size='lg'>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <Avatar size='lg'>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
        <Avatar size='lg'>
          <AvatarFallback>C</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+5</AvatarGroupCount>
      </AvatarGroup>
    </div>
  ),
}
