# Skeleton

A placeholder loading animation for content that hasn't loaded yet.

## Import

```tsx
import { Skeleton } from '@guillxume/ui/components/skeleton'
```

## Props

### Skeleton

Standard `div` props. Applies a pulse animation with a muted background. Rendered with `aria-hidden="true"` by default since skeletons are visual placeholders. The pulse animation is automatically disabled when the user prefers reduced motion. Add `aria-busy="true"` to the parent container to communicate loading state to assistive technology.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | — | Additional CSS classes (use to set dimensions) |

## Examples

### Basic

```tsx
<Skeleton className="h-4 w-[250px]" />
```

### Card placeholder

```tsx
<div className="flex items-center gap-4">
  <Skeleton className="size-12 rounded-full" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[200px]" />
    <Skeleton className="h-4 w-[150px]" />
  </div>
</div>
```
