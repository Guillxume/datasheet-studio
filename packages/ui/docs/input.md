# Input

A standard text input field.

## Import

```tsx
import { Input } from '@guillxume/ui/components/input'
```

## Props

### Input

Standard HTML `input` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `string` | — | Input type (text, email, password, etc.) |
| `placeholder` | `string` | — | Placeholder text |
| `disabled` | `boolean` | `false` | Disable the input |
| `characterLimit` | `number` | — | Show remaining character count and enforce max length |
| `numberStepper` | `boolean` | `false` | Add +/- stepper buttons (forces `type="number"`) |
| `mask` | `string \| string[]` | — | Mask pattern (`9` = digit, `a` = letter, `*` = any) or alias (e.g. `"currency"`) |
| `maskOptions` | `MaskOptions` | — | Options passed to `withMask` (e.g. `prefix`, `digits`, `rightAlign`) |
| `labels` | `object` | — | Custom labels for i18n (see below) |
| `className` | `string` | — | Additional CSS classes |

#### Labels

| Key | Default | Description |
|-----|---------|-------------|
| `decrease` | `'Decrease'` | Aria-label for the number stepper minus button |
| `increase` | `'Increase'` | Aria-label for the number stepper plus button |
| `warning` | `'Warning:'` | Prefix shown when near the character limit |
| `charactersRemaining` | `'characters remaining'` | Suffix for the character count |

## Constraints

- **`numberStepper` and `mask` are mutually exclusive.** Using both at the same time throws a runtime error. `mask` replaces the internal ref that `numberStepper` relies on for `stepUp()`/`stepDown()`.

## Examples

### Basic

```tsx
<Input type="email" placeholder="email@example.com" />
```

### With character limit

```tsx
<Input characterLimit={50} placeholder="Enter a title" />
```

### Number stepper

```tsx
<Input numberStepper defaultValue={1} min={0} max={10} />
```

### With label

```tsx
<div className="space-y-2">
  <Label htmlFor="name">Name</Label>
  <Input id="name" placeholder="Your name" />
</div>
```

### Disabled

```tsx
<Input disabled placeholder="Disabled input" />
```

### Masked input

Mask characters: `9` = digit, `a` = letter, `*` = alphanumeric, `[...]` = optional segment.

```tsx
{/* Phone number */}
<Input mask="(99) 99999-9999" placeholder="(00) 00000-0000" />

{/* Date */}
<Input mask="99/99/9999" placeholder="DD/MM/YYYY" />

{/* Credit card */}
<Input mask="9999 9999 9999 9999" placeholder="0000 0000 0000 0000" />

{/* Currency alias */}
<Input
  mask="currency"
  maskOptions={{ prefix: '$ ', digits: 2, rightAlign: false }}
  placeholder="$ 0.00"
/>
```
