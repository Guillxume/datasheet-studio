# Pagination

Navigation component for paging through content.

## Import

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@guillxume/ui/components/pagination'
```

## Props

### Pagination

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ariaLabel` | `string` | `'pagination'` | Custom `aria-label` for the `<nav>` element |

### PaginationLink

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isActive` | `boolean` | `false` | Highlights the link as the current page |
| `size` | `'default' \| 'sm' \| 'lg' \| 'icon'` | `'icon'` | Button size variant |

### PaginationPrevious

Same props as `PaginationLink`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `'Previous'` | Visible text label |
| `iconOnly` | `boolean` | `false` | Show only the chevron icon (no text) |
| `previousPageLabel` | `string` | `'Go to previous page'` | Custom `aria-label` |

### PaginationNext

Same props as `PaginationLink`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `'Next'` | Visible text label |
| `iconOnly` | `boolean` | `false` | Show only the chevron icon (no text) |
| `nextPageLabel` | `string` | `'Go to next page'` | Custom `aria-label` |

### PaginationEllipsis

Renders a "..." indicator for skipped pages. Accepts `span` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `morePagesLabel` | `string` | `'More pages'` | Custom screen-reader text |

## Examples

### Basic

```tsx
<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="#" />
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#">1</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#" isActive>2</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#">3</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationEllipsis />
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href="#" />
    </PaginationItem>
  </PaginationContent>
</Pagination>
```
