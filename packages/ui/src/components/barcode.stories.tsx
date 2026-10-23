import type { Meta, StoryObj } from '@storybook/react-vite'
import { Barcode, type BarcodeFormat } from './barcode'

const meta = {
  title: 'General/Barcode',
  component: Barcode,
  tags: ['autodocs'],
  argTypes: {
    format: {
      control: 'select',
      options: [
        'code128',
        'code39',
        'ean13',
        'ean8',
        'upca',
        'upce',
        'itf',
        'itf14',
        'datamatrix',
        'pdf417',
        'aztec',
      ] satisfies BarcodeFormat[],
    },
    value: { control: 'text' },
  },
} satisfies Meta<typeof Barcode>

export default meta
type Story = StoryObj<typeof meta>

export const Code128: Story = {
  args: { format: 'code128', value: 'ORD-12345', className: 'h-16 w-auto' },
}

export const Code39: Story = {
  args: { format: 'code39', value: 'HELLO-WORLD', className: 'h-16 w-auto' },
}

export const EAN13: Story = {
  args: { format: 'ean13', value: '5901234123457', className: 'h-16 w-auto' },
}

export const EAN8: Story = {
  args: { format: 'ean8', value: '96385074', className: 'h-16 w-auto' },
}

export const UPCA: Story = {
  args: { format: 'upca', value: '036000291452', className: 'h-16 w-auto' },
}

export const UPCE: Story = {
  args: { format: 'upce', value: '01234565', className: 'h-16 w-auto' },
}

export const ITF: Story = {
  args: { format: 'itf', value: '1234567890', className: 'h-16 w-auto' },
}

export const ITF14: Story = {
  args: { format: 'itf14', value: '10012345678902', className: 'h-16 w-auto' },
}

export const DataMatrix: Story = {
  args: { format: 'datamatrix', value: 'ORD-12345', className: 'size-32' },
}

export const PDF417: Story = {
  args: {
    format: 'pdf417',
    value: 'ORD-12345-PDF417',
    className: 'h-20 w-auto',
  },
}

export const Aztec: Story = {
  args: { format: 'aztec', value: 'ORD-12345', className: 'size-32' },
}

export const ErrorState: Story = {
  args: { format: 'ean13', value: '0000000000001', className: 'h-16 w-auto' },
}
