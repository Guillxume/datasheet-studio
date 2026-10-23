# Accordion

A vertically stacked set of interactive headings that each reveal a section of content.

## Import

```tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@guillxume/ui/components/accordion'
```

## Props

### Accordion

Radix UI `Accordion.Root` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'single' \| 'multiple'` | — | Whether one or multiple items can be open at once |
| `collapsible` | `boolean` | `false` | When `type="single"`, allows closing the open item |
| `defaultValue` | `string \| string[]` | — | Uncontrolled initial open item(s) |
| `value` | `string \| string[]` | — | Controlled open item(s) |
| `onValueChange` | `(value: string \| string[]) => void` | — | Called when the open state changes |

### AccordionItem

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Unique identifier for the item |
| `disabled` | `boolean` | `false` | Disable the item |

### AccordionTrigger

Renders a button that toggles its parent `AccordionItem`. Accepts all button props.

### AccordionContent

The content revealed when the item is open. Accepts all div props.

## Examples

### Single collapsible

```tsx
<Accordion type='single' collapsible defaultValue='item-1'>
  <AccordionItem value='item-1'>
    <AccordionTrigger>Section one</AccordionTrigger>
    <AccordionContent>Content for section one.</AccordionContent>
  </AccordionItem>
  <AccordionItem value='item-2'>
    <AccordionTrigger>Section two</AccordionTrigger>
    <AccordionContent>Content for section two.</AccordionContent>
  </AccordionItem>
</Accordion>
```

### Multiple open

```tsx
<Accordion type='multiple' defaultValue={['item-1', 'item-2']}>
  <AccordionItem value='item-1'>
    <AccordionTrigger>First</AccordionTrigger>
    <AccordionContent>First content.</AccordionContent>
  </AccordionItem>
  <AccordionItem value='item-2'>
    <AccordionTrigger>Second</AccordionTrigger>
    <AccordionContent>Second content.</AccordionContent>
  </AccordionItem>
</Accordion>
```
