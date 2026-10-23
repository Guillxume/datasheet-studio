# Table

Semantic HTML table components with consistent styling.

## Import

```tsx
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@guillxume/ui/components/table'
```

## Props

All sub-components accept their corresponding HTML element props (`className`, etc.).

### TableHead

Renders a `<th>` element with `scope="col"` by default to associate header cells with their column for assistive technology. Override via `scope` prop if needed (e.g. `scope="row"` for row headers).

## Examples

### Basic

```tsx
<Table>
  <TableCaption>A list of recent invoices.</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>INV001</TableCell>
      <TableCell>Paid</TableCell>
      <TableCell className="text-right">$250.00</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>INV002</TableCell>
      <TableCell>Pending</TableCell>
      <TableCell className="text-right">$150.00</TableCell>
    </TableRow>
  </TableBody>
  <TableFooter>
    <TableRow>
      <TableCell colSpan={2}>Total</TableCell>
      <TableCell className="text-right">$400.00</TableCell>
    </TableRow>
  </TableFooter>
</Table>
```
