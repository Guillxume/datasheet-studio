# Card

A container for grouping related content and actions.

## Import

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@guillxume/ui/components/card'
```

## Props

All card sub-components accept standard `div` props (`className`, `children`, etc.).

### CardTitle

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'h5' \| 'h6' \| 'div'` | `'div'` | HTML element to render. Use a heading level for proper document structure. |

## Examples

### Basic

```tsx
<Card>
  <CardHeader>
    <CardTitle as="h3">Card Title</CardTitle>
    <CardDescription>Card description text.</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here.</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### With action

```tsx
<Card>
  <CardHeader>
    <CardTitle>Notifications</CardTitle>
    <CardAction>
      <Button variant="outline" size="sm">View all</Button>
    </CardAction>
  </CardHeader>
  <CardContent>
    <p>You have 3 unread messages.</p>
  </CardContent>
</Card>
```
