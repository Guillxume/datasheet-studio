# Combobox

Searchable dropdown built on top of Command (cmdk) and Popover. Supports single-select and multi-select with dismissible chips.

## Import

```tsx
import { Combobox, ComboboxMulti, ComboboxChip } from '@guillxume/ui/components/combobox'
```

## Props

### Combobox (single-select)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `ComboboxOption[]` | — | List of selectable options |
| `value` | `string` | — | Currently selected value |
| `onValueChange` | `(value: string) => void` | — | Called when selection changes |
| `placeholder` | `string` | `'Select an option...'` | Trigger button placeholder |
| `searchPlaceholder` | `string` | `'Search...'` | Search input placeholder |
| `emptyMessage` | `string` | `'No results found.'` | Message when no options match |
| `disabled` | `boolean` | `false` | Disable the combobox |
| `className` | `string` | — | Additional classes for the trigger |

### ComboboxMulti

Same props as Combobox, except:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string[]` | `[]` | Currently selected values |
| `onValueChange` | `(value: string[]) => void` | — | Called when selection changes |
| `placeholder` | `string` | `'Select options...'` | Trigger button placeholder |

Selected items are displayed as `ComboboxChip` badges with dismiss buttons. Chips can be removed without opening the dropdown.

### ComboboxChip

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Chip text |
| `disabled` | `boolean` | — | Disable the remove button |
| `onRemove` | `(e: MouseEvent \| KeyboardEvent) => void` | — | Called when dismiss is clicked |

### ComboboxOption

```tsx
type ComboboxOption = {
  value: string
  label: string
  disabled?: boolean
}
```

## Examples

### Single-select

```tsx
const [value, setValue] = React.useState('')

<Combobox
  options={[
    { value: 'acme', label: 'Acme Co.' },
    { value: 'global', label: 'Global Supply' },
    { value: 'quick', label: 'Quick Ship Ltd.' },
  ]}
  value={value}
  onValueChange={setValue}
  placeholder="Select supplier..."
/>
```

### Multi-select with chips

```tsx
const [values, setValues] = React.useState<string[]>([])

<ComboboxMulti
  options={[
    { value: 'pending', label: 'Pending' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
  ]}
  value={values}
  onValueChange={setValues}
  placeholder="Filter by status..."
/>
```
