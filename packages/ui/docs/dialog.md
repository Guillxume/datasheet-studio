# Dialog

A modal window that overlays the main content.

## Import

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@guillxume/ui/components/dialog'
```

## Props

### Dialog

Radix UI `Dialog.Root` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the open state changes |

### DialogContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showCloseButton` | `boolean` | `true` | Show the X close button |
| `className` | `string` | — | Additional CSS classes |

### DialogFooter

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showCloseButton` | `boolean` | `false` | Show a close button in the footer |

## Examples

### Basic

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Edit Profile</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit profile</DialogTitle>
      <DialogDescription>
        Make changes to your profile here.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      <Input placeholder="Name" />
    </div>
    <DialogFooter>
      <Button type="submit">Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
