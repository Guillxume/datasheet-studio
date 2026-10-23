import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plus } from 'lucide-react'
import { Button } from './button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

const meta = {
  title: 'Overlays/Tooltip',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant='outline'>Hover me</Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>This is a tooltip</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
}

export const OnIconButton: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant='ghost' size='icon' aria-label='Add item'>
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add item</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
}

export const Placements: Story = {
  render: () => (
    <TooltipProvider>
      <div className='flex flex-wrap items-center gap-4'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline'>Top</Button>
          </TooltipTrigger>
          <TooltipContent side='top'>
            <p>Tooltip on top</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline'>Right</Button>
          </TooltipTrigger>
          <TooltipContent side='right'>
            <p>Tooltip on right</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline'>Bottom</Button>
          </TooltipTrigger>
          <TooltipContent side='bottom'>
            <p>Tooltip on bottom</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline'>Left</Button>
          </TooltipTrigger>
          <TooltipContent side='left'>
            <p>Tooltip on left</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
}

export const Multiple: Story = {
  render: () => (
    <TooltipProvider>
      <div className='flex flex-wrap items-center gap-4'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline'>Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>This is a tooltip</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='ghost' size='icon' aria-label='Add item'>
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add item</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
}
