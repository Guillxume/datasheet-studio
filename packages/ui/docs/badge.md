# Badge

Displays a small label or status indicator.

## Import

```tsx
import { Badge, badgeVariants } from '@guillxume/ui/components/badge'
```

## Props

### Badge

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'secondary' \| 'destructive' \| 'outline' \| 'ghost' \| 'link'` | `'default'` | Visual style variant |
| `asChild` | `boolean` | `false` | Merge props onto child element using Radix Slot |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>
```

### As link

```tsx
<Badge asChild variant="link">
  <a href="/docs">Documentation</a>
</Badge>
```
