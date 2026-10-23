# Input Password

A password input with a show/hide toggle button.

## Import

```tsx
import { InputPassword } from '@guillxume/ui/components/input-password'
```

## Props

Standard `input` props (except `type`, which toggles between `password` and `text`).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `labels` | `object` | — | Custom labels for i18n (see below) |

### Labels

| Key | Default | Description |
|-----|---------|-------------|
| `showPassword` | `'Show password'` | Aria-label when the password is hidden |
| `hidePassword` | `'Hide password'` | Aria-label when the password is visible |

## Examples

```tsx
<InputPassword placeholder="Enter your password" />
```
