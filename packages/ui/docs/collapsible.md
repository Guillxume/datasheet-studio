# Collapsible

An interactive component that expands and collapses a section of content.

## Import

```tsx
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@guillxume/ui/components/collapsible'
```

## Props

### Collapsible

Radix UI `Collapsible.Root` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `defaultOpen` | `boolean` | `false` | Uncontrolled initial open state |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the open state changes |
| `disabled` | `boolean` | `false` | Disable the collapsible |

### CollapsibleTrigger

Renders a button that toggles the collapsible. Accepts all button props.

### CollapsibleContent

The content that is shown or hidden. Accepts all div props.

## Examples

### Basic

```tsx
<Collapsible>
  <CollapsibleTrigger>Toggle</CollapsibleTrigger>
  <CollapsibleContent>
    <p>Collapsible content here.</p>
  </CollapsibleContent>
</Collapsible>
```

### Default open

```tsx
<Collapsible defaultOpen>
  <CollapsibleTrigger>Toggle</CollapsibleTrigger>
  <CollapsibleContent>
    <p>This content is visible by default.</p>
  </CollapsibleContent>
</Collapsible>
```
