import type { Meta, StoryObj } from '@storybook/react-vite'
import { Link, Mail, Search } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from './input-group'

const meta = {
  title: 'Forms/InputGroup',
  component: InputGroup,
  tags: ['autodocs'],
} satisfies Meta<typeof InputGroup>

export default meta
type Story = StoryObj<typeof meta>

export const WithLeadingIcon: Story = {
  render: () => (
    <div className='max-w-sm'>
      <InputGroup>
        <InputGroupAddon align='inline-start' className='pl-3'>
          <InputGroupText>
            <Search className='text-muted-foreground size-4' />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder='Search...' />
      </InputGroup>
    </div>
  ),
}

export const WithTrailingIcon: Story = {
  render: () => (
    <div className='max-w-sm'>
      <InputGroup>
        <InputGroupInput placeholder='Email address' />
        <InputGroupAddon align='inline-end' className='pr-3'>
          <InputGroupText>
            <Mail className='text-muted-foreground size-4' />
          </InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

export const WithTextPrefix: Story = {
  render: () => (
    <div className='max-w-sm'>
      <InputGroup>
        <InputGroupAddon align='inline-start' className='pl-3'>
          <InputGroupText className='text-muted-foreground text-sm'>
            https://
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder='yoursite.com' />
      </InputGroup>
    </div>
  ),
}

export const WithTrailingButton: Story = {
  render: () => (
    <div className='max-w-sm'>
      <InputGroup>
        <InputGroupInput placeholder='Paste a link...' />
        <InputGroupAddon align='inline-end' className='pr-1'>
          <InputGroupButton size='icon-xs' aria-label='Paste link'>
            <Link className='size-4' />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

export const WithLeadingIconAndTrailingButton: Story = {
  render: () => (
    <div className='max-w-sm'>
      <InputGroup>
        <InputGroupAddon align='inline-start' className='pl-3'>
          <InputGroupText>
            <Search className='text-muted-foreground size-4' />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder='Search with button...' />
        <InputGroupAddon align='inline-end' className='pr-1'>
          <InputGroupButton size='sm'>Search</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className='max-w-sm space-y-4'>
      <InputGroup>
        <InputGroupAddon align='inline-start' className='pl-3'>
          <InputGroupText>
            <Search className='text-muted-foreground size-4' />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder='Search...' />
      </InputGroup>

      <InputGroup>
        <InputGroupInput placeholder='Email address' />
        <InputGroupAddon align='inline-end' className='pr-3'>
          <InputGroupText>
            <Mail className='text-muted-foreground size-4' />
          </InputGroupText>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupAddon align='inline-start' className='pl-3'>
          <InputGroupText className='text-muted-foreground text-sm'>
            https://
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder='yoursite.com' />
      </InputGroup>

      <InputGroup>
        <InputGroupInput placeholder='Paste a link...' />
        <InputGroupAddon align='inline-end' className='pr-1'>
          <InputGroupButton size='icon-xs' aria-label='Paste link'>
            <Link className='size-4' />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupAddon align='inline-start' className='pl-3'>
          <InputGroupText>
            <Search className='text-muted-foreground size-4' />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder='Search with button...' />
        <InputGroupAddon align='inline-end' className='pr-1'>
          <InputGroupButton size='sm'>Search</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}
