# BadgeStatus

A badge with a colored status dot indicator.

## Import

```tsx
import { BadgeStatus, badgeStatusVariants } from '@guillxume/ui/components/badge-status'
```

## Props

### BadgeStatus

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `'green' \| 'blue' \| 'amber' \| 'red'` | — | Status color for the dot indicator |
| `children` | `ReactNode` | — | Badge content |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<BadgeStatus status="green">Active</BadgeStatus>
<BadgeStatus status="blue">Pending</BadgeStatus>
<BadgeStatus status="amber">In Progress</BadgeStatus>
<BadgeStatus status="red">Error</BadgeStatus>
```
