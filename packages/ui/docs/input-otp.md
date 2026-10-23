# InputOTP

A one-time password input with individual digit slots. Built on top of `input-otp`.

## Import

```tsx
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@guillxume/ui/components/input-otp'
```

## Props

### InputOTP

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxLength` | `number` | — | Total number of digits |
| `value` | `string` | — | Controlled value |
| `onChange` | `(value: string) => void` | — | Called when the value changes |
| `onComplete` | `(value: string) => void` | — | Called when all digits are filled |
| `containerClassName` | `string` | — | CSS classes for the outer container |

### InputOTPSlot

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `index` | `number` | — | Zero-based slot index (required) |
| `className` | `string` | — | Additional CSS classes |

### InputOTPGroup

Standard `div` props. Flex container for grouping slots.

### InputOTPSeparator

Standard `div` props. Renders a dash icon between groups.

## Examples

### 6-digit with separator

```tsx
<InputOTP maxLength={6}>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
  </InputOTPGroup>
  <InputOTPSeparator />
  <InputOTPGroup>
    <InputOTPSlot index={3} />
    <InputOTPSlot index={4} />
    <InputOTPSlot index={5} />
  </InputOTPGroup>
</InputOTP>
```

### 4-digit without separator

```tsx
<InputOTP maxLength={4}>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
    <InputOTPSlot index={3} />
  </InputOTPGroup>
</InputOTP>
```

### With onComplete callback

Use `onComplete` to trigger an action (e.g. form submission or verification) as soon as all digits are filled.

```tsx
<InputOTP
  maxLength={6}
  onComplete={(value) => {
    console.log('OTP entered:', value)
    // submit the form, verify the code, etc.
  }}
>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
  </InputOTPGroup>
  <InputOTPSeparator />
  <InputOTPGroup>
    <InputOTPSlot index={3} />
    <InputOTPSlot index={4} />
    <InputOTPSlot index={5} />
  </InputOTPGroup>
</InputOTP>
```
