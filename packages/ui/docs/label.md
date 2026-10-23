# Label

A text label for form controls.

## Import

```tsx
import { Label } from '@guillxume/ui/components/label'
```

## Props

### Label

Radix UI `Label` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `htmlFor` | `string` | — | ID of the associated form control |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />
```
