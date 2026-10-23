import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  BanknoteIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  FactoryIcon,
  PencilIcon,
  TrashIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDataTableLayoutState } from '../hooks/use-data-table-layout-state'
import type { DataTableFilterPreset } from '../hooks/use-data-table-url-state'
import { BadgeStatus } from './badge-status'
import { Button } from './button'
import { Card, CardContent } from './card'
import { Checkbox } from './checkbox'
import {
  type ColumnFiltersState,
  DataTable,
  type PaginationState,
  type Row,
  type SortingState,
} from './data-table'
import type { BulkAction } from './data-table-bulk-actions'
import { DataTableBulkActions } from './data-table-bulk-actions'
import type { DataTableCalendarConfig } from './data-table-calendar-view'
import { DataTableColumnHeader } from './data-table-column-header'
import { DataTableDateFilter } from './data-table-date-filter'
import { DataTableDisplayModeToggle } from './data-table-display-mode-toggle'
import { DataTableExport, exportRows } from './data-table-export'
import { DataTableFacetedFilter } from './data-table-faceted-filter'
import { DataTableFilterPresets } from './data-table-filter-presets'
import { DataTableNumberFilter } from './data-table-number-filter'
import { DataTablePagination } from './data-table-pagination'
import { DataTableRowActions } from './data-table-row-actions'
import { DataTableSearch } from './data-table-search'
import { DataTableSwitchFilter } from './data-table-switch-filter'
import type { ColumnDef } from './data-table-types'
import { DataTableViewOptions } from './data-table-view-options'
import { Icon } from './icon'
import { SettingsProvider } from './settings-provider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

/* -------------------------------------------------------------------------- */
/*  Types & sample data — Orders                                               */
/* -------------------------------------------------------------------------- */

type Order = {
  id: string
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  supplier: string
  amount: number
  date: string
  newCustomer: boolean
}

const statusColor: Record<Order['status'], 'green' | 'blue' | 'amber' | 'red'> =
  {
    pending: 'blue',
    processing: 'amber',
    shipped: 'green',
    delivered: 'green',
    cancelled: 'red',
  }

const facetedFilterFn = <T,>(
  row: { getValue: (id: string) => T },
  id: string,
  filterValues: string[],
) => filterValues.includes(String(row.getValue(id)))

