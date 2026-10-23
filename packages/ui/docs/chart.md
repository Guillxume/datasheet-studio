# Chart

Wrapper components for [Recharts](https://recharts.org/) with theme integration via CSS custom properties.

## Import

```tsx
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@guillxume/ui/components/chart'
```

Recharts primitives are used directly for the actual chart types:

```tsx
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
```

## Props

### ChartContainer

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | `ChartConfig` | — | Chart color/label configuration |
| `children` | `ReactNode` | — | Recharts chart element |

### ChartConfig

```tsx
type ChartConfig = {
  [key: string]: {
    label?: ReactNode
    icon?: ComponentType
  } & (
    | { color?: string }
    | { theme: { light: string; dark: string } }
  )
}
```

### ChartTooltipContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hideLabel` | `boolean` | `false` | Hide the tooltip label |
| `hideIndicator` | `boolean` | `false` | Hide the color indicator |
| `indicator` | `'line' \| 'dot' \| 'dashed'` | `'dot'` | Indicator style |
| `nameKey` | `string` | — | Custom key for the name |
| `labelKey` | `string` | — | Custom key for the label |

### ChartLegendContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hideIcon` | `boolean` | `false` | Hide icons in legend |
| `nameKey` | `string` | — | Custom key for legend item names |

## Examples

### Bar chart

```tsx
const chartConfig = {
  orders: { label: 'Orders', color: 'var(--primary)' },
  revenue: { label: 'Revenue', color: 'var(--accent)' },
} satisfies ChartConfig

const data = [
  { month: 'Jan', orders: 186, revenue: 80 },
  { month: 'Feb', orders: 305, revenue: 200 },
]

<ChartContainer config={chartConfig}>
  <BarChart data={data}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" />
    <ChartTooltip content={<ChartTooltipContent />} />
    <ChartLegend content={<ChartLegendContent />} />
    <Bar dataKey="orders" fill="var(--color-orders)" radius={4} />
    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
  </BarChart>
</ChartContainer>
```

### Theme-aware colors

```tsx
const chartConfig = {
  visitors: {
    label: 'Visitors',
    theme: { light: '#2563eb', dark: '#93c5fd' },
  },
} satisfies ChartConfig
```

## Series colors

Use the theme's `--chart-1` to `--chart-5` (`var(--chart-1)` in a `ChartConfig` `color`) in that order: series 1 always gets `--chart-1`, and a filter that hides a series does not repaint the others. Past five series, group the rest into "Other" or split the chart rather than inventing a color.

In the neutral theme, these colors are a categorical palette validated for colour-vision deficiencies on the light and dark backgrounds. In light mode, `--chart-3` to `--chart-5` are under 3:1 against the background: show a legend (`ChartLegendContent`) or direct labels, so a series is never identified by color alone.
