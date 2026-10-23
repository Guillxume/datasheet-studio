# Toggle Group

A set of two-state buttons where only one (or multiple) can be active, built on [Radix Toggle Group](https://www.radix-ui.com/primitives/docs/components/toggle-group).

## Import

```tsx
import { ToggleGroup, ToggleGroupItem } from '@guillxume/ui/components/toggle-group'
```

## Props

### ToggleGroup

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'single' \| 'multiple'` | **required** | Whether one or multiple items can be active |
| `value` | `string \| string[]` | — | Controlled value(s) |
| `onValueChange` | `(value: string \| string[]) => void` | — | Callback when value changes |
| `variant` | `'default' \| 'outline'` | `'default'` | Visual style for all items |
| `size` | `'default' \| 'sm' \| 'lg'` | `'default'` | Size for all items |
| `spacing` | `number` | `0` | Gap between items. `0` renders items flush (connected). Any other value adds spacing and separates borders. |
| `className` | `string` | — | Additional CSS classes |

### ToggleGroupItem

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | **required** | Value of this item |
| `variant` | `'default' \| 'outline'` | inherited | Overrides group variant for this item |
| `size` | `'default' \| 'sm' \| 'lg'` | inherited | Overrides group size for this item |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Single selection

```tsx
<ToggleGroup type="single" value="center" onValueChange={setValue}>
  <ToggleGroupItem value="left" aria-label="Align left">
    <AlignLeftIcon className="size-4" />
  </ToggleGroupItem>
  <ToggleGroupItem value="center" aria-label="Align center">
    <AlignCenterIcon className="size-4" />
  </ToggleGroupItem>
  <ToggleGroupItem value="right" aria-label="Align right">
    <AlignRightIcon className="size-4" />
  </ToggleGroupItem>
</ToggleGroup>
```

### Outline variant

```tsx
<ToggleGroup type="single" variant="outline">
  <ToggleGroupItem value="a">A</ToggleGroupItem>
  <ToggleGroupItem value="b">B</ToggleGroupItem>
</ToggleGroup>
```

### With spacing

```tsx
<ToggleGroup type="single" spacing={2}>
  <ToggleGroupItem value="a">A</ToggleGroupItem>
  <ToggleGroupItem value="b">B</ToggleGroupItem>
</ToggleGroup>
```

## Context

`ToggleGroup` provides `variant`, `size`, and `spacing` to its children via React context. `ToggleGroupItem` reads these values automatically — you only need to set them on the group root.