const orders: Order[] = [
  {
    id: 'ORD-001',
    status: 'delivered',
    supplier: 'Acme Co.',
    amount: 250.0,
    date: '2026-01-15T08:30:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-002',
    status: 'processing',
    supplier: 'Global Supply',
    amount: 150.0,
    date: '2026-01-18T14:15:00Z',
    newCustomer: true,
  },
  {
    id: 'ORD-003',
    status: 'shipped',
    supplier: 'Quick Ship Ltd.',
    amount: 350.0,
    date: '2026-01-20T09:45:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-004',
    status: 'pending',
    supplier: 'Acme Co.',
    amount: 425.5,
    date: '2026-01-22T11:00:00Z',
    newCustomer: true,
  },
  {
    id: 'ORD-005',
    status: 'cancelled',
    supplier: 'Pacific Trade',
    amount: 89.99,
    date: '2026-01-23T16:20:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-006',
    status: 'delivered',
    supplier: 'Quick Ship Ltd.',
    amount: 1200.0,
    date: '2026-01-25T07:50:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-007',
    status: 'shipped',
    supplier: 'Global Supply',
    amount: 560.0,
    date: '2026-01-27T13:10:00Z',
    newCustomer: true,
  },
  {
    id: 'ORD-008',
    status: 'processing',
    supplier: 'North Star Inc.',
    amount: 310.0,
    date: '2026-01-28T10:30:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-009',
    status: 'pending',
    supplier: 'Pacific Trade',
    amount: 175.0,
    date: '2026-01-30T15:45:00Z',
    newCustomer: true,
  },
  {
    id: 'ORD-010',
    status: 'delivered',
    supplier: 'Acme Co.',
    amount: 890.0,
    date: '2026-02-01T09:00:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-011',
    status: 'shipped',
    supplier: 'North Star Inc.',
    amount: 445.0,
    date: '2026-02-03T12:25:00Z',
    newCustomer: true,
  },
  {
    id: 'ORD-012',
    status: 'processing',
    supplier: 'Quick Ship Ltd.',
    amount: 220.0,
    date: '2026-02-05T08:15:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-013',
    status: 'delivered',
    supplier: 'Global Supply',
    amount: 675.0,
    date: '2026-02-07T17:30:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-014',
    status: 'pending',
    supplier: 'Acme Co.',
    amount: 130.0,
    date: '2026-02-08T10:00:00Z',
    newCustomer: true,
  },
  {
    id: 'ORD-015',
    status: 'cancelled',
    supplier: 'Pacific Trade',
    amount: 95.0,
    date: '2026-02-09T14:40:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-016',
    status: 'shipped',
    supplier: 'North Star Inc.',
    amount: 780.0,
    date: '2026-02-10T11:55:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-017',
    status: 'delivered',
    supplier: 'Quick Ship Ltd.',
    amount: 340.0,
    date: '2026-02-11T07:20:00Z',
    newCustomer: true,
  },
  {
    id: 'ORD-018',
    status: 'processing',
    supplier: 'Acme Co.',
    amount: 510.0,
    date: '2026-02-12T16:05:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-019',
    status: 'pending',
    supplier: 'Global Supply',
    amount: 265.0,
    date: '2026-02-13T09:35:00Z',
    newCustomer: true,
  },
  {
    id: 'ORD-020',
    status: 'delivered',
    supplier: 'Pacific Trade',
    amount: 1050.0,
    date: '2026-02-14T13:50:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-021',
    status: 'shipped',
    supplier: 'Acme Co.',
    amount: 430.0,
    date: '2026-02-15T08:10:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-022',
    status: 'processing',
    supplier: 'North Star Inc.',
    amount: 195.0,
    date: '2026-02-16T15:25:00Z',
    newCustomer: true,
  },
  {
    id: 'ORD-023',
    status: 'cancelled',
    supplier: 'Quick Ship Ltd.',
    amount: 75.0,
    date: '2026-02-17T10:45:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-024',
    status: 'delivered',
    supplier: 'Global Supply',
    amount: 920.0,
    date: '2026-02-17T12:30:00Z',
    newCustomer: false,
  },
  {
    id: 'ORD-025',
    status: 'pending',
    supplier: 'Pacific Trade',
    amount: 385.0,
    date: '2026-02-17T17:00:00Z',
    newCustomer: true,
  },
]

/* -------------------------------------------------------------------------- */
/*  Types & sample data — Minimal (Person)                                     */
/* -------------------------------------------------------------------------- */

type Person = { name: string; email: string; role: string }

const minimalData: Person[] = [
  { name: 'Alice Martin', email: 'alice@example.com', role: 'Admin' },
  { name: 'Bob Johnson', email: 'bob@example.com', role: 'Editor' },
  { name: 'Clara Lee', email: 'clara@example.com', role: 'Viewer' },
  { name: 'David Kim', email: 'david@example.com', role: 'Editor' },
]

const minimalColumns: ColumnDef<Person>[] = [
  { accessorKey: 'name', header: () => 'Name' },
  { accessorKey: 'email', header: () => 'Email' },
  { accessorKey: 'role', header: () => 'Role' },
]

/* -------------------------------------------------------------------------- */
/*  Types & sample data — Products                                             */
/* -------------------------------------------------------------------------- */

type Product = { name: string; category: string; price: number; stock: number }

const products: Product[] = [
  { name: 'Wireless Mouse', category: 'Electronics', price: 29.99, stock: 150 },
  { name: 'USB-C Cable', category: 'Electronics', price: 12.99, stock: 300 },
  { name: 'Desk Lamp', category: 'Home', price: 45.0, stock: 80 },
  { name: 'Notebook A5', category: 'Stationery', price: 8.5, stock: 500 },
  { name: 'Webcam HD', category: 'Electronics', price: 59.99, stock: 45 },
  { name: 'Standing Desk Mat', category: 'Home', price: 35.0, stock: 120 },
  {
    name: 'Ballpoint Pen Pack',
    category: 'Stationery',
    price: 5.99,
    stock: 800,
  },
  { name: 'Monitor Stand', category: 'Home', price: 89.99, stock: 60 },
]

