import type { Meta, StoryObj } from '@storybook/react-vite'
import { QRCode } from './qr-code'

const meta = {
  title: 'General/QRCode',
  component: QRCode,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text' },
  },
} satisfies Meta<typeof QRCode>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 'https://example.com/orders/12345',
    className: 'size-40',
  },
}

export const LongValue: Story = {
  args: {
    value: JSON.stringify({
      orderId: 'ORD-2026-05-05-000123',
      pickup: 'WH-A-DOCK-3',
      ts: '2026-05-05T10:00:00Z',
    }),
    className: 'size-48',
  },
}

export const ErrorState: Story = {
  args: {
    value: 'x'.repeat(5000),
    className: 'size-40',
  },
}
