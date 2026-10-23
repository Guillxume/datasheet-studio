# Breadcrumb

Navigation aid showing the current page location within a hierarchy.

## Import

```tsx
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '@guillxume/ui/components/breadcrumb'
```

## Props

### Breadcrumb

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ariaLabel` | `string` | `'breadcrumb'` | Custom `aria-label` for the `<nav>` element |

### BreadcrumbLink

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props onto child element using Radix Slot |

### BreadcrumbEllipsis

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `moreLabel` | `string` | `'More'` | Custom screen-reader text |

### BreadcrumbSeparator

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | `<ChevronRight />` | Custom separator icon |

## Examples

### Basic

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/products">Products</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Current Page</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

### With ellipsis

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbEllipsis />
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Current Page</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```
