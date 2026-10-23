# Empty

Placeholder for a page, list or panel with nothing to show yet: an icon, a title, a short explanation and an optional action.

## Import

```tsx
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@guillxume/ui/components/empty'
```

## Props

All parts accept the props of a `div` plus `className`.

### EmptyMedia

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'icon'` | `'default'` | `icon` puts the icon on a muted square tile |

## Structure

| Part | Role |
|------|------|
| `Empty` | Centred, dashed-border-ready container (add `border` to show it) |
| `EmptyHeader` | Groups media, title and description |
| `EmptyMedia` | Icon or illustration |
| `EmptyTitle` | One-line title |
| `EmptyDescription` | Muted explanation; links inside are underlined |
| `EmptyContent` | Actions (buttons, search field…) |

## Examples

### Basic

```tsx
import { Icon } from '@guillxume/ui/components/icon'
import { Button } from '@guillxume/ui/components/button'
import { PackageIcon } from 'lucide-react'

<Empty className='border'>
  <EmptyHeader>
    <EmptyMedia variant='icon'>
      <Icon icon={PackageIcon} />
    </EmptyMedia>
    <EmptyTitle>No products yet</EmptyTitle>
    <EmptyDescription>
      Create your first product to start filling the catalogue.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>Create a product</Button>
  </EmptyContent>
</Empty>
```

The labels are plain children: pass your own translated strings.
