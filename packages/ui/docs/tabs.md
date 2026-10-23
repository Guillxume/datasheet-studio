# Tabs

A set of layered sections of content, known as tab panels, displayed one at a time.

## Import

```tsx
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
} from '@guillxume/ui/components/tabs'
```

## Props

### Tabs

Radix UI `Tabs.Root` props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Controlled active tab value |
| `defaultValue` | `string` | — | Uncontrolled initial active tab |
| `onValueChange` | `(value: string) => void` | — | Called when the active tab changes |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction of the tabs |

### TabsList

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'line'` | `'default'` | Visual style — `default` has a muted background, `line` uses an underline indicator |
| `className` | `string` | — | Additional CSS classes |

### TabsTrigger

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Tab value (required) |
| `disabled` | `boolean` | `false` | Disable the tab trigger |

### TabsContent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Matching tab value (required) |

## Examples

### Basic

```tsx
<Tabs defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Account settings here.</TabsContent>
  <TabsContent value="password">Password settings here.</TabsContent>
</Tabs>
```

### Line variant

```tsx
<Tabs defaultValue="overview">
  <TabsList variant="line">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Overview content.</TabsContent>
  <TabsContent value="analytics">Analytics content.</TabsContent>
</Tabs>
```

