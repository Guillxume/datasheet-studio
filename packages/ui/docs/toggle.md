# Toggle

A two-state button that can be switched on or off, built on [Radix Toggle](https://www.radix-ui.com/primitives/docs/components/toggle).

## Import

```tsx
import { Toggle, toggleVariants } from '@guillxume/ui/components/toggle'
```

## Props

### Toggle

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'outline'` | `'default'` | Visual style variant |
| `size` | `'default' \| 'sm' \| 'lg'` | `'default'` | Toggle size |
| `pressed` | `boolean` | — | Controlled pressed state |
| `onPressedChange` | `(pressed: boolean) => void` | — | Callback when pressed state changes |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Variants

```tsx
<Toggle>Default</Toggle>
<Toggle variant="outline">Outline</Toggle>
```

### Sizes

```tsx
<Toggle size="sm">Small</Toggle>
<Toggle size="default">Default</Toggle>
<Toggle size="lg">Large</Toggle>
```

### With icon

```tsx
<Toggle aria-label="Toggle italic">
  <ItalicIcon className="size-4" />
</Toggle>
```

## CVA Variants

`toggleVariants` is exported for reuse in composite components like `ToggleGroup`. It uses `class-variance-authority` and accepts `{ variant, size }`.
