# Alert

Displays a callout message to attract user attention.

## Import

```tsx
import { Alert, AlertTitle, AlertDescription, AlertAction } from '@guillxume/ui/components/alert'
```

## Props

### Alert

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'destructive' \| 'success' \| 'warning' \| 'info'` | `'default'` | Visual style variant |
| `className` | `string` | — | Additional CSS classes |

The `destructive` and `warning` variants render with `role="alert"`, which interrupts screen readers to announce urgent messages. Other variants render without a role to avoid unnecessary interruptions for informational content.

### AlertTitle

Standard `div` props.

### AlertDescription

Standard `div` props.

### AlertAction

Standard `div` props. Renders in the right-hand column of the alert, vertically centered. Place action buttons (e.g. "Undo", "Dismiss", "Retry") here.

## Examples

### Basic

```tsx
<Alert>
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>You can add components to your app using the CLI.</AlertDescription>
</Alert>
```

### Destructive

```tsx
<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
</Alert>
```

### Success

```tsx
<Alert variant="success">
  <AlertTitle>Saved</AlertTitle>
  <AlertDescription>Your changes have been saved successfully.</AlertDescription>
</Alert>
```

### With action button

```tsx
<Alert>
  <Terminal />
  <AlertTitle>Update available</AlertTitle>
  <AlertDescription>A new version is available.</AlertDescription>
  <AlertAction>
    <Button size="sm" variant="outline">Update</Button>
  </AlertAction>
</Alert>
```

### With multiple actions

```tsx
<Alert variant="warning">
  <TriangleAlertIcon />
  <AlertTitle>Pending approval</AlertTitle>
  <AlertDescription>This order requires manual review.</AlertDescription>
  <AlertAction className="flex gap-2">
    <Button size="sm" variant="outline">Reject</Button>
    <Button size="sm">Approve</Button>
  </AlertAction>
</Alert>
```
