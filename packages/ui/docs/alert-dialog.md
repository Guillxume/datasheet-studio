# AlertDialog

A modal dialog that interrupts the user with important content and expects a response.

## Import

```tsx
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogMedia,
  AlertDialogAction,
  AlertDialogCancel,
} from '@guillxume/ui/components/alert-dialog'
```

## Props

### AlertDialog

Radix UI `AlertDialog.Root` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the open state changes |
| `defaultOpen` | `boolean` | `false` | Uncontrolled initial open state |

### AlertDialogContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'default' \| 'sm'` | `'default'` | Dialog size |
| `className` | `string` | — | Additional CSS classes |

### AlertDialogAction

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `ButtonVariant` | `'solid'` | Button variant |
| `color` | `ButtonColor` | `'default'` | Button color |
| `size` | `ButtonSize` | `'default'` | Button size |

### AlertDialogCancel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `ButtonVariant` | `'outline'` | Button variant |
| `color` | `ButtonColor` | `'default'` | Button color |
| `size` | `ButtonSize` | `'default'` | Button size |

### AlertDialogMedia

Standard `div` props. A decorative container for icons or images in the dialog header. Rendered with `aria-hidden="true"` since the title and description already convey meaning.

## Examples

### Basic

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline">Delete account</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Continue</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### With media

```tsx
<AlertDialogContent>
  <AlertDialogMedia>
    <img src="/warning.svg" alt="Warning" />
  </AlertDialogMedia>
  <AlertDialogHeader>
    <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
    <AlertDialogDescription>This is permanent.</AlertDialogDescription>
  </AlertDialogHeader>
  <AlertDialogFooter>
    <AlertDialogCancel>Cancel</AlertDialogCancel>
    <AlertDialogAction color="destructive">Delete</AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>
```
