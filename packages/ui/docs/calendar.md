# Calendar

Date selection component built on top of [react-day-picker](https://react-day-picker.js.org/).

## Import

```tsx
import { Calendar } from '@guillxume/ui/components/calendar'
```

## Props

Extends all `DayPicker` props from `react-day-picker`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showOutsideDays` | `boolean` | `true` | Show days from adjacent months |
| `headerLayout` | `'label' \| 'dropdown'` | `'label'` | Navigation layout — `'dropdown'` shows month/year selects |
| `buttonVariant` | `ButtonVariant` | `'ghost'` | Button variant for nav and day cells |
| `mode` | `'single' \| 'multiple' \| 'range'` | — | Selection mode |
| `numberOfMonths` | `number` | `1` | Number of months to display side-by-side |

## Examples

### Single date

```tsx
const [date, setDate] = React.useState<Date | undefined>(new Date())

<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  className="rounded-lg border"
/>
```

### Date range

```tsx
import { type DateRange } from '@guillxume/ui/components/calendar'

const [range, setRange] = React.useState<DateRange | undefined>()

<Calendar
  mode="range"
  selected={range}
  onSelect={setRange}
  numberOfMonths={2}
  className="rounded-lg border"
/>
```

### Month / year dropdown

```tsx
<Calendar
  mode="single"
  headerLayout="dropdown"
  className="rounded-lg border"
/>
```
