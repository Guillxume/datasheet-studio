# Text

A polymorphic text component with color, size, and weight variants.

## Import

```tsx
import { Text, textVariants } from '@guillxume/ui/components/text'
```

## Props

### Text

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | `'p' \| 'span' \| 'div' \| 'label' \| 'em' \| 'strong'` | `'p'` | HTML element to render |
| `variant` | `'default' \| 'muted' \| 'accent' \| 'destructive'` | `'default'` | Color variant |
| `size` | `'xs' \| 'sm' \| 'base' \| 'lg' \| 'xl'` | `'base'` | Text size |
| `weight` | `'normal' \| 'medium' \| 'semibold' \| 'bold'` | `'normal'` | Font weight |
| `asChild` | `boolean` | `false` | Merge props onto child element using Radix Slot |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Variants

```tsx
<Text>Default text</Text>
<Text variant="muted">Muted text</Text>
<Text variant="accent">Accent text</Text>
<Text variant="destructive">Destructive text</Text>
```

### Sizes and weights

```tsx
<Text size="xs" weight="medium">Extra small medium</Text>
<Text size="lg" weight="bold">Large bold</Text>
```

### As span

```tsx
<Text as="span" variant="muted" size="sm">Inline muted text</Text>
```
