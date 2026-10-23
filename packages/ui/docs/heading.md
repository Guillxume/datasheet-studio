# Heading

A polymorphic heading component with configurable semantic level and visual size.

## Import

```tsx
import { Heading, headingVariants } from '@guillxume/ui/components/heading'
```

## Props

### Heading

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'h5' \| 'h6'` | `'h2'` | HTML heading level |
| `size` | `'4xl' \| '3xl' \| '2xl' \| 'xl' \| 'lg' \| 'base'` | `'3xl'` | Visual text size |
| `asChild` | `boolean` | `false` | Merge props onto child element using Radix Slot |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<Heading as="h1" size="4xl">Page Title</Heading>
<Heading as="h2" size="2xl">Section Title</Heading>
<Heading as="h3" size="xl">Subsection</Heading>
```

### Decoupled level and size

```tsx
<Heading as="h2" size="base">
  Visually small but semantically h2
</Heading>
```
