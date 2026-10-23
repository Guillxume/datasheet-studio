import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

const meta = {
  title: 'Data Display/Table',
  component: Table,
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const shipments = [
  {
    order: 'ORD-001',
    status: 'Shipped',
    supplier: 'Acme Co.',
    amount: '$250.00',
  },
  {
    order: 'ORD-002',
    status: 'Processing',
    supplier: 'Global Supply',
    amount: '$150.00',
  },
  {
    order: 'ORD-003',
    status: 'Delivered',
    supplier: 'Quick Ship Ltd.',
    amount: '$350.00',
  },
]

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Recent shipments</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead className='text-right'>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map(row => (
          <TableRow key={row.order}>
            <TableCell className='font-medium'>{row.order}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.supplier}</TableCell>
            <TableCell className='text-right'>{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

export const WithFooter: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead className='text-right'>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map(row => (
          <TableRow key={row.order}>
            <TableCell className='font-medium'>{row.order}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.supplier}</TableCell>
            <TableCell className='text-right'>{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className='text-right'>$750.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
}

export const Empty: Story = {
  render: () => (
    <Table>
      <TableCaption>No shipments found.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead className='text-right'>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={4} className='text-muted-foreground text-center'>
            No results.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}

export const ManyColumns: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Carrier</TableHead>
          <TableHead>Tracking</TableHead>
          <TableHead className='text-right'>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className='font-medium'>ORD-001</TableCell>
          <TableCell>2024-01-15</TableCell>
          <TableCell>Shipped</TableCell>
          <TableCell>Acme Co.</TableCell>
          <TableCell>DHL</TableCell>
          <TableCell className='font-mono text-xs'>
            1Z999AA10123456784
          </TableCell>
          <TableCell className='text-right'>$250.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className='font-medium'>ORD-002</TableCell>
          <TableCell>2024-01-16</TableCell>
          <TableCell>Processing</TableCell>
          <TableCell>Global Supply</TableCell>
          <TableCell>UPS</TableCell>
          <TableCell className='font-mono text-xs'>—</TableCell>
          <TableCell className='text-right'>$150.00</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}
