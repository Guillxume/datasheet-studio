# DropdownMenu

A menu that appears on trigger click, supporting items, checkboxes, radio groups, and sub-menus.

## Import

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@guillxume/ui/components/dropdown-menu'
```

## Props

### DropdownMenuContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sideOffset` | `number` | `4` | Distance from the trigger |
| `className` | `string` | — | Additional CSS classes |

### DropdownMenuItem

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `inset` | `boolean` | — | Add left padding for alignment with items that have icons |
| `variant` | `'default' \| 'destructive'` | `'default'` | Visual style variant |

### DropdownMenuLabel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `inset` | `boolean` | — | Add left padding |

### DropdownMenuSubTrigger

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `inset` | `boolean` | — | Add left padding |

## Examples

### Basic

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">Log out</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### With icons and shortcuts

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <DropdownMenuItem>
        <User />
        Profile
        <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Settings />
        Settings
        <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">
      <LogOut />
      Log out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### With sub-menus

Use `DropdownMenuSub`, `DropdownMenuSubTrigger`, and `DropdownMenuSubContent` to create nested menus:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuGroup>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <UserPlusIcon />
          Invite users
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          <DropdownMenuItem>
            <MailIcon />
            Email
          </DropdownMenuItem>
          <DropdownMenuItem>
            <MessageSquareIcon />
            Message
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <PlusCircleIcon />
            More...
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <CloudIcon />
          Integrations
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          <DropdownMenuItem>
            <GithubIcon />
            GitHub
          </DropdownMenuItem>
          <DropdownMenuItem>
            <MailIcon />
            Gmail
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>
```
