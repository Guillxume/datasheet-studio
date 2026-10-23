# Select

A dropdown selection control.

## Import

```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from '@guillxume/ui/components/select'
```

## Props

### Select

Radix UI `Select.Root` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Controlled selected value |
| `defaultValue` | `string` | — | Uncontrolled initial value |
| `onValueChange` | `(value: string) => void` | — | Called when the selection changes |

### SelectTrigger

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'default'` | `'default'` | Trigger size |
| `className` | `string` | — | Additional CSS classes |

### SelectContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `'item-aligned' \| 'popper'` | `'item-aligned'` | Positioning strategy |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | Alignment relative to the trigger |

### SelectItem

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Item value (required) |

## Examples

### Basic

```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select a fruit" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Fruits</SelectLabel>
      <SelectItem value="apple">Apple</SelectItem>
      <SelectItem value="banana">Banana</SelectItem>
      <SelectItem value="orange">Orange</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```
