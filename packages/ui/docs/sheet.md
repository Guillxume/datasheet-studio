# Sheet

A panel that slides in from the side of the screen.

## Import

```tsx
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@guillxume/ui/components/sheet'
```

## Props

### Sheet

Radix UI `Dialog.Root` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the open state changes |

### SheetContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `side` | `'right' \| 'left'` | `'right'` | Which side the sheet slides in from |
| `showCloseButton` | `boolean` | `true` | Show the X close button |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Open sheet</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Edit profile</SheetTitle>
      <SheetDescription>Make changes to your profile.</SheetDescription>
    </SheetHeader>
    <div className="py-4">
      <Input placeholder="Name" />
    </div>
    <SheetFooter>
      <Button>Save changes</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### Left side

```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Open left</Button>
  </SheetTrigger>
  <SheetContent side="left">
    <SheetHeader>
      <SheetTitle>Navigation</SheetTitle>
    </SheetHeader>
  </SheetContent>
</Sheet>
```
