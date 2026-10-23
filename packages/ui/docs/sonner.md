# Toaster (Sonner)

Toast notifications powered by `sonner`. Add `<Toaster />` to your layout and use the `toast()` function to trigger notifications.

## Import

```tsx
import { Toaster } from '@guillxume/ui/components/sonner'
import { toast } from 'sonner'
```

## Props

### Toaster

Preconfigured with sensible defaults. All `sonner` `ToasterProps` are accepted.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `string` | `'top-right'` | Toast position |
| `richColors` | `boolean` | `true` | Enable rich color variants |
| `closeButton` | `boolean` | `true` | Show close button on toasts |
| `duration` | `number` | `5000` | Auto-dismiss duration in ms |

## Examples

### Setup

```tsx
// In your root layout
<Toaster />
```

### Usage

```tsx
toast.success('Changes saved')
toast.error('Something went wrong')
toast.warning('Check your input')
toast.info('New update available')
toast.loading('Processing...')
```
