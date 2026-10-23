# Data Table Display Mode Toggle

A toggle switch for switching between table, card, and calendar views. Built on `ToggleGroup` with `LayoutListIcon` / `LayoutGridIcon` / `CalendarIcon` icons.

## Import

```tsx
import { DataTableDisplayModeToggle } from '@guillxume/ui/components/data-table-display-mode-toggle'
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `displayMode` | `DisplayMode` | **required** | Current display mode (`'table' \| 'card' \| 'calendar'`) |
| `onDisplayModeChange` | `(mode: DisplayMode) => void` | **required** | Callback when mode changes |
| `showCard` | `boolean` | `false` | Show the card toggle button |
| `showCalendar` | `boolean` | `false` | Show the calendar toggle button |
| `labels` | `{ table?: string; card?: string; calendar?: string }` | — | Accessible labels for i18n (`aria-label` on each toggle item) |
| `className` | `string` | — | Additional CSS classes |

## Usage with layout state

Pair with `useDataTableLayoutState` to persist the display mode in `localStorage`:

```tsx
import { useDataTableLayoutState } from '@guillxume/ui/hooks/use-data-table-layout-state'
import { DataTableDisplayModeToggle } from '@guillxume/ui/components/data-table-display-mode-toggle'

const layoutState = useDataTableLayoutState({
  tableId: 'orders',
  defaultDisplayMode: 'table',
})

// Table-only (default) — just the table toggle is shown
<DataTableDisplayModeToggle
  displayMode={layoutState.displayMode}
  onDisplayModeChange={layoutState.onDisplayModeChange}
/>
```

### With card view

```tsx
<DataTableDisplayModeToggle
  displayMode={layoutState.displayMode}
  onDisplayModeChange={layoutState.onDisplayModeChange}
  showCard
/>
```

### With calendar view

```tsx
<DataTableDisplayModeToggle
  displayMode={layoutState.displayMode}
  onDisplayModeChange={layoutState.onDisplayModeChange}
  showCalendar
/>
```

### With card and calendar views

```tsx
<DataTableDisplayModeToggle
  displayMode={layoutState.displayMode}
  onDisplayModeChange={layoutState.onDisplayModeChange}
  showCard
  showCalendar
/>
```

The display mode is auto-saved to `localStorage` immediately when changed (no need to call `saveLayout`).

## Behavior

- Only the table toggle is shown by default. Card and calendar toggles are opt-in via `showCard` and `showCalendar` props.
- Prevents deselection: clicking the active mode does nothing (ToggleGroup emits empty string on deselect, which is ignored).
- Column-specific UI (column visibility checkboxes in `DataTableViewOptions`) is hidden when in card or calendar mode.
- Only enable `showCard` when the parent `DataTable` has a `renderCard` prop — otherwise the card mode has nothing to render.
- The calendar toggle should only be enabled when the table has date fields configured via `calendarConfig`.
