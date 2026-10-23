import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from './button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerNested,
  DrawerTitle,
  DrawerTrigger,
} from './drawer'

const meta = {
  title: 'Overlays/Drawer',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant='outline'>Open bottom</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit profile</DrawerTitle>
          <DrawerDescription>
            Make changes to your profile here.
          </DrawerDescription>
        </DrawerHeader>
        <div className='p-4'>
          <p className='text-muted-foreground text-sm'>
            Drawer content goes here.
          </p>
        </div>
        <DrawerFooter>
          <Button>Save changes</Button>
          <DrawerClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
}

export const Nested: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant='outline'>Nested drawers</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Select an option</DrawerTitle>
          <DrawerDescription>
            This drawer contains another drawer.
          </DrawerDescription>
        </DrawerHeader>
        <div className='p-4'>
          <DrawerNested>
            <DrawerTrigger asChild>
              <Button variant='outline' className='w-full'>
                Open nested drawer
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Nested drawer</DrawerTitle>
                <DrawerDescription>
                  This is a drawer inside a drawer.
                </DrawerDescription>
              </DrawerHeader>
              <div className='flex-1 p-4'>
                <p className='text-muted-foreground text-sm'>
                  The parent drawer scales down behind this one.
                </p>
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant='outline'>Close</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </DrawerNested>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
}

export const NoScaleBackground: Story = {
  render: () => (
    <Drawer shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <Button variant='outline'>No scale</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>No scaled background</DrawerTitle>
          <DrawerDescription>
            Background scaling is explicitly disabled.
          </DrawerDescription>
        </DrawerHeader>
        <div className='p-4'>
          <p className='text-muted-foreground text-sm'>
            The page behind stays in place.
          </p>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant='outline'>Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
}

export const WithoutCloseButton: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant='outline'>No close button</Button>
      </DrawerTrigger>
      <DrawerContent showCloseButton={false}>
        <DrawerHeader>
          <DrawerTitle>Custom close</DrawerTitle>
          <DrawerDescription>
            The built-in close button is hidden. Use the footer button to close.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant='outline'>Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
}

export const Scrollable: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant='outline'>Scrollable</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Terms of Service</DrawerTitle>
          <DrawerDescription>
            Scroll to read the full content.
          </DrawerDescription>
        </DrawerHeader>
        <div className='overflow-y-auto p-4'>
          {Array.from({ length: 20 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static demo content
            <p key={i} className='text-muted-foreground mb-4 text-sm'>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris.
            </p>
          ))}
        </div>
        <DrawerFooter>
          <Button>Accept</Button>
          <DrawerClose asChild>
            <Button variant='outline'>Decline</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
}

const snapPoints = [0.15, 0.3, 0.8]

export const SnapPoints: Story = {
  render: () => {
    const [snap, setSnap] = useState<number | string | null>(snapPoints[0])

    return (
      <Drawer
        snapPoints={snapPoints}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}>
        <DrawerTrigger asChild>
          <Button variant='outline'>Snap points</Button>
        </DrawerTrigger>
        <DrawerContent className='shadow-[0_-4px_16px_rgba(0,0,0,0.1)]'>
          <DrawerHeader>
            <DrawerTitle>Snap points</DrawerTitle>
            <DrawerDescription>
              Drag up and down to snap between 15%, 30%, and 80%.
            </DrawerDescription>
          </DrawerHeader>
          <div className='flex-1 overflow-y-auto p-4'>
            <p className='text-muted-foreground text-sm'>
              Current snap point: {snap}
            </p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant='outline'>Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  },
}
