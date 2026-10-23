import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Download,
  Italic,
  Mail,
  Share2,
  Underline,
} from 'lucide-react'
import { Button } from './button'
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from './button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Icon } from './icon'

const meta = {
  title: 'General/ButtonGroup',
  component: ButtonGroup,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
    label: {
      control: 'text',
    },
  },
} satisfies Meta<typeof ButtonGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <ButtonGroup label='Position'>
      <Button variant='outline'>Left</Button>
      <Button variant='outline'>Center</Button>
      <Button variant='outline'>Right</Button>
    </ButtonGroup>
  ),
}

export const Orientations: Story = {
  render: () => (
    <div className='flex flex-wrap items-start gap-4'>
      <ButtonGroup label='Position'>
        <Button variant='outline'>Left</Button>
        <Button variant='outline'>Center</Button>
        <Button variant='outline'>Right</Button>
      </ButtonGroup>

      <ButtonGroup label='Position' orientation='vertical'>
        <Button variant='outline'>Top</Button>
        <Button variant='outline'>Middle</Button>
        <Button variant='outline'>Bottom</Button>
      </ButtonGroup>
    </div>
  ),
}

export const IconButtons: Story = {
  render: () => (
    <div className='flex flex-wrap items-start gap-4'>
      <ButtonGroup label='Text formatting'>
        <Button variant='outline' size='icon' aria-label='Bold'>
          <Icon icon={Bold} />
        </Button>
        <Button variant='outline' size='icon' aria-label='Italic'>
          <Icon icon={Italic} />
        </Button>
        <Button variant='outline' size='icon' aria-label='Underline'>
          <Icon icon={Underline} />
        </Button>
      </ButtonGroup>

      <ButtonGroup label='Text alignment'>
        <Button variant='outline' size='icon' aria-label='Align left'>
          <Icon icon={AlignLeft} />
        </Button>
        <Button variant='outline' size='icon' aria-label='Align center'>
          <Icon icon={AlignCenter} />
        </Button>
        <Button variant='outline' size='icon' aria-label='Align right'>
          <Icon icon={AlignRight} />
        </Button>
      </ButtonGroup>
    </div>
  ),
}

export const WithText: Story = {
  render: () => (
    <ButtonGroup label='Actions'>
      <Button variant='outline'>
        <Icon icon={Mail} /> Email
      </Button>
      <Button variant='outline'>
        <Icon icon={Share2} /> Share
      </Button>
      <Button variant='outline'>
        <Icon icon={Download} /> Export
      </Button>
    </ButtonGroup>
  ),
}

export const WithSeparatorAndDropdown: Story = {
  render: () => (
    <ButtonGroup label='Save options'>
      <Button variant='outline'>Save</Button>
      <ButtonGroupSeparator />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='outline' size='icon' aria-label='More options'>
            <Icon icon={ChevronDown} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem>Save as draft</DropdownMenuItem>
          <DropdownMenuItem>Save and publish</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  ),
}

export const WithLabelText: Story = {
  render: () => (
    <ButtonGroup label='Sort by'>
      <ButtonGroupText className='border-input border bg-transparent px-3 text-sm'>
        Sort by:
      </ButtonGroupText>
      <Button variant='outline'>Name</Button>
      <Button variant='outline'>Date</Button>
    </ButtonGroup>
  ),
}
