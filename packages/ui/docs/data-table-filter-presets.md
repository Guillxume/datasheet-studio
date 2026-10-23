# Data Table Filter Presets

A dropdown button for applying predefined filter combinations. Presets replace all active filters and hide the filter bar when active. Built on `DropdownMenu` with `FilterIcon` / `CheckIcon` icons.

## Import

```tsx
import { DataTableFilterPresets } from '@guillxume/ui/components/data-table-filter-presets'
import type { DataTableFilterPreset } from '@guillxume/ui/hooks/use-data-table-url-state'
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `presets` | `DataTableFilterPreset[]` | **required** | Available preset definitions. Renders nothing when empty. |
| `activePreset` | `string \| null` | **required** | ID of the currently active preset (from `urlState.preset`) |
| `onPresetChange` | `(presetId: string \| null) => void` | **required** | Callback to apply or clear a preset (from `urlState.onPresetChange`) |
| `labels` | `{ trigger?: string; clear?: string }` | — | Custom labels for the dropdown trigger button and clear button aria-label (i18n) |

### `DataTableFilterPreset` shape

```tsx
type DataTableFilterPreset = {
  id: string                                         // URL param value (e.g. 'late-dispatched')
  label: string                                      // Display label (i18n-resolved)
  icon?: React.ComponentType<{ className?: string }> // Optional icon for the dropdown item
  filters: () => ColumnFiltersState                  // Factory function — called on each activation
}
```

The `filters` field is a **function** so dynamic values like "today" or "start of current month" are computed fresh each time the preset is applied.

## Usage with URL state

Pair with `useDataTableUrlState` — pass `presets` to the hook and spread `preset` / `onPresetChange` to the component:

```tsx
import { useDataTableUrlState } from '@guillxume/ui/hooks/use-data-table-url-state'
import { DataTableFilterPresets } from '@guillxume/ui/components/data-table-filter-presets'
import type { DataTableFilterPreset } from '@guillxume/ui/hooks/use-data-table-url-state'
import { startOfMonth, endOfMonth } from 'date-fns'

const presets: DataTableFilterPreset[] = [
  {
    id: 'this-month',
    label: 'This month',
    filters: () => {
      const now = new Date()
      return [
        { id: 'date', value: [startOfMonth(now).toISOString(), endOfMonth(now).toISOString()] },
      ]
    },
  },
  {
    id: 'pending-only',
    label: 'Pending only',
    filters: () => [{ id: 'status', value: ['pending'] }],
  },
]

const urlState = useDataTableUrlState({
  filters: {
    status: { type: 'faceted' },
    date: { type: 'date' },
  },
  presets,
})

// In the toolbar:
<DataTableFilterPresets
  presets={presets}
  activePreset={urlState.preset}
  onPresetChange={urlState.onPresetChange}
  labels={{ trigger: 'Quick filters' }}
/>

// Hide the filter bar when a preset is active:
{!urlState.preset && (
  <Card>
    <CardContent>
      {/* search + filter buttons */}
    </CardContent>
  </Card>
)}
```

## Behavior

- **Renders nothing** when `presets` is empty — safe to always include in the toolbar.
- **Clicking a preset** calls `onPresetChange(id)`, which clears all existing filters/search and applies the preset's filters.
- **Clicking the active preset** deselects it — calls `onPresetChange(null)`, clearing all filters.
- **Clear button** (`×`) appears next to the dropdown when a preset is active — provides an explicit way to clear the preset.
- **Button variant** switches from `outline` (no preset active) to `secondary` (preset active), and the label shows the active preset's name.
- **URL param**: `?preset=<id>` is set alongside the preset's filter params, making preset views bookmarkable.
- **Manual filter change** (via `onColumnFiltersChange`) automatically clears the `preset` URL param.
