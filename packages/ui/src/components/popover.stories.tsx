import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from './popover'

const meta = {
  title: 'Overlays/Popover',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline'>Open popover</Button>
      </PopoverTrigger>
      <PopoverContent className='w-80'>
        <div className='grid gap-4'>
          <div className='space-y-2'>
            <h4 className='leading-none font-medium'>Dimensions</h4>
            <p className='text-muted-foreground text-sm'>
              Set the dimensions for the layer.
            </p>
          </div>
          <div className='grid gap-2'>
            <div className='grid grid-cols-3 items-center gap-4'>
              <label htmlFor='width' className='text-sm'>
                Width
              </label>
              <input
                id='width'
                defaultValue='100%'
                className='border-input col-span-2 rounded border px-3 py-1 text-sm'
              />
            </div>
            <div className='grid grid-cols-3 items-center gap-4'>
              <label htmlFor='height' className='text-sm'>
                Height
              </label>
              <input
                id='height'
                defaultValue='25px'
                className='border-input col-span-2 rounded border px-3 py-1 text-sm'
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
}

export const WithHeader: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline'>More information</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Information</PopoverTitle>
          <PopoverDescription>
            This is a popover with a header component.
          </PopoverDescription>
        </PopoverHeader>
        <p className='mt-2 text-sm'>Additional content can go here.</p>
      </PopoverContent>
    </Popover>
  ),
}

export const Alignments: Story = {
  render: () => (
    <div className='flex flex-wrap gap-4'>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline'>Align start</Button>
        </PopoverTrigger>
        <PopoverContent align='start'>
          <p className='text-sm'>Aligned to the start of the trigger.</p>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline'>Align center</Button>
        </PopoverTrigger>
        <PopoverContent align='center'>
          <p className='text-sm'>Aligned to the center of the trigger.</p>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline'>Align end</Button>
        </PopoverTrigger>
        <PopoverContent align='end'>
          <p className='text-sm'>Aligned to the end of the trigger.</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
}
