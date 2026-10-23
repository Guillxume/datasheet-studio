# RadioGroup

A set of mutually exclusive radio options.

## Import

```tsx
import { RadioGroup, RadioGroupItem } from '@guillxume/ui/components/radio-group'
```

## Props

### RadioGroup

Radix UI `RadioGroup.Root` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Controlled selected value |
| `defaultValue` | `string` | — | Uncontrolled initial value |
| `onValueChange` | `(value: string) => void` | — | Called when the selection changes |
| `className` | `string` | — | Additional CSS classes |

### RadioGroupItem

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Item value (required) |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<RadioGroup defaultValue="option1">
  <div className="flex items-center gap-2">
    <RadioGroupItem value="option1" id="option1" />
    <Label htmlFor="option1">Option 1</Label>
  </div>
  <div className="flex items-center gap-2">
    <RadioGroupItem value="option2" id="option2" />
    <Label htmlFor="option2">Option 2</Label>
  </div>
</RadioGroup>
```
