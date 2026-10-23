# BadgeClosable

A badge with a close button for dismissible tags or filters.

## Import

```tsx
import { BadgeClosable } from '@guillxume/ui/components/badge-closable'
```

## Props

### BadgeClosable

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onClose` | `() => void` | — | Called when the close button is clicked |
| `children` | `ReactNode` | — | Badge content |
| `removeLabel` | `string` | — | Custom `aria-label` for the close button. Defaults to `"Remove {children}"` when children is a string, or `"Remove"` otherwise. |

## Examples

### Basic

```tsx
<BadgeClosable onClose={() => console.log('closed')}>
  Filter tag
</BadgeClosable>
```

### With custom remove label

Use `removeLabel` when children is not a plain string (e.g. contains icons or JSX):

```tsx
<BadgeClosable
  removeLabel="Remove priority filter"
  onClose={() => console.log('closed')}
>
  <PriorityIcon /> High
</BadgeClosable>
```
