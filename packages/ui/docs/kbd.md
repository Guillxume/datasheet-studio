# Kbd

Renders a keyboard key or shortcut with platform-aware modifier symbols.

## Import

```tsx
import { Kbd } from '@guillxume/ui/components/kbd'
```

## Props

### Kbd

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `keyName` | `Key` | — | The keyboard key to display |
| `modifiers` | `('ctrl' \| 'shift' \| 'alt')[]` | — | Modifier keys to prepend |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<Kbd keyName="Enter" />
<Kbd keyName="K" modifiers={['ctrl']} />
<Kbd keyName="S" modifiers={['ctrl', 'shift']} />
```
