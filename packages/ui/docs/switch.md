# Switch

A toggle control for binary on/off states.

## Import

```tsx
import { Switch } from '@guillxume/ui/components/switch'
```

## Props

### Switch

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Switch size |
| `checked` | `boolean` | — | Controlled checked state |
| `defaultChecked` | `boolean` | — | Uncontrolled initial checked state |
| `onCheckedChange` | `(checked: boolean) => void` | — | Called when the checked state changes |
| `disabled` | `boolean` | `false` | Disable the switch |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<div className="flex items-center gap-2">
  <Switch id="notifications" />
  <Label htmlFor="notifications">Enable notifications</Label>
</div>
```

### Controlled

```tsx
const [enabled, setEnabled] = useState(false)

<Switch checked={enabled} onCheckedChange={setEnabled} />
```
