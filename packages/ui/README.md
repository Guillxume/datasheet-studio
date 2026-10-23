# @guillxume/ui

A React design system for internal tools, built on [shadcn/ui](https://ui.shadcn.com) (New York style), [Radix UI](https://www.radix-ui.com) and [Tailwind CSS v4](https://tailwindcss.com). It covers the everyday primitives (buttons, forms, overlays, navigation), a full-featured [DataTable](docs/data-table.md) (sorting, faceted/number/date filters, column pinning and reordering, export, bulk actions, URL state, saved layouts), an [application frame](docs/app-shell.md) (sidebar, header, user menu) and swappable themes.

**Live Storybook:** <https://guillxume.github.io/datasheet-studio/>

It is the design system of [Datasheet Studio](../../apps/studio), which lives in the same repository.

## Using it in the workspace

The package is a pnpm workspace package. An app of this repository depends on it with:

```json
{ "dependencies": { "@guillxume/ui": "workspace:*" } }
```

Build it once before starting an app (`pnpm build:ui` at the repository root), or keep `pnpm --filter @guillxume/ui build:watch` running while you work on both.

### Peer dependencies

The app installs `react`, `react-dom`, `nuqs`, `sonner`, `react-hook-form`, `@tanstack/react-table@^9`, and `next` for the components that use `next/navigation`. `sonner`, `react-hook-form` and `@tanstack/react-table` are peers so the app and the package share one copy: the app's `toast()` must reach the package's `<Toaster>`, and the app's forms must reach the package's `Form` context.

### Importing

Every module has its own entry point:

```tsx
import { Button } from '@guillxume/ui/components/button'
import { DataTable } from '@guillxume/ui/components/data-table'
import { cn } from '@guillxume/ui/lib/utils'
import { useSettings } from '@guillxume/ui/hooks/use-settings'
```

`components/_internal/*` and `hooks/__internal__/*` are not exported: they can change at any time.

### Icons

Never render a Lucide icon directly. Import the icon from `lucide-react` and render it through the `Icon` wrapper, which sets the size, stroke and accessibility attributes consistently:

```tsx
import { Plus } from 'lucide-react'
import { Icon } from '@guillxume/ui/components/icon'

<Icon icon={Plus} />
```

`lucide-react` is pinned (0.563.0): apps install the same exact version. See [docs/icon.md](docs/icon.md).

### i18n

The library is locale-agnostic: every interactive component accepts an optional `labels` prop to override its default English strings, so apps pass translated strings from their own i18n setup. See each component's doc for its label keys.

## Themes

Import exactly one theme in the app's global CSS, after Tailwind:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@guillxume/ui/themes/neutral.css";
```

| Theme | For |
|-------|-----|
| `themes/neutral.css` | Default, for tools without a brand of their own (shadcn/ui "neutral" colors) |
| `themes/datasheet-studio.css` | Datasheet Studio: warm paper, ink and terracotta, square corners (the app declares the IBM Plex Sans `@font-face`) |

Each theme imports `styles/base.css` (Tailwind token mapping, animations, base styles; it also tells Tailwind where the package's classes are) and declares only the `:root` and `.dark` variables. A `.light` class forces light mode on part of a dark page (a preview of a printed sheet, an email…).

A tool with its own brand imports `styles/base.css` and declares those variables itself, using a theme file as the list of tokens to define. Every theme defines the same set of tokens; `pnpm check:contrast` checks each one against WCAG 2 AA in light and dark.

## How it is built

[tsdown](https://tsdown.dev) builds `dist/`: one ES module per source module, so each `'use client'` boundary stays where it is, plus `.d.ts` files with declaration maps. `src/` ships too: "go to definition" opens the source, and Tailwind scans the classes there. Apps import the package like any other: no `transpilePackages`, no `@source` line.

`Drawer` scales the page behind it when the app wraps its content in `data-vaul-drawer-wrapper=""`. The workspace patches `vaul@1.1.2` to soften that effect (`patches/vaul@1.1.2.patch`, declared in the root `pnpm-workspace.yaml`); the package pins `vaul` to exactly `1.1.2` so the patch keeps applying.

## Development

```bash
pnpm dev               # Storybook on http://localhost:6006
pnpm test              # Vitest
pnpm typecheck
pnpm lint              # Biome
pnpm build             # dist/
pnpm build:watch       # rebuilds dist/ (with types) on every change
pnpm check:dist        # every export resolves after a build
pnpm check:contrast    # WCAG AA contrast of every theme
```

The Storybook is deployed to GitHub Pages on every push to `main` (`.github/workflows/storybook.yml` at the repository root).

## Components

### General

- [Button](docs/button.md)
- [ButtonGroup](docs/button-group.md)
- [Badge](docs/badge.md)
- [BadgeClosable](docs/badge-closable.md)
- [BadgeStatus](docs/badge-status.md)
- [Kbd](docs/kbd.md)
- [Separator](docs/separator.md)

### Typography

- [Heading](docs/heading.md)
- [Text](docs/text.md)

### Data display

- [Avatar](docs/avatar.md)
- [Card](docs/card.md)
- [Carousel](docs/carousel.md)
- [Chart](docs/chart.md)
- [DataTable](docs/data-table.md)
- [Empty](docs/empty.md)
- [Icon](docs/icon.md)
- [Table](docs/table.md)
- [Skeleton](docs/skeleton.md)

### Forms

- [Calendar](docs/calendar.md)
- [Checkbox](docs/checkbox.md)
- [Combobox](docs/combobox.md)
- [DatePicker](docs/date-picker.md)
- [Form](docs/form.md)
- [Input](docs/input.md)
- [InputFile](docs/input-file.md)
- [InputGroup](docs/input-group.md)
- [InputOTP](docs/input-otp.md)
- [InputPassword](docs/input-password.md)
- [Label](docs/label.md)
- [RadioGroup](docs/radio-group.md)
- [Select](docs/select.md)
- [Switch](docs/switch.md)
- [Textarea](docs/textarea.md)
- [TimePicker](docs/time-picker.md)

### Overlays

- [Dialog](docs/dialog.md)
- [AlertDialog](docs/alert-dialog.md)
- [Drawer](docs/drawer.md)
- [Sheet](docs/sheet.md)
- [Popover](docs/popover.md)
- [Tooltip](docs/tooltip.md)
- [DropdownMenu](docs/dropdown-menu.md)

### Navigation

- [Accordion](docs/accordion.md)
- [App shell](docs/app-shell.md) — `AppSidebar`, `AppHeader`, `UserMenu`
- [Breadcrumb](docs/breadcrumb.md)
- [Collapsible](docs/collapsible.md)
- [Command](docs/command.md)
- [Pagination](docs/pagination.md)
- [Sidebar](docs/sidebar.md)
- [Tabs](docs/tabs.md)

### Feedback

- [Alert](docs/alert.md)
- [Progress](docs/progress.md)
- [Spinner](docs/spinner.md)
- [Toaster (Sonner)](docs/sonner.md)

### Providers & hooks

- [SettingsProvider](docs/settings-provider.md) — theme, locale, and table layout persistence
- [Sidebar](docs/sidebar.md) — includes `SidebarProvider` and `useSidebar`

### Brand

- [Logo](docs/logo.md)
- [OgImage](docs/og-image.md)

## Credits

- Built on [shadcn/ui](https://ui.shadcn.com) (MIT) and [Radix UI](https://www.radix-ui.com) (MIT).
- The visual treatment of `Checkbox`, `RadioGroup` and `Switch` started from the free [shadcn/studio](https://github.com/shadcnstudio/shadcn-studio) variants Checkbox 17, Radio Group 14 and Switch 19 (MIT with Commons Clause, © 2025 shadcn/studio), then was rewritten for this package.
