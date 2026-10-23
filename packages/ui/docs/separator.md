# Separator

A visual divider between content sections.

## Import

```tsx
import { Separator } from '@guillxume/ui/components/separator'
```

## Props

### Separator

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Separator direction |
| `decorative` | `boolean` | `true` | Whether it's purely decorative (hides from screen readers) |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Horizontal

```tsx
<Separator />
```

### Vertical

```tsx
<div className="flex h-5 items-center gap-4">
  <span>Item 1</span>
  <Separator orientation="vertical" />
  <span>Item 2</span>
</div>
```
