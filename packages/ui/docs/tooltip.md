# Tooltip

A popup that displays additional information when hovering over an element.

## Import

```tsx
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@guillxume/ui/components/tooltip'
```

## Props

### TooltipProvider

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `delayDuration` | `number` | `0` | Delay before showing tooltip (ms) |

### Tooltip

Radix UI `Tooltip.Root` props.

### TooltipContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sideOffset` | `number` | `0` | Distance from the trigger in pixels |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Settings">
        <SettingsIcon />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Settings</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```
