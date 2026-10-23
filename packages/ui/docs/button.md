# Button

An interactive element for triggering actions.

## Import

```tsx
import { Button, buttonVariants } from '@guillxume/ui/components/button'
```

## Props

### Button

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'solid' \| 'outline' \| 'ghost' \| 'link'` | `'solid'` | Visual chrome (shape/border style) |
| `color` | `'default' \| 'secondary' \| 'destructive'` | `'default'` | Semantic color |
| `size` | `'default' \| 'sm' \| 'lg' \| 'icon' \| 'icon-sm'` | `'default'` | Button size. When using an icon-only size (`'icon'` or `'icon-sm'`), provide `aria-label` |
| `asChild` | `boolean` | `false` | Merge props onto child element using Radix Slot |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Variants

```tsx
<Button>Solid (default)</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
```

### Colors

```tsx
<Button>Default</Button>
<Button color="secondary">Secondary</Button>
<Button color="destructive">Destructive</Button>
```

### Variant + Color combinations

```tsx
<Button variant="outline" color="destructive">Cancel</Button>
<Button variant="ghost" color="destructive">Delete</Button>
```

### Sizes

```tsx
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon" aria-label="Settings">
  <SettingsIcon />
</Button>
```

### As link

```tsx
<Button asChild>
  <a href="/dashboard">Go to dashboard</a>
</Button>
```
