# Logo

Generic logo mark as a React component: a sheet with a folded corner and three text lines. Exports path data and viewBox constants for reuse in OG images and favicons.

## Import

```tsx
import { Logo, logoVariants } from '@guillxume/ui/components/logo'

// For custom SVG rendering (e.g. OG images)
import { LOGO_PATHS, LOGO_VIEWBOX, LOGO_SQUARE_VIEWBOX } from '@guillxume/ui/components/logo'

// Types
import type { LogoProps } from '@guillxume/ui/components/logo'
```

## Props

### Logo

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'default' \| 'lg' \| 'xl'` | `'default'` | Logo size (32/48/64/96px) |
| `mono` | `boolean` | `false` | Render every fill as `currentColor`, so the color follows CSS `text-*` classes |
| `label` | `string` | — | Accessible label. When provided, the logo is exposed as `role="img"` with `aria-label`. When omitted, the logo is `aria-hidden`. |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Sizes

```tsx
<Logo size="sm" />
<Logo />
<Logo size="lg" />
<Logo size="xl" />
```

### Mono

```tsx
<Logo mono className="text-primary" />
```

### Decorative (next to text)

When the logo appears alongside visible text, omit `label` to keep it decorative:

```tsx
<header className="flex items-center gap-3">
  <Logo size="sm" />
  <span className="text-lg font-semibold">Datasheet Studio</span>
</header>
```

### Standalone

When the logo is the only content (e.g. a link), provide `label`:

```tsx
<a href="/">
  <Logo label="Datasheet Studio home" />
</a>
```

## Exported constants

| Export | Type | Description |
|--------|------|-------------|
| `LOGO_PATHS` | `ReadonlyArray<{ d: string; fill: string }>` | SVG path data for rendering the logo outside React (e.g. OG images) |
| `LOGO_VIEWBOX` | `string` | viewBox of the mark (`'0 0 48 48'`) |
| `LOGO_SQUARE_VIEWBOX` | `string` | Padded square viewBox (`'-4 -4 56 56'`) — for icons and favicons |
