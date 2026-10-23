import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion'

const meta = {
  title: 'General/Accordion',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  render: () => (
    <div className='w-full max-w-lg'>
      <Accordion type='single' collapsible defaultValue='item-1'>
        <AccordionItem value='item-1'>
          <AccordionTrigger>How do I track my order?</AccordionTrigger>
          <AccordionContent>
            You can track your order by logging into your account and visiting
            the "Orders" section. You'll receive tracking information via email
            once your order ships.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value='item-2'>
          <AccordionTrigger>What is your return policy?</AccordionTrigger>
          <AccordionContent>
            We offer a 30-day return policy for most items. Products must be
            unused and in their original packaging.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value='item-3'>
          <AccordionTrigger>
            How can I contact customer support?
          </AccordionTrigger>
          <AccordionContent>
            Our customer support team is available 24/7. You can reach us via
            live chat, email, or by phone.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
}

export const Multiple: Story = {
  render: () => (
    <div className='w-full max-w-lg'>
      <Accordion type='multiple' defaultValue={['item-1', 'item-3']}>
        <AccordionItem value='item-1'>
          <AccordionTrigger>Section one</AccordionTrigger>
          <AccordionContent>Content for the first section.</AccordionContent>
        </AccordionItem>
        <AccordionItem value='item-2'>
          <AccordionTrigger>Section two</AccordionTrigger>
          <AccordionContent>Content for the second section.</AccordionContent>
        </AccordionItem>
        <AccordionItem value='item-3'>
          <AccordionTrigger>Section three</AccordionTrigger>
          <AccordionContent>Content for the third section.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
}
