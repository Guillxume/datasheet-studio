import type { Meta, StoryObj } from '@storybook/react-vite'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from 'recharts'
import { SettingsProvider } from './settings-provider'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from './chart'

const meta = {
  title: 'Data Display/Chart',
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

const barData = [
  { month: 'Jan', orders: 186, shipments: 80 },
  { month: 'Feb', orders: 305, shipments: 200 },
  { month: 'Mar', orders: 237, shipments: 120 },
  { month: 'Apr', orders: 73, shipments: 190 },
  { month: 'May', orders: 209, shipments: 130 },
  { month: 'Jun', orders: 214, shipments: 140 },
]

const barConfig = {
  orders: { label: 'Orders', color: 'var(--primary)' },
  shipments: { label: 'Shipments', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

const lineData = [
  { month: 'Jan', orders: 186, shipments: 80, returns: 12 },
  { month: 'Feb', orders: 305, shipments: 200, returns: 24 },
  { month: 'Mar', orders: 237, shipments: 120, returns: 18 },
  { month: 'Apr', orders: 73, shipments: 190, returns: 8 },
  { month: 'May', orders: 209, shipments: 130, returns: 15 },
  { month: 'Jun', orders: 214, shipments: 140, returns: 20 },
]

const lineConfig = {
  orders: { label: 'Orders', color: 'var(--primary)' },
  shipments: { label: 'Shipments', color: 'var(--muted-foreground)' },
  returns: { label: 'Returns', color: 'var(--destructive)' },
} satisfies ChartConfig

export const BarChartStory: Story = {
  name: 'Bar Chart',
  render: () => (
    <ChartContainer
      config={barConfig}
      className='max-h-[300px] w-full'
      aria-label='Monthly orders and shipments bar chart'>
      <BarChart data={barData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey='month'
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          isAnimationActive={false}
          dataKey='orders'
          fill='var(--color-orders)'
          radius={4}
        />
        <Bar
          isAnimationActive={false}
          dataKey='shipments'
          fill='var(--color-shipments)'
          radius={4}
        />
      </BarChart>
    </ChartContainer>
  ),
}

export const LineChartStory: Story = {
  name: 'Line Chart (Multiple Series)',
  render: () => (
    <ChartContainer
      config={lineConfig}
      className='max-h-[300px] w-full'
      aria-label='Monthly orders, shipments and returns trend'>
      <LineChart data={lineData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey='month'
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          isAnimationActive={false}
          type='natural'
          dataKey='orders'
          stroke='var(--color-orders)'
          strokeWidth={2}
          dot={false}
        />
        <Line
          isAnimationActive={false}
          type='natural'
          dataKey='shipments'
          stroke='var(--color-shipments)'
          strokeWidth={2}
          dot={false}
        />
        <Line
          isAnimationActive={false}
          type='natural'
          dataKey='returns'
          stroke='var(--color-returns)'
          strokeWidth={2}
          strokeDasharray='5 5'
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  ),
}

export const BarChartNoLegend: Story = {
  name: 'Bar Chart (No Legend)',
  render: () => (
    <ChartContainer
      config={barConfig}
      className='max-h-[300px] w-full'
      aria-label='Monthly orders and shipments bar chart without legend'>
      <BarChart data={barData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey='month'
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          isAnimationActive={false}
          dataKey='orders'
          fill='var(--color-orders)'
          radius={4}
        />
        <Bar
          isAnimationActive={false}
          dataKey='shipments'
          fill='var(--color-shipments)'
          radius={4}
        />
      </BarChart>
    </ChartContainer>
  ),
}
