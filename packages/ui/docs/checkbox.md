# Checkbox

A control that allows the user to toggle between checked and unchecked states.

## Import

```tsx
import { Checkbox } from '@guillxume/ui/components/checkbox'
```

## Props

### Checkbox

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean \| 'indeterminate'` | — | Controlled checked state |
| `defaultChecked` | `boolean` | — | Uncontrolled initial checked state |
| `onCheckedChange` | `(checked: boolean \| 'indeterminate') => void` | — | Called when the checked state changes |
| `disabled` | `boolean` | `false` | Disable the checkbox |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<div className="flex items-center gap-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms and conditions</Label>
</div>
```

### Controlled

```tsx
const [checked, setChecked] = useState(false)

<Checkbox checked={checked} onCheckedChange={setChecked} />
```
