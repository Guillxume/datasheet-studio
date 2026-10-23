# OgImage

Branded Open Graph image component for use with Next.js `opengraph-image.tsx` route handlers. Renders a 1200×630 card with the package logo and a title.

## Import

```tsx
import { OgImage, OG_IMAGE_SIZE } from '@guillxume/ui/components/og-image'
```

## Props

### OgImage

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** | Text displayed next to the logo |

### OG_IMAGE_SIZE

Exported constant `{ width: 1200, height: 630 }` — pass to the `size` export in your route handler.

## Examples

### Next.js route handler

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { OgImage, OG_IMAGE_SIZE } from '@guillxume/ui/components/og-image'

export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(<OgImage title="Datasheet Studio" />, size)
}
```

### Per-page OG image

```tsx
// app/orders/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { OgImage, OG_IMAGE_SIZE } from '@guillxume/ui/components/og-image'

export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(<OgImage title="Orders" />, size)
}
```
