# Data Table Calendar View

A month grid display mode for DataTable that groups rows by a user-selected date field. On desktop, day cells show up to 3 inline event entries (via `renderEvent`) with a "+N more" overflow popover. On mobile, day cells show a count badge; tapping it opens a bottom drawer listing the items as cards (via `renderEventDetail`, falling back to `renderEvent`).

## Import

```tsx
import { DataTableCalendarView } from '@guillxume/ui/components/data-table-calendar-view'
import type {
  CalendarDateField,
  DataTableCalendarConfig,
  DataTableCalendarViewLabels,
} from '@guillxume/ui/components/data-table-calendar-view'
```

## Usage

Calendar view is typically used as a display mode within `DataTable` via the `calendarConfig` prop — you don't render `DataTableCalendarView` directly. See the [DataTable docs](./data-table.md#with-calendar-view) for integration examples.

## Config type

```tsx
type DataTableCalendarConfig<TData> = {
  /** Date fields available for grouping */
  dateFields: CalendarDateField[]
  /** Extract a Date from a row for the given field ID */
  dateAccessor: (row: TData, fieldId: string) => Date | null
  /** Render a compact inline entry for a row inside day cells (desktop) */
  renderEvent?: (row: Row<TData>) => ReactNode
  /** Render a richer card for drawers/popovers. Falls back to renderEvent. */
  renderEventDetail?: (row: Row<TData>) => ReactNode
  /** Called when the displayed month or selected date field changes */
  onMonthChange?: (monthStart: Date, monthEnd: Date, fieldId: string) => void
}

type CalendarDateField = {
  id: string
  label: string
}
```

| Config field | Type | Description |
|-------------|------|-------------|
| `dateFields` | `CalendarDateField[]` | Array of date fields the user can group by. Each has an `id` (matching a field on `TData`) and a `label` for the selector dropdown. |
| `dateAccessor` | `(row: TData, fieldId: string) => Date \| null` | Extracts a `Date` from a row for the given field ID. Return `null` for missing dates. |
| `renderEvent` | `(row: Row<TData>) => ReactNode` | Renders a compact inline entry for each row in desktop day cells. Also used in overflow popovers and mobile drawer if `renderEventDetail` is not provided. If omitted, shows a default "Row N" fallback. |
| `renderEventDetail` | `(row: Row<TData>) => ReactNode` | Renders a richer card for the overflow popover (desktop) and the mobile drawer. Falls back to `renderEvent` when not provided. Use this for a detailed view with more information than the compact inline entry. |
| `onMonthChange` | `(monthStart: Date, monthEnd: Date, fieldId: string) => void` | Called whenever the displayed month or selected date field changes. Use this to sync server-side date filters with the calendar's visible range. |

## Props

| Prop | Type | Description |
|------|------|-------------|
| `rows` | `Row<TData>[]` | TanStack Table row model |
| `calendarConfig` | `DataTableCalendarConfig<TData>` | Calendar configuration (see above) |
| `loading` | `boolean` | Show skeleton loading state |
| `noResultsMessage` | `string` | Message when no rows are available |
| `labels` | `DataTableCalendarViewLabels` | i18n label overrides |
| `totalItems` | `number` | Total server-side row count. When greater than `rows.length`, a truncation warning alert is shown. |

## Labels

```tsx
type DataTableCalendarViewLabels = {
  today?: string              // "Today" button text
  noEvents?: string           // Fallback text when renderEvent is not provided
  selectDateField?: string    // aria-label for the date field selector
  monthLabel?: string         // aria-label for the month dropdown
  yearLabel?: string          // aria-label for the year dropdown
  truncationWarning?: string  // Warning text when totalItems > rows.length
  previousMonth?: string      // aria-label for the previous month button
  nextMonth?: string          // aria-label for the next month button
  weekdays?: string[]         // Custom weekday labels (7 items, starting from locale week start)
  moreItems?: (count: number) => string   // "+N more" overflow indicator text
  itemCount?: (count: number) => string   // Item count display (e.g. "3 items") for day cells and popovers
}
```

## Features

- **Month/year dropdowns**: Select dropdowns for month and year in the calendar header, plus previous/next arrows and a "Today" jump button.
- **Date field selector**: Dropdown appears in the calendar header when `dateFields` has more than one entry.
- **Month change callback**: `onMonthChange` fires whenever the displayed month or selected date field changes — use this to auto-sync server-side date filters with the visible calendar range.
- **Truncation alert**: When `totalItems` exceeds the number of displayed rows, a warning alert appears above the calendar prompting users to apply filters.
- **Responsive day cells**: On desktop (md+), up to 3 events are rendered inline via `renderEvent`, with a "+N more" button that opens a popover showing all events via `renderEventDetail`. On mobile, a count badge opens a bottom drawer listing all events as cards.
- **Outside-month days**: Days from adjacent months are muted. If they have events, they remain interactive.
- **Skeleton loading**: Shows a skeleton grid when `loading={true}` and no rows are available.
- **Keyboard accessible**: Day buttons have focus-visible ring styles.

## Server-side integration

When using calendar view with server-side data (`manualMode`), combine `onMonthChange` with URL state to fetch only the visible month's data:

```tsx
const handleMonthChange = useCallback(
  (start: Date, end: Date, fieldId: string) => {
    urlState.onColumnFiltersChange(prev => {
      const next = prev.filter(f => f.id !== fieldId)
      next.push({
        id: fieldId,
        value: [start.toISOString(), end.toISOString()],
      })
      return next
    })
  },
  [urlState.onColumnFiltersChange],
)

const calendarConfig = {
  dateFields: [{ id: 'orderDate', label: 'Order Date' }],
  dateAccessor: (order, fieldId) => {
    const raw = order[fieldId]
    if (!raw) return null
    const date = new Date(raw)
    return isNaN(date.getTime()) ? null : date
  },
  renderEvent: row => <OrderInlineEvent order={row.original} />,
  renderEventDetail: row => <OrderEventCard order={row.original} />,
  onMonthChange: handleMonthChange,
}
```

To hide pagination and maximize items per page in calendar mode:

```tsx
const isCalendarMode = layoutState.displayMode === 'calendar'
const effectivePagination = isCalendarMode
  ? { pageIndex: 0, pageSize: 100 }
  : urlState.pagination

<DataTable
  // ...
  footer={isCalendarMode ? undefined : () => <DataTablePagination />}
/>
```
