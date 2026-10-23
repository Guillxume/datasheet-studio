# Icon

A wrapper for Lucide icons with consistent sizing and color variants.

## Convention

Apps always render icons with `Icon` — never Lucide components directly as JSX (e.g., `<SomeIcon />`). Import icons from `lucide-react` for references, then render via `<Icon icon={SomeIcon} />`.

The icon you pass comes from the app's own `lucide-react`, so the app must install **exactly** the version the package pins (`0.563.0`), not a range: another version draws some icons differently, and the app would no longer match the other tools.

```sh
pnpm add lucide-react@0.563.0 --save-exact
```

## Import

```tsx
import { Icon, iconVariants } from '@guillxume/ui/components/icon'
```

## Props

### Icon

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `LucideIcon` | — | The Lucide icon component to render |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Icon size |
| `variant` | `'default' \| 'muted' \| 'accent' \| 'destructive' \| 'primary'` | `'default'` | Color variant |
| `className` | `string` | — | Additional CSS classes |

## Accessibility

The `Icon` component renders with `aria-hidden="true"` by default since icons are typically decorative. If an icon is the only content of an interactive element, provide an accessible label on the parent instead:

```tsx
<button aria-label="Settings">
  <Icon icon={Settings} />
</button>
```

## Examples

### Basic

```tsx
import { Settings, AlertCircle, Check } from 'lucide-react'

<Icon icon={Settings} />
<Icon icon={AlertCircle} variant="destructive" size="lg" />
<Icon icon={Check} variant="primary" size="sm" />
```
