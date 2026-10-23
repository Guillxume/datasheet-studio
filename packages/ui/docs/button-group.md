# ButtonGroup

Groups multiple buttons together with connected borders and shared styling.

## Import

```tsx
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
} from '@guillxume/ui/components/button-group'
```

## Props

### ButtonGroup

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Visually hidden label for screen readers (renders as sr-only `<legend>`) |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction |
| `className` | `string` | — | Additional CSS classes |

### ButtonGroupSeparator

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `'horizontal' \| 'vertical'` | `'vertical'` | Separator direction |

### ButtonGroupText

Standard `div` props. Displays inline text within the group.

## Examples

### Horizontal

```tsx
<ButtonGroup label="Position">
  <Button variant="outline">Left</Button>
  <Button variant="outline">Center</Button>
  <Button variant="outline">Right</Button>
</ButtonGroup>
```

### Vertical

```tsx
<ButtonGroup label="Position" orientation="vertical">
  <Button variant="outline">Top</Button>
  <Button variant="outline">Middle</Button>
  <Button variant="outline">Bottom</Button>
</ButtonGroup>
```

### Split button

```tsx
<ButtonGroup>
  <Button variant="outline">Save</Button>
  <ButtonGroupSeparator />
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="icon" aria-label="More options">
        <ChevronDown />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>Save as draft</DropdownMenuItem>
      <DropdownMenuItem>Save as template</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</ButtonGroup>
```

### With text label

```tsx
<ButtonGroup>
  <ButtonGroupText>Sort by:</ButtonGroupText>
  <Button variant="outline">Name</Button>
  <Button variant="outline">Date</Button>
</ButtonGroup>
```