const sortableColumns: ColumnDef<Product>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Category' />
    ),
  },
  {
    accessorKey: 'price',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Price' align='end' />
    ),
    cell: ({ row }) => (
      <div className='text-right'>${row.original.price.toFixed(2)}</div>
    ),
  },
  {
    accessorKey: 'stock',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Stock' align='end' />
    ),
    cell: ({ row }) => <div className='text-right'>{row.original.stock}</div>,
  },
]

const actionsColumns: ColumnDef<Product>[] = [
  {
    accessorKey: 'name',
    header: () => 'Name',
    cell: ({ row }) => <span className='font-medium'>{row.original.name}</span>,
  },
  { accessorKey: 'category', header: () => 'Category' },
  {
    accessorKey: 'price',
    header: () => <div className='text-right'>Price</div>,
    cell: ({ row }) => (
      <div className='text-right'>${row.original.price.toFixed(2)}</div>
    ),
  },
  {
    id: 'actions',
    size: 40,
    cell: ({ row }) => (
      <DataTableRowActions
        row={row}
        actions={[
          {
            label: 'Edit',
            icon: <Icon icon={PencilIcon} />,
            onClick: r => console.log('Edit', r.original.name),
          },
          {
            label: 'Delete',
            icon: <Icon icon={TrashIcon} />,
            onClick: r => console.log('Delete', r.original.name),
            color: 'destructive',
            separator: true,
          },
        ]}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
]

/* -------------------------------------------------------------------------- */
/*  Types & sample data — Server-side                                          */
/* -------------------------------------------------------------------------- */

type ServerOrder = {
  id: string
  customer: string
  status: 'pending' | 'paid' | 'shipped' | 'refunded'
  total: number
}

const serverStatusColor: Record<
  ServerOrder['status'],
  'blue' | 'green' | 'amber' | 'red'
> = {
  pending: 'blue',
  paid: 'green',
  shipped: 'amber',
  refunded: 'red',
}

const allServerOrders: ServerOrder[] = Array.from({ length: 50 }, (_, i) => ({
  id: `SRV-${String(i + 1).padStart(3, '0')}`,
  customer: ['Alice', 'Bob', 'Clara', 'David', 'Eve', 'Frank'][i % 6] as string,
  status: (['pending', 'paid', 'shipped', 'refunded'] as const)[i % 4],
  // Deterministic, so visual tests compare the same table on every build.
  total: Math.round((50 + ((i * 7919) % 9500) / 10) * 100) / 100,
}))

const fakeFetch = async (params: {
  pagination: PaginationState
  sorting: SortingState
  columnFilters: ColumnFiltersState
}): Promise<{ rows: ServerOrder[]; rowCount: number }> => {
  await new Promise(r => setTimeout(r, 400))

  let filtered = [...allServerOrders]

  for (const filter of params.columnFilters) {
    const value = filter.value
    if (typeof value === 'string' && value) {
      filtered = filtered.filter(row =>
        String(row[filter.id as keyof ServerOrder])
          .toLowerCase()
          .includes(value.toLowerCase()),
      )
    } else if (Array.isArray(value) && value.length > 0) {
      filtered = filtered.filter(row =>
        value.includes(String(row[filter.id as keyof ServerOrder])),
      )
    }
  }

  const firstSort = params.sorting[0]
  if (firstSort) {
    const { id, desc } = firstSort
    filtered.sort((a, b) => {
      const aVal = a[id as keyof ServerOrder]
      const bVal = b[id as keyof ServerOrder]
      if (aVal < bVal) return desc ? 1 : -1
      if (aVal > bVal) return desc ? -1 : 1
      return 0
    })
  }

  const rowCount = filtered.length
  const { pageIndex, pageSize } = params.pagination
  const rows = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  return { rows, rowCount }
}

const serverColumns: ColumnDef<ServerOrder>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Order' />
    ),
    cell: ({ row }) => <span className='font-medium'>{row.original.id}</span>,
  },
  {
    accessorKey: 'customer',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Customer' />
    ),
  },
  {
    accessorKey: 'status',
    meta: { filterable: 'faceted' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => (
      <BadgeStatus
        status={serverStatusColor[row.original.status]}
        className='capitalize'>
        {row.original.status}
      </BadgeStatus>
    ),
  },
  {
    accessorKey: 'total',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Total' align='end' />
    ),
    cell: ({ row }) => (
      <div className='text-right font-medium'>
        ${row.original.total.toFixed(2)}
      </div>
    ),
  },
]

const serverStatusOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Refunded', value: 'refunded' },
]

/* -------------------------------------------------------------------------- */
/*  Order columns (shared across FullFeatured, DisplayModes, FilterPresets)     */
/* -------------------------------------------------------------------------- */

const columns: ColumnDef<Order>[] = [
  {
    id: 'select',
    size: 40,
    meta: { reorderable: false },
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={value => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'id',
    meta: { reorderable: false },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Order' />
    ),
    cell: ({ row }) => <span className='font-medium'>{row.original.id}</span>,
    enableHiding: false,
  },
  {
    accessorKey: 'status',
    meta: {
      filterable: 'faceted',
      renderFilterValue: (v: unknown) => {
        const status = String(v) as Order['status']
        return (
          <BadgeStatus status={statusColor[status]} className='capitalize'>
            {status}
          </BadgeStatus>
        )
      },
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => (
      <BadgeStatus
        status={statusColor[row.original.status]}
        className='capitalize'>
        {row.original.status}
      </BadgeStatus>
    ),
    filterFn: facetedFilterFn,
  },
  {
    accessorKey: 'supplier',
    meta: { filterable: 'faceted' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Supplier' />
    ),
    cell: ({ row }) => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>{row.original.supplier}</TooltipTrigger>
          <TooltipContent>
            <p>
              Michel Gauthier
              <br />
              06 00 00 00 00
              <br />
              acme-supply@example.com
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    filterFn: facetedFilterFn,
  },
  {
    accessorKey: 'newCustomer',
    meta: { filterable: 'switch' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='New customer' />
    ),
    cell: ({ row }) =>
      row.original.newCustomer ? (
        <BadgeStatus status='blue'>New</BadgeStatus>
      ) : (
        <span className='text-muted-foreground'>&mdash;</span>
      ),
    filterFn: (row, id, value: boolean) => row.getValue(id) === value,
    enableSorting: false,
  },
  {
    accessorKey: 'amount',
    meta: { filterable: 'number' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Amount' align='end' />
    ),
    cell: ({ row }) => {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(row.original.amount)
      return <div className='text-right font-medium'>{formatted}</div>
    },
    filterFn: (row, id, range: [number | undefined, number | undefined]) => {
      const value = row.getValue(id) as number
      const [min, max] = range
      if (min !== undefined && value < min) return false
      if (max !== undefined && value > max) return false
      return true
    },
  },
  {
    accessorKey: 'date',
    meta: { filterable: 'date' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Date' align='end' />
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.date)
      return (
        <div className='text-right'>
          <time dateTime={date.toISOString()} suppressHydrationWarning>
            {date.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
      )
    },
    filterFn: (row, id, range: [string | undefined, string | undefined]) => {
      const value = row.getValue(id) as string
      const [from, to] = range
      if (from && value < from) return false
      if (to && value > to) return false
      return true
    },
  },
  {
    id: 'actions',
    size: 40,
    meta: { reorderable: false },
    cell: ({ row }) => (
      <DataTableRowActions
        row={row}
        quickActions={
          <Button
            variant='ghost'
            size='icon'
            className='size-8'
            aria-label='Open full view'
            asChild>
            {/** biome-ignore lint/a11y/useValidAnchor: It's just an example */}
            <a href='#'>
              <Icon icon={EyeIcon} />
            </a>
          </Button>
        }
        actions={[
          {
            label: 'Edit order',
            icon: <Icon icon={PencilIcon} />,
            onClick: r => console.log('Edit', r.original.id),
          },
          {
            label: 'Copy ID',
            icon: <Icon icon={CopyIcon} />,
            onClick: r => console.log('Copy', r.original.id),
          },
          {
            label: 'Delete',
            icon: <Icon icon={TrashIcon} />,
            onClick: r => console.log('Delete', r.original.id),
            color: 'destructive',
            separator: true,
          },
        ]}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
]

/* -------------------------------------------------------------------------- */
/*  Bulk actions                                                               */
/* -------------------------------------------------------------------------- */

const bulkActions: BulkAction<Order>[] = [
  {
    label: 'Export as CSV',
    icon: <Icon icon={DownloadIcon} />,
    onClick: exportRows,
  },
  {
    label: 'Delete',
    icon: <Icon icon={TrashIcon} />,
    onClick: rows => console.log('Delete', rows.length, 'rows'),
    color: 'destructive',
  },
]

/* -------------------------------------------------------------------------- */
/*  Calendar / card helpers for DisplayModes                                    */
/* -------------------------------------------------------------------------- */

const statusDot: Record<Order['status'], string> = {
  pending: 'bg-blue-500',
  processing: 'bg-amber-500',
  shipped: 'bg-green-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
}

const OrderCalendarEvent = ({ order }: { order: Order }) => (
  <button
    type='button'
    className='flex w-full items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left text-xs hover:bg-accent cursor-pointer transition-colors'>
    <span
      className={`size-1.5 shrink-0 rounded-full ${statusDot[order.status]}`}
    />
    <span className='truncate'>{order.id}</span>
  </button>
)

const OrderCalendarEventCard = ({ order }: { order: Order }) => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(order.amount)

  return (
    <div className='rounded-lg border p-3'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='text-sm font-medium'>{order.id}</p>
          <p className='text-muted-foreground text-xs'>{order.supplier}</p>
        </div>
        <BadgeStatus status={statusColor[order.status]} className='capitalize'>
          {order.status}
        </BadgeStatus>
      </div>
      <p className='mt-2 text-sm font-medium'>{formatted}</p>
    </div>
  )
}

const OrderShowcaseCard = ({ order }: { order: Order }) => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(order.amount)

  return (
    <Card className='h-full'>
      <CardContent className='space-y-3 p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div>
            <p className='text-sm font-medium'>{order.id}</p>
            <p className='text-muted-foreground text-xs'>{order.supplier}</p>
          </div>
          <BadgeStatus
            status={statusColor[order.status]}
            className='capitalize'>
            {order.status}
          </BadgeStatus>
        </div>
        <div className='flex items-center justify-between text-sm'>
          <span className='text-muted-foreground'>
            {new Date(order.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span className='font-medium'>{formatted}</span>
        </div>
        {order.newCustomer && (
          <BadgeStatus status='blue'>New customer</BadgeStatus>
        )}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Filter presets                                                             */
/* -------------------------------------------------------------------------- */

const showcasePresets: DataTableFilterPreset[] = [
  {
    id: 'pending-only',
    label: 'Pending only',
    filters: () => [{ id: 'status', value: ['pending'] }],
  },
  {
    id: 'high-value',
    label: 'High value (> $500)',
    filters: () => [{ id: 'amount', value: [500, undefined] }],
  },
  {
    id: 'new-customers',
    label: 'New customers',
    filters: () => [{ id: 'newCustomer', value: true }],
  },
]

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

const meta = {
  title: 'Data Table/DataTable',
  tags: ['autodocs'],
  decorators: [
    Story => (
      <SettingsProvider>
        <Story />
      </SettingsProvider>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/* -------------------------------------------------------------------------- */
/*  1. FullFeatured                                                            */
/* -------------------------------------------------------------------------- */

export const FullFeatured: Story = {
  render: () => (
    <DataTable
      columns={columns}
      data={orders}
      enableColumnReordering
      fixedHeight
      initialColumnVisibility={{ newCustomer: false }}
      initialColumnPinning={{ start: ['id'] }}
      toolbar={() => (
        <div className='space-y-2'>
          <div className='flex items-center justify-end gap-2'>
            <DataTableExport />
            <DataTableViewOptions />
          </div>
          <Card className='py-3'>
            <CardContent className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4'>
              <DataTableSearch
                columns={[
                  { id: 'id', label: 'Order' },
                  { id: 'supplier', label: 'Supplier' },
                ]}
              />
              <div className='flex flex-wrap items-center gap-2'>
                <DataTableFacetedFilter columnId='status' title='Status' />
                <DataTableFacetedFilter
                  columnId='supplier'
                  title='Supplier'
                  icon={<Icon icon={FactoryIcon} />}
                />
                <DataTableNumberFilter
                  columnId='amount'
                  title='Amount'
                  icon={<Icon icon={BanknoteIcon} />}
                />
                <DataTableDateFilter columnId='date' title='Date' />
                <DataTableSwitchFilter
                  columnId='newCustomer'
                  label='New customer'
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      bulkActions={_ => <DataTableBulkActions actions={bulkActions} />}
      footer={_ => <DataTablePagination />}
    />
  ),
}

/* -------------------------------------------------------------------------- */
/*  2. Minimal                                                                 */
/* -------------------------------------------------------------------------- */

export const Minimal: Story = {
  render: () => <DataTable columns={minimalColumns} data={minimalData} />,
}

/* -------------------------------------------------------------------------- */
/*  3. SortingAndPagination                                                    */
/* -------------------------------------------------------------------------- */

export const SortingAndPagination: Story = {
  render: () => (
    <DataTable
      columns={sortableColumns}
      data={products}
      toolbar={_ => (
        <div className='flex justify-end'>
          <DataTableViewOptions />
        </div>
      )}
      footer={_ => <DataTablePagination />}
    />
  ),
}

/* -------------------------------------------------------------------------- */
/*  4. LayoutPersistence                                                       */
/* -------------------------------------------------------------------------- */

const LayoutPersistenceExample = () => {
  const layoutState = useDataTableLayoutState({
    tableId: 'showcase-products',
    defaultColumnVisibility: { stock: false },
  })

  return (
    <DataTable
      key={layoutState.resetKey}
      columns={sortableColumns}
      data={products}
      enableColumnReordering
      initialColumnVisibility={layoutState.initialColumnVisibility}
      onColumnVisibilityChange={layoutState.onColumnVisibilityChange}
      initialColumnPinning={layoutState.initialColumnPinning}
      onColumnPinningChange={layoutState.onColumnPinningChange}
      initialColumnOrder={layoutState.initialColumnOrder}
      onColumnOrderChange={layoutState.onColumnOrderChange}
      toolbar={_ => (
        <div className='flex justify-end'>
          <DataTableViewOptions layoutState={layoutState} />
        </div>
      )}
      footer={_ => <DataTablePagination />}
    />
  )
}

export const LayoutPersistence: Story = {
  render: () => <LayoutPersistenceExample />,
}

/* -------------------------------------------------------------------------- */
/*  5. RowActions                                                              */
/* -------------------------------------------------------------------------- */

export const RowActions: Story = {
  render: () => <DataTable columns={actionsColumns} data={products} />,
}

/* -------------------------------------------------------------------------- */
/*  6. ServerSide                                                              */
/* -------------------------------------------------------------------------- */

const ServerSideExample = () => {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [data, setData] = useState<ServerOrder[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const result = await fakeFetch({ pagination, sorting, columnFilters })
    setData(result.rows)
    setRowCount(result.rowCount)
    setLoading(false)
  }, [pagination, sorting, columnFilters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <DataTable
      manualMode
      loading={loading}
      columns={serverColumns}
      data={data}
      rowCount={rowCount}
      pagination={pagination}
      onPaginationChange={setPagination}
      sorting={sorting}
      onSortingChange={setSorting}
      columnFilters={columnFilters}
      onColumnFiltersChange={updater => {
        setColumnFilters(updater)
        setPagination(prev => ({ ...prev, pageIndex: 0 }))
      }}
      toolbar={() => (
        <Card className='py-3'>
          <CardContent className='flex items-center justify-between gap-4'>
            <DataTableSearch
              columns={[
                { id: 'id', label: 'Order' },
                { id: 'customer', label: 'Customer' },
              ]}
            />
            <DataTableFacetedFilter
              columnId='status'
              title='Status'
              options={serverStatusOptions}
            />
          </CardContent>
        </Card>
      )}
      footer={_ => <DataTablePagination />}
    />
  )
}

export const ServerSide: Story = {
  render: () => <ServerSideExample />,
}

/* -------------------------------------------------------------------------- */
/*  7. DisplayModes                                                            */
/* -------------------------------------------------------------------------- */

const DisplayModesExample = () => {
  const layoutState = useDataTableLayoutState({
    tableId: 'showcase-display-modes',
    defaultDisplayMode: 'calendar',
  })

  const isCalendarMode = layoutState.displayMode === 'calendar'

  const calendarConfig = useMemo<DataTableCalendarConfig<Order>>(
    () => ({
      dateFields: [{ id: 'date', label: 'Order Date' }],
      dateAccessor: (order, _fieldId) => {
        return order.date ? new Date(order.date) : null
      },
      renderEvent: (row: Row<Order>) => (
        <OrderCalendarEvent order={row.original} />
      ),
      renderEventDetail: (row: Row<Order>) => (
        <OrderCalendarEventCard order={row.original} />
      ),
    }),
    [],
  )

  return (
    <DataTable
      key={layoutState.resetKey}
      columns={columns}
      data={orders}
      enableColumnReordering
      renderCard={row => <OrderShowcaseCard order={row.original} />}
      calendarConfig={calendarConfig}
      {...layoutState}
      toolbar={_ => (
        <div className='flex items-center justify-end gap-2'>
          <DataTableDisplayModeToggle
            displayMode={layoutState.displayMode}
            onDisplayModeChange={layoutState.onDisplayModeChange}
            showCard
            showCalendar
          />
          <DataTableViewOptions layoutState={layoutState} />
        </div>
      )}
      footer={isCalendarMode ? undefined : _ => <DataTablePagination />}
    />
  )
}

export const DisplayModes: Story = {
  render: () => <DisplayModesExample />,
}

/* -------------------------------------------------------------------------- */
/*  8. FilterPresets                                                           */
/* -------------------------------------------------------------------------- */

const FilterPresetsExample = () => {
  const [activePreset, setActivePreset] = useState<string | null>(null)

  return (
    <DataTable
      columns={columns}
      data={orders}
      fixedHeight
      toolbar={table => {
        const handlePresetChange = (presetId: string | null) => {
          setActivePreset(presetId)
          const preset = presetId
            ? showcasePresets.find(p => p.id === presetId)
            : undefined
          table.setColumnFilters(preset ? preset.filters() : [])
        }

        return (
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <DataTableFilterPresets
                presets={showcasePresets}
                activePreset={activePreset}
                onPresetChange={handlePresetChange}
                labels={{ trigger: 'Quick filters' }}
              />
              <div className='ml-auto'>
                <DataTableViewOptions />
              </div>
            </div>
            {!activePreset && (
              <Card className='py-3'>
                <CardContent className='flex flex-wrap items-center gap-2'>
                  <DataTableFacetedFilter columnId='status' title='Status' />
                  <DataTableNumberFilter
                    columnId='amount'
                    title='Amount'
                    icon={<Icon icon={BanknoteIcon} />}
                  />
                  <DataTableSwitchFilter
                    columnId='newCustomer'
                    label='New customer'
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )
      }}
      footer={_ => <DataTablePagination />}
    />
  )
}

export const FilterPresets: Story = {
  render: () => <FilterPresetsExample />,
}
