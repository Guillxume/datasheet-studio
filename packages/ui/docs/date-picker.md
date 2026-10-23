# Date Picker

Date selection components built on top of [Calendar](./calendar.md) and [Popover](./popover.md).

## Import

```tsx
import { DatePicker, DateRangePicker } from '@guillxume/ui/components/date-picker'
```

## Props

### DatePicker

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `Date \| undefined` | — | Selected date |
| `onValueChange` | `(date: Date \| undefined) => void` | — | Called when the date changes |
| `placeholder` | `string` | `'Pick a date'` | Placeholder text when no date is selected |
| `formatStr` | `string` | `'PPP'` | date-fns format string for display (e.g. `'dd/MM/yyyy'`) |
| `disabled` | `boolean` | `false` | Disable the picker trigger button |
| `disabledDates` | `Matcher \| Matcher[]` | — | Dates to disable in the calendar (react-day-picker matchers) |

Also accepts all `Calendar` props except `mode`, `selected`, `onSelect`, and `disabled`.

### DateRangePicker

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `DateRange \| undefined` | — | Selected date range (`{ from, to }`) |
| `onValueChange` | `(range: DateRange \| undefined) => void` | — | Called when the range changes |
| `placeholder` | `string` | `'Pick a date range'` | Placeholder text when no range is selected |
| `formatStr` | `string` | `'LLL dd, y'` | date-fns format string for display |
| `disabled` | `boolean` | `false` | Disable the picker trigger button |
| `disabledDates` | `Matcher \| Matcher[]` | — | Dates to disable in the calendar (react-day-picker matchers) |
| `numberOfMonths` | `number` | `2` | Number of months to display |

Also accepts all `Calendar` props except `mode`, `selected`, `onSelect`, `numberOfMonths`, and `disabled`.

## Examples

### Single date

```tsx
const [date, setDate] = React.useState<Date | undefined>()

<DatePicker value={date} onValueChange={setDate} />
```

### Custom display format

```tsx
<DatePicker
  value={date}
  onValueChange={setDate}
  formatStr="dd/MM/yyyy"
  placeholder="DD/MM/YYYY"
/>
```

### Disabled dates

```tsx
import { addDays, isBefore, startOfDay } from 'date-fns'

<DatePicker
  value={date}
  onValueChange={setDate}
  disabledDates={[
    (d) => isBefore(d, startOfDay(new Date())),  // disable past dates
    { from: new Date(), to: addDays(new Date(), 3) },  // disable next 3 days
  ]}
/>
```

### With dropdown navigation

```tsx
<DatePicker
  value={date}
  onValueChange={setDate}
  headerLayout="dropdown"
/>
```

### Date range

```tsx
import { type DateRange } from '@guillxume/ui/components/calendar'

const [range, setRange] = React.useState<DateRange | undefined>()

<DateRangePicker value={range} onValueChange={setRange} />
```

A **Reset** button appears inside the calendar popover when a range is selected, allowing users to clear the selection.
