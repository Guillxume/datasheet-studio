# Progress

A linear or circular progress indicator.

## Import

```tsx
import { Progress, ProgressCircle } from '@guillxume/ui/components/progress'
```

## Props

### Progress

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | — | Progress value (0-100) |
| `className` | `string` | — | Additional CSS classes |

### ProgressCircle

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | `0` | Progress value (0-100) |
| `size` | `'sm' \| 'default' \| 'lg'` | `'default'` | Circle size |
| `children` | `ReactNode` | — | Content displayed in the center |

## Examples

### Linear

```tsx
<Progress value={60} />
```

### Circular

```tsx
<ProgressCircle value={75} />
<ProgressCircle value={50} size="lg">50%</ProgressCircle>
```
