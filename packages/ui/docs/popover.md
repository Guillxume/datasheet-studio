# Popover

A floating panel that appears on trigger click.

## Import

```tsx
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from '@guillxume/ui/components/popover'
```

## Props

### Popover

Radix UI `Popover.Root` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the open state changes |

### PopoverContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | Alignment relative to the trigger |
| `sideOffset` | `number` | `4` | Distance from the trigger in pixels |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Open popover</Button>
  </PopoverTrigger>
  <PopoverContent>
    <PopoverHeader>
      <PopoverTitle>Dimensions</PopoverTitle>
      <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
    </PopoverHeader>
    <div className="grid gap-2">
      <Input placeholder="Width" />
      <Input placeholder="Height" />
    </div>
  </PopoverContent>
</Popover>
```
