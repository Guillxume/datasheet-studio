import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet'

const meta = {
  title: 'Overlays/Sheet',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant='outline'>Open right</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Make changes to your profile here.
          </SheetDescription>
        </SheetHeader>
        <div className='p-4'>
          <p className='text-muted-foreground text-sm'>
            Sheet content goes here.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  ),
}

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant='outline'>Open left</Button>
      </SheetTrigger>
      <SheetContent side='left'>
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Browse the application.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
}

export const Sides: Story = {
  render: () => (
    <div className='flex flex-wrap gap-4'>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant='outline'>Open right</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit profile</SheetTitle>
            <SheetDescription>
              Make changes to your profile here.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant='outline'>Open left</Button>
        </SheetTrigger>
        <SheetContent side='left'>
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Browse the application.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </div>
  ),
}

export const WithoutCloseButton: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant='outline'>No close button</Button>
      </SheetTrigger>
      <SheetContent showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Custom close</SheetTitle>
          <SheetDescription>
            The built-in close button is hidden.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
}
