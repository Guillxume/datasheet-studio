# App shell

The frame shared by internal tools: `AppSidebar`, `AppHeader` and `UserMenu`. The package renders it; the app decides what goes in it.

What stays in the app, on purpose:

- which navigation items the current user may see (roles, auth provider);
- the router: the link component and programmatic navigation;
- translations, passed through `labels`;
- the user's details and the sign-out action.

## Import

```tsx
import { AppHeader } from '@guillxume/ui/components/app-header'
import { AppSidebar, type AppNavItem, type AppSidebarNav } from '@guillxume/ui/components/app-sidebar'
import { UserMenu } from '@guillxume/ui/components/user-menu'
```

## Layout

All three must be rendered inside `SidebarProvider`, and `UserMenu` inside `SettingsProvider` (it reads and saves the theme and locale).

```tsx
<SidebarProvider>
  <AppSidebar /* … */ />
  <SidebarInset>
    <AppHeader actions={<UserMenu /* … */ />} />
    {children}
  </SidebarInset>
</SidebarProvider>
```

## AppSidebar

Collapsible on desktop, with flyout menus when collapsed to icons; drill-down drawer on mobile. Items support two levels below the top one.

```tsx
const nav = useNavItems() // app hook: filters items by role, returns null while the session loads

<AppSidebar
  nav={nav}
  header={<SidebarHeader>{/* logo, app name */}</SidebarHeader>}
  pathname={usePathname()}               // from the app router, without locale
  search={useSearchParams().toString()}
  linkComponent={Link}                   // e.g. next-intl Link
  onMobileNavigate={href => router.push(href)}
  skeleton={{ main: 2, secondary: 0 }}
  labels={{ mainGroup: t('nav.main'), /* … */ }}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `nav` | `{ main: AppNavItem[]; groups?: AppNavGroup[]; secondary: AppNavItem[] } \| null` | Items the user may see. `null` renders skeletons. `groups` are extra titled groups (`{ label, items }`, label already translated) rendered in order after `main`; empty ones are skipped, and on mobile they follow `main` in the drawer. `secondary` is pinned to the bottom. |
| `header` | `ReactNode` | Brand block at the top, usually a `SidebarHeader`. |
| `pathname` | `string` | Current path. A top-level item is active on its page and the pages below it (`/products` on `/products/123`), unless a more specific top-level item also matches. A group is open and active anywhere in its section: on its own page, a page below it (`/orders/123` for `/orders`), or the page of any of its children — its `href` does not have to be a prefix of theirs. |
| `search` | `string` | Current query string without `?`. A sub-item whose `href` has a query matches when the URL contains all of its params. Among sibling sub-items only the most specific match is active: on `/orders?status=to_do`, "To confirm" (`/orders?status=to_do`) rather than "All orders" (`/orders`). |
| `linkComponent` | `ComponentType<{ href, onClick?, className?, children }>` | The app's link component. |
| `onMobileNavigate` | `(href: string) => void` | Navigation from the mobile drawer. |
| `skeleton` | `{ main: number; secondary: number }` | Skeleton rows while `nav` is `null`. Default `{ main: 2, secondary: 0 }`. |
| `labels` | `Partial<…>` | `mainGroup`, `secondaryGroup`, `sidebarTitle`, `sidebarDescription`, `toggleSidebar`, `mobileNavBackToNavigation`, `mobileNavBackToItem(title)`. English defaults. |

`AppNavItem` is `{ title, href, icon, items? }`; each sub-item is `{ title, href, items? }`.

## AppHeader

Sticky bar: sidebar toggle, then the slots.

| Prop | Description |
|------|-------------|
| `leading` | Right after the toggle, before the separator (e.g. a status badge). |
| `children` | After the separator (e.g. a search field). |
| `actions` | At the right end (e.g. `UserMenu`). |
| `labels.toggleSidebar` | Accessible name of the toggle. |

## UserMenu

Language, appearance (light / dark / system), app-specific items, sign out.

| Prop | Description |
|------|-------------|
| `trigger` | Content of the round trigger button (avatar, icon). |
| `user` | `{ name, detail? }` shown at the top, e.g. email and role. Optional. |
| `locales`, `locale` | Languages offered, in display order, and the current one. Omit all three language props in a single-language app: the menu then has no Language entry. |
| `onLocaleChange` | Called after the locale is saved in the settings: navigate to the localized URL here. |
| `children` | App-specific items, rendered after Appearance. Add your own `DropdownMenuSeparator` if needed. |
| `onSignOut` | Called after the global loading indicator starts: sign the user out here. |
| `labels` | `menu`, `language`, `appearance`, `light`, `dark`, `system`, `signOut`. English defaults. |
