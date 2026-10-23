# Command

A command palette for searching and selecting actions. Built on top of `cmdk`.

## Import

```tsx
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@guillxume/ui/components/command'
```

## Props

### CommandDialog

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `'Command Palette'` | Dialog title for accessibility |
| `description` | `string` | `'Search for a command to run...'` | Dialog description for accessibility |
| `showCloseButton` | `boolean` | `true` | Show the close button |
| `className` | `string` | — | Additional CSS classes for the command container |

### CommandInput

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | `string` | — | Input placeholder text |

### CommandItem

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSelect` | `(value: string) => void` | — | Called when the item is selected |

## Examples

### Basic

```tsx
<Command>
  <CommandInput placeholder="Type a command..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Suggestions">
      <CommandItem>Calendar</CommandItem>
      <CommandItem>Search</CommandItem>
      <CommandItem>Settings</CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

### Dialog

```tsx
const [open, setOpen] = useState(false)

<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search..." />
  <CommandList>
    <CommandGroup heading="Actions">
      <CommandItem>
        New file
        <CommandShortcut>Ctrl+N</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```
