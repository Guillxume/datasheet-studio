# Avatar

An image element with a fallback for displaying user profiles.

## Import

```tsx
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from '@guillxume/ui/components/avatar'
```

## Props

### Avatar

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'default' \| 'sm' \| 'lg'` | `'default'` | Avatar size |
| `className` | `string` | — | Additional CSS classes |

### AvatarImage

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | — | Image source URL |
| `alt` | `string` | **required** | Alt text describing the person or content shown |

### AvatarFallback

Radix UI `Avatar.Fallback` props. Renders when the image fails to load.

### AvatarBadge

Standard `span` props. Positioned absolutely in the bottom-right corner.

### AvatarGroup

Standard `div` props. Flex container for stacking avatars with negative spacing. Rendered with `role="group"`. Provide `aria-label` to describe the group to assistive technology.

### AvatarGroupCount

Standard `div` props. Displays a count for remaining avatars.

## Examples

### Basic

```tsx
<Avatar>
  <AvatarImage src="/avatar.jpg" alt="User" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
```

### Group

```tsx
<AvatarGroup aria-label="Team members">
  <Avatar>
    <AvatarImage src="/user1.jpg" alt="User 1" />
    <AvatarFallback>U1</AvatarFallback>
  </Avatar>
  <Avatar>
    <AvatarImage src="/user2.jpg" alt="User 2" />
    <AvatarFallback>U2</AvatarFallback>
  </Avatar>
  <AvatarGroupCount>+3</AvatarGroupCount>
</AvatarGroup>
```
