import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { Progress, ProgressCircle } from './progress'

const meta = {
  title: 'Feedback/Progress',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Linear: Story = {
  render: () => (
    <div className='w-full space-y-2'>
      <Progress value={25} />
      <Progress value={50} />
      <Progress value={75} />
      <Progress value={100} />
    </div>
  ),
}

export const Animated: Story = {
  render: () => {
    const [value, setValue] = useState(0)

    useEffect(() => {
      const interval = setInterval(() => {
        setValue(prev => (prev >= 100 ? 0 : prev + 10))
      }, 800)
      return () => clearInterval(interval)
    }, [])

    return (
      <div className='w-full space-y-1'>
        <Progress value={value} />
        <p className='text-muted-foreground text-xs'>Animated: {value}%</p>
      </div>
    )
  },
}

export const Circular: Story = {
  render: () => (
    <div className='flex items-center gap-6'>
      <ProgressCircle value={25} size='sm' />
      <ProgressCircle value={50} />
      <ProgressCircle value={75} size='lg'>
        75%
      </ProgressCircle>
    </div>
  ),
}

export const CircularAnimated: Story = {
  render: () => {
    const [value, setValue] = useState(0)

    useEffect(() => {
      const interval = setInterval(() => {
        setValue(prev => (prev >= 100 ? 0 : prev + 10))
      }, 800)
      return () => clearInterval(interval)
    }, [])

    return (
      <div className='flex items-center gap-6'>
        <ProgressCircle value={value} size='sm' />
        <ProgressCircle value={value} />
        <ProgressCircle value={value} size='lg'>
          {value}%
        </ProgressCircle>
      </div>
    )
  },
}

export const All: Story = {
  render: () => {
    const [value, setValue] = useState(0)

    useEffect(() => {
      const interval = setInterval(() => {
        setValue(prev => (prev >= 100 ? 0 : prev + 10))
      }, 800)
      return () => clearInterval(interval)
    }, [])

    return (
      <div className='space-y-8'>
        <div>
          <p className='text-muted-foreground mb-3 text-sm font-medium'>
            Linear
          </p>
          <div className='space-y-2'>
            <Progress value={25} />
            <Progress value={50} />
            <Progress value={75} />
          </div>
          <div className='mt-4 space-y-1'>
            <Progress value={value} />
            <p className='text-muted-foreground text-xs'>Animated: {value}%</p>
          </div>
        </div>
        <div>
          <p className='text-muted-foreground mb-3 text-sm font-medium'>
            Circular
          </p>
          <div className='flex items-center gap-6'>
            <ProgressCircle value={25} size='sm' />
            <ProgressCircle value={50} />
            <ProgressCircle value={value} size='lg'>
              {value}%
            </ProgressCircle>
          </div>
        </div>
      </div>
    )
  },
}
