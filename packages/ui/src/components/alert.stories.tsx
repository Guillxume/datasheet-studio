import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  AlertTriangle,
  CircleCheckIcon,
  InfoIcon,
  Terminal,
  TriangleAlertIcon,
} from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from './alert'
import { Button } from './button'
import { Icon } from './icon'

const meta = {
  title: 'Feedback/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'success', 'warning', 'info'],
    },
  },
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Alert>
      <Icon icon={Terminal} />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        You can add components to your app using the CLI.
      </AlertDescription>
    </Alert>
  ),
}

export const Destructive: Story = {
  render: () => (
    <Alert variant='destructive'>
      <Icon icon={AlertTriangle} />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Your session has expired. Please log in again.
      </AlertDescription>
    </Alert>
  ),
}

export const Success: Story = {
  render: () => (
    <Alert variant='success'>
      <Icon icon={CircleCheckIcon} />
      <AlertTitle>Order confirmed</AlertTitle>
      <AlertDescription>
        Your order has been placed and is being processed.
      </AlertDescription>
    </Alert>
  ),
}

export const Warning: Story = {
  render: () => (
    <Alert variant='warning'>
      <Icon icon={TriangleAlertIcon} />
      <AlertTitle>Low stock</AlertTitle>
      <AlertDescription>
        Only 3 units remaining. Restock soon to avoid delays.
      </AlertDescription>
    </Alert>
  ),
}

export const Info: Story = {
  render: () => (
    <Alert variant='info'>
      <Icon icon={InfoIcon} />
      <AlertTitle>New supplier available</AlertTitle>
      <AlertDescription>
        A new supplier has been added to your network.
      </AlertDescription>
    </Alert>
  ),
}

export const Variants: Story = {
  render: () => (
    <div className='space-y-3'>
      <Alert>
        <Icon icon={Terminal} />
        <AlertTitle>Default</AlertTitle>
        <AlertDescription>This is a default alert.</AlertDescription>
      </Alert>
      <Alert variant='destructive'>
        <Icon icon={AlertTriangle} />
        <AlertTitle>Destructive</AlertTitle>
        <AlertDescription>This is a destructive alert.</AlertDescription>
      </Alert>
      <Alert variant='success'>
        <Icon icon={CircleCheckIcon} />
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>This is a success alert.</AlertDescription>
      </Alert>
      <Alert variant='warning'>
        <Icon icon={TriangleAlertIcon} />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>This is a warning alert.</AlertDescription>
      </Alert>
      <Alert variant='info'>
        <Icon icon={InfoIcon} />
        <AlertTitle>Info</AlertTitle>
        <AlertDescription>This is an info alert.</AlertDescription>
      </Alert>
    </div>
  ),
}

export const WithAction: Story = {
  render: () => (
    <div className='space-y-3'>
      <Alert>
        <Icon icon={Terminal} />
        <AlertTitle>Update available</AlertTitle>
        <AlertDescription>
          A new version of the CLI is available.
        </AlertDescription>
        <AlertAction>
          <Button size='sm' variant='outline'>
            Update
          </Button>
        </AlertAction>
      </Alert>
      <Alert variant='destructive'>
        <Icon icon={AlertTriangle} />
        <AlertTitle>Order failed</AlertTitle>
        <AlertDescription>
          Payment could not be processed. Please try again.
        </AlertDescription>
        <AlertAction>
          <Button size='sm' variant='outline'>
            Retry
          </Button>
        </AlertAction>
      </Alert>
      <Alert variant='warning'>
        <Icon icon={TriangleAlertIcon} />
        <AlertTitle>Pending approval</AlertTitle>
        <AlertDescription>
          This order requires manual review before processing.
        </AlertDescription>
        <AlertAction className='flex gap-2'>
          <Button size='sm' variant='outline'>
            Reject
          </Button>
          <Button size='sm'>Approve</Button>
        </AlertAction>
      </Alert>
    </div>
  ),
}
