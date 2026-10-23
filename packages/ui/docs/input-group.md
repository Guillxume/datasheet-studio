# InputGroup

Groups an input with addons, icons, text, or buttons into a single visual unit.

## Import

```tsx
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from '@guillxume/ui/components/input-group'
```

## Props

### InputGroup

Standard `div` props. Provides shared border, rounded corners, and focus-within ring styling.

### InputGroupAddon

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `align` | `'inline-start' \| 'inline-end' \| 'block-start' \| 'block-end'` | `'inline-start'` | Position of the addon relative to the input |

### InputGroupButton

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | Button type attribute |
| `variant` | `ButtonVariant` | `'ghost'` | Button variant |
| `size` | `'xs' \| 'sm' \| 'icon-xs' \| 'icon-sm'` | `'xs'` | Button size |

### InputGroupText

Standard `span` props. Renders inline text or icons within an addon.

### InputGroupInput

Standard `input` props. Wraps `Input` with border/shadow/ring reset.

### InputGroupTextarea

Standard `textarea` props. Wraps `Textarea` with border/shadow/ring reset and `resize-none`.

## Examples

### With leading icon

```tsx
<InputGroup>
  <InputGroupAddon>
    <InputGroupText><Search className="size-4" /></InputGroupText>
  </InputGroupAddon>
  <InputGroupInput placeholder="Search..." />
</InputGroup>
```

### With text prefix

```tsx
<InputGroup>
  <InputGroupAddon>
    <InputGroupText>https://</InputGroupText>
  </InputGroupAddon>
  <InputGroupInput placeholder="example.com" />
</InputGroup>
```

### With trailing button

```tsx
<InputGroup>
  <InputGroupInput placeholder="Enter email" />
  <InputGroupAddon align="inline-end">
    <InputGroupButton>Subscribe</InputGroupButton>
  </InputGroupAddon>
</InputGroup>
```
