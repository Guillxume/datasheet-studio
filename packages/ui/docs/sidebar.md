# Sidebar

Collapsible application sidebar with responsive mobile sheet, keyboard shortcut, and cookie-based persistence. Built on Radix Slot, Sheet, and Tooltip primitives.

## Import

```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@guillxume/ui/components/sidebar'
```

## Setup

Wrap your layout with `<SidebarProvider>` and place `<Sidebar>` alongside `<SidebarInset>`:

```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarHeader />
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/">Home</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter />
  </Sidebar>
  <SidebarInset>
    <main>{children}</main>
  </SidebarInset>
</SidebarProvider>
```

## Props

### SidebarProvider

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultOpen` | `boolean` | `true` | Initial open state (uncontrolled) |
| `open` | `boolean` | — | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | — | Called when open state changes |

Persists the expanded/collapsed state in a `sidebar_state` cookie (7-day expiry).

### Sidebar

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `side` | `'left' \| 'right'` | `'left'` | Which side the sidebar appears on |
| `variant` | `'sidebar' \| 'floating' \| 'inset'` | `'sidebar'` | Visual style variant |
| `collapsible` | `'offcanvas' \| 'icon' \| 'none'` | `'offcanvas'` | Collapse behavior. `'icon'` shrinks to icon-width; `'none'` disables collapsing |

### SidebarMenuButton

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props onto child element |
| `isActive` | `boolean` | `false` | Highlight as the active item |
| `variant` | `'default' \| 'outline'` | `'default'` | Visual style |
| `size` | `'sm' \| 'default' \| 'lg'` | `'default'` | Button size |
| `tooltip` | `string \| TooltipContentProps` | — | Tooltip shown when the sidebar is collapsed |

### SidebarTrigger

Button that toggles the sidebar. Renders a `PanelLeftIcon` by default. Accepts all `Button` props.

## Hook: `useSidebar`

Returns the sidebar state and controls. Must be called within a `<SidebarProvider>`.

| Property | Type | Description |
|----------|------|-------------|
| `state` | `'expanded' \| 'collapsed'` | Current sidebar state |
| `open` | `boolean` | Whether the sidebar is open |
| `setOpen` | `(open: boolean) => void` | Set open state |
| `openMobile` | `boolean` | Whether the mobile sheet is open |
| `setOpenMobile` | `(open: boolean) => void` | Set mobile sheet state |
| `isMobile` | `boolean` | Whether the viewport is mobile-sized |
| `toggleSidebar` | `() => void` | Toggle open/closed |

## Keyboard shortcut

Press <kbd>Ctrl+B</kbd> (or <kbd>Cmd+B</kbd> on macOS) to toggle the sidebar.

## Responsive behavior

On mobile (< 768px), the sidebar renders as a `Sheet` overlay instead of a persistent panel. The `SidebarTrigger` opens/closes the sheet.

## Examples

### With sub-menus

```tsx
<SidebarMenu>
  <SidebarMenuItem>
    <SidebarMenuButton>Settings</SidebarMenuButton>
    <SidebarMenuSub>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild>
          <a href="/settings/general">General</a>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild>
          <a href="/settings/notifications">Notifications</a>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    </SidebarMenuSub>
  </SidebarMenuItem>
</SidebarMenu>
```

### With menu badges

```tsx
<SidebarMenuItem>
  <SidebarMenuButton>Inbox</SidebarMenuButton>
  <SidebarMenuBadge>24</SidebarMenuBadge>
</SidebarMenuItem>
```

### With skeleton loading

```tsx
<SidebarMenu>
  {Array.from({ length: 5 }).map((_, i) => (
    <SidebarMenuItem key={i}>
      <SidebarMenuSkeleton showIcon />
    </SidebarMenuItem>
  ))}
</SidebarMenu>
```
