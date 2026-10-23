# Drawer

A bottom sheet that slides up from the bottom of the screen. Built on top of `vaul`.

## Import

```tsx
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerNested,
} from '@guillxume/ui/components/drawer'
```

## Props

### Drawer

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `shouldScaleBackground` | `boolean` | auto | Scale the background when the drawer opens. Defaults to `true`, `false` when `snapPoints` are provided |
| `noScrollLock` | `boolean` | auto | Disable scroll locking. Defaults to `true` when `snapPoints` are provided |
| `modal` | `boolean` | auto | Whether the drawer is modal. Defaults to `true`, `false` when scroll lock is disabled |
| `autoFocus` | `boolean` | auto | Move focus into the drawer on open. Defaults to `true`, `false` when `snapPoints` are provided |
| `snapPoints` | `number[]` | — | Snap points as fractions (e.g., `[0.15, 0.3, 0.8]`) |
| `activeSnapPoint` | `number \| string \| null` | — | Controlled active snap point |
| `setActiveSnapPoint` | `(snap: number \| string \| null) => void` | — | Called when the active snap point changes |

### DrawerContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showCloseButton` | `boolean` | `true` | Show a close button in the top-right corner. The button is only visible when focused (keyboard users) |
| `className` | `string` | — | Additional CSS classes |

## Examples

### Basic

```tsx
<Drawer>
  <DrawerTrigger asChild>
    <Button variant="outline">Open drawer</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Edit profile</DrawerTitle>
      <DrawerDescription>Make changes to your profile.</DrawerDescription>
    </DrawerHeader>
    <div className="p-4">Content here</div>
    <DrawerFooter>
      <Button>Save</Button>
      <DrawerClose asChild>
        <Button variant="outline">Cancel</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

### Snap points

```tsx
const snapPoints = [0.15, 0.3, 0.8]
const [snap, setSnap] = useState<number | string | null>(snapPoints[0])

<Drawer snapPoints={snapPoints} activeSnapPoint={snap} setActiveSnapPoint={setSnap}>
  <DrawerTrigger asChild>
    <Button variant="outline">Snap points</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Snap points</DrawerTitle>
    </DrawerHeader>
    <div className="flex-1 overflow-y-auto p-4">
      <p>Current: {snap}</p>
    </div>
  </DrawerContent>
</Drawer>
```

### Nested

```tsx
<Drawer>
  <DrawerTrigger asChild>
    <Button variant="outline">Open</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Parent drawer</DrawerTitle>
    </DrawerHeader>
    <div className="p-4">
      <DrawerNested>
        <DrawerTrigger asChild>
          <Button variant="outline">Open nested</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Nested drawer</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </DrawerNested>
    </div>
  </DrawerContent>
</Drawer>
```
