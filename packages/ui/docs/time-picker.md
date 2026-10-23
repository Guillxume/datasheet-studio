# Time Picker

A time input with a clock icon. Uses the native `<input type="time">` under the hood with browser chrome hidden.

## Import

```tsx
import { TimePicker } from '@guillxume/ui/components/time-picker'
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Controlled value in `HH:mm` or `HH:mm:ss` format |
| `onValueChange` | `(value: string) => void` | — | Called when the time changes |
| `step` | `number` | — | Step in seconds. Use `1` to show a seconds field |
| `disabled` | `boolean` | `false` | Disable the input |
| `className` | `string` | — | CSS classes for the outer container |

Also accepts all native `<input>` props except `type`, `value`, and `onChange`.

## Examples

### Basic

```tsx
const [time, setTime] = React.useState('10:30')

<TimePicker value={time} onValueChange={setTime} />
```

### With seconds

```tsx
<TimePicker value="14:30:00" step={1} onValueChange={setTime} />
```

### Disabled

```tsx
<TimePicker value="09:00" disabled />
```
