import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent } from './card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible'
import { Icon } from './icon'

const meta = {
  title: 'General/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
  argTypes: {
    defaultOpen: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Collapsible>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Collapsible className='data-[state=open]:bg-muted w-[320px] rounded-md'>
      <CollapsibleTrigger asChild>
        <Button variant='ghost' className='group w-full'>
          Product details
          <Icon
            icon={ChevronDownIcon}
            className='ml-auto group-data-[state=open]:rotate-180'
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className='flex flex-col items-start gap-2 p-2.5 pt-0 text-sm'>
        <div>
          This panel can be expanded or collapsed to reveal additional content.
        </div>
        <Button size='sm'>Learn More</Button>
      </CollapsibleContent>
    </Collapsible>
  ),
}

export const AccordionList: Story = {
  render: () => (
    <Card className='w-full max-w-sm'>
      <CardContent className='space-y-1'>
        <Collapsible className='data-[state=open]:bg-muted rounded-md'>
          <CollapsibleTrigger asChild>
            <Button variant='ghost' className='group w-full'>
              Product details
              <Icon
                icon={ChevronDownIcon}
                className='ml-auto group-data-[state=open]:rotate-180'
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className='flex flex-col items-start gap-2 p-2.5 pt-0 text-sm'>
            <div>
              This panel can be expanded or collapsed to reveal additional
              content.
            </div>
            <Button size='sm'>Learn More</Button>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible className='data-[state=open]:bg-muted rounded-md'>
          <CollapsibleTrigger asChild>
            <Button variant='ghost' className='group w-full'>
              Shipping information
              <Icon
                icon={ChevronDownIcon}
                className='ml-auto group-data-[state=open]:rotate-180'
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className='flex flex-col items-start gap-2 p-2.5 pt-0 text-sm'>
            <div>
              Estimated delivery: 3-5 business days via express shipping.
            </div>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible className='data-[state=open]:bg-muted rounded-md'>
          <CollapsibleTrigger asChild>
            <Button variant='ghost' className='group w-full'>
              Return policy
              <Icon
                icon={ChevronDownIcon}
                className='ml-auto group-data-[state=open]:rotate-180'
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className='flex flex-col items-start gap-2 p-2.5 pt-0 text-sm'>
            <div>
              Items can be returned within 30 days of purchase for a full
              refund.
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  ),
}

export const DefaultOpen: Story = {
  render: () => (
    <Collapsible
      defaultOpen
      className='data-[state=open]:bg-muted w-[320px] rounded-md'>
      <CollapsibleTrigger asChild>
        <Button variant='ghost' className='group w-full'>
          Expanded by default
          <Icon
            icon={ChevronDownIcon}
            className='ml-auto group-data-[state=open]:rotate-180'
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className='p-2.5 pt-0 text-sm'>
        This collapsible starts in an open state.
      </CollapsibleContent>
    </Collapsible>
  ),
}
