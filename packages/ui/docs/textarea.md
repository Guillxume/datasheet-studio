# Textarea

A multi-line text input field with auto-sizing.

## Import

```tsx
import { Textarea } from '@guillxume/ui/components/textarea'
```

## Props

### Textarea

Standard HTML `textarea` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | `string` | — | Placeholder text |
| `disabled` | `boolean` | `false` | Disable the textarea |
| `characterLimit` | `number` | — | Show remaining character count and enforce max length |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<Textarea placeholder="Type your message here." />
```

### With character limit

```tsx
<Textarea characterLimit={200} placeholder="Write a description..." />
```

### With label

```tsx
<div className="space-y-2">
  <Label htmlFor="message">Message</Label>
  <Textarea id="message" placeholder="Your message" />
</div>
```
