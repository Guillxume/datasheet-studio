import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'

const meta = {
  title: 'Data Display/Card',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card className='max-w-sm'>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className='text-sm'>This is the card content area.</p>
      </CardContent>
    </Card>
  ),
}

export const WithFooter: Story = {
  render: () => (
    <Card className='max-w-sm'>
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
        <CardDescription>
          Review your recent orders and shipments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className='text-sm'>
          You have 3 pending orders and 12 completed shipments this month.
        </p>
      </CardContent>
      <CardFooter>
        <button
          type='button'
          className='bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm'>
          View Orders
        </button>
      </CardFooter>
    </Card>
  ),
}

export const WithAction: Story = {
  render: () => (
    <Card className='max-w-sm'>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Stay updated on supplier activity.</CardDescription>
        <CardAction>
          <button
            type='button'
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-2'>
            Mark all read
          </button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className='text-sm'>2 new messages from suppliers.</p>
      </CardContent>
    </Card>
  ),
}

export const TitleHeadingLevel: Story = {
  render: () => (
    <Card className='max-w-sm'>
      <CardHeader>
        <CardTitle as='h2'>Semantic Heading</CardTitle>
        <CardDescription>
          CardTitle supports h1–h6 and div via the `as` prop.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className='text-sm'>
          Use the correct heading level for accessibility.
        </p>
      </CardContent>
    </Card>
  ),
}

export const Grid: Story = {
  render: () => (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
      <Card>
        <CardHeader>
          <CardTitle as='h3'>Order Summary</CardTitle>
          <CardDescription>
            Review your recent orders and shipments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm'>
            You have 3 pending orders and 12 completed shipments this month.
          </p>
        </CardContent>
        <CardFooter>
          <button
            type='button'
            className='bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm'>
            View Orders
          </button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as='h3'>Notifications</CardTitle>
          <CardDescription>Stay updated on supplier activity.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm'>2 new messages from suppliers.</p>
        </CardContent>
      </Card>
    </div>
  ),
}
