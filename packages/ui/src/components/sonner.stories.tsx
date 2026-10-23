import type { Meta, StoryObj } from '@storybook/react-vite'
import { toast } from 'sonner'
import { Button } from './button'
import { Toaster } from './sonner'

const meta = {
  title: 'Feedback/Toast',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <>
      <Toaster />
      <Button variant='outline' onClick={() => toast('Event has been created')}>
        Show Toast
      </Button>
    </>
  ),
}

export const Success: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant='outline'
        onClick={() =>
          toast.success('Order shipped', {
            description: 'Your order has been dispatched.',
          })
        }>
        Success
      </Button>
    </>
  ),
}

export const ToastError: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant='outline'
        onClick={() => toast.error('Something went wrong')}>
        Error
      </Button>
    </>
  ),
}

export const Warning: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant='outline'
        onClick={() => toast.warning('Low stock warning')}>
        Warning
      </Button>
    </>
  ),
}

export const Info: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant='outline'
        onClick={() => toast.info('New supplier available')}>
        Info
      </Button>
    </>
  ),
}

export const WithAction: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant='outline'
        onClick={() => {
          let id: string | number
          id = toast.success('Order deleted', {
            description: (
              <button
                type='button'
                className='font-medium underline underline-offset-2'
                onClick={() => {
                  toast.dismiss(id)
                  toast.success('Order restored')
                }}>
                Undo
              </button>
            ),
          })
        }}>
        With Action
      </Button>
    </>
  ),
}

export const AllTypes: Story = {
  render: () => (
    <>
      <Toaster />
      <div className='flex flex-wrap gap-3'>
        <Button
          variant='outline'
          onClick={() => toast('Event has been created')}>
          Default
        </Button>
        <Button
          variant='outline'
          onClick={() =>
            toast.success('Order shipped', {
              description: 'Your order has been dispatched.',
            })
          }>
          Success
        </Button>
        <Button
          variant='outline'
          onClick={() => toast.error('Something went wrong')}>
          Error
        </Button>
        <Button
          variant='outline'
          onClick={() => toast.warning('Low stock warning')}>
          Warning
        </Button>
        <Button
          variant='outline'
          onClick={() => toast.info('New supplier available')}>
          Info
        </Button>
        <Button
          variant='outline'
          onClick={() => {
            let id: string | number
            id = toast.success('Order deleted', {
              description: (
                <button
                  type='button'
                  className='font-medium underline underline-offset-2'
                  onClick={() => {
                    toast.dismiss(id)
                    toast.success('Order restored')
                  }}>
                  Undo
                </button>
              ),
            })
          }}>
          With Action
        </Button>
      </div>
    </>
  ),
}
