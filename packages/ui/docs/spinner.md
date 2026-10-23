# Spinner

A circular loading indicator.

## Import

```tsx
import { Spinner, spinnerVariants } from '@guillxume/ui/components/spinner'
```

## Props

### Spinner

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'default' \| 'lg'` | `'default'` | Spinner size |
| `label` | `string` | — | Screen reader announcement. When provided, wraps the spinner in an `<output>` live region with sr-only text. |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<Spinner />
<Spinner size="sm" />
<Spinner size="lg" />
```

### With screen reader label

Use `label` when the spinner is the only indicator that something is loading:

```tsx
<Spinner label="Loading orders..." />
```

### Reduced motion

The spin animation is automatically disabled when the user prefers reduced motion (`prefers-reduced-motion: reduce`). No additional configuration needed.

### In button

When used inside a button with visible text, omit `label` to avoid duplicate announcements:

```tsx
<Button disabled>
  <Spinner size="sm" />
  Loading...
</Button>
```
