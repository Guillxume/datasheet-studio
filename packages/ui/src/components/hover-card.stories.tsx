import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card'

const meta = {
  title: 'Overlays/HoverCard',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant='link'>@datasheet-studio</Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className='flex flex-col gap-2'>
          <p className='text-sm font-semibold'>@datasheet-studio</p>
          <p className='text-muted-foreground text-sm'>
            Datasheet Studio turns product data into print-ready PDF datasheets.
          </p>
          <p className='text-muted-foreground text-xs'>Joined April 2024</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
}

export const Alignments: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4'>
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant='link'>Align start</Button>
        </HoverCardTrigger>
        <HoverCardContent align='start'>
          <p className='text-sm'>Aligned to the start of the trigger.</p>
        </HoverCardContent>
      </HoverCard>

      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant='link'>Align center</Button>
        </HoverCardTrigger>
        <HoverCardContent align='center'>
          <p className='text-sm'>Aligned to the center of the trigger.</p>
        </HoverCardContent>
      </HoverCard>

      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant='link'>Align end</Button>
        </HoverCardTrigger>
        <HoverCardContent align='end'>
          <p className='text-sm'>Aligned to the end of the trigger.</p>
        </HoverCardContent>
      </HoverCard>
    </div>
  ),
}

export const WithRichContent: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant='link'>View user profile</Button>
      </HoverCardTrigger>
      <HoverCardContent className='w-80'>
        <div className='flex gap-4'>
          <div className='bg-muted flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold'>
            AB
          </div>
          <div className='flex flex-col gap-1'>
            <p className='text-sm font-semibold'>Alice Beaumont</p>
            <p className='text-muted-foreground text-sm'>
              Product designer. Loves great UI.
            </p>
            <p className='text-muted-foreground text-xs'>
              Joined February 2023
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
}
