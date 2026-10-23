# Form

Form components integrated with `react-hook-form` for validation and accessibility.

## Import

```tsx
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
} from '@guillxume/ui/components/form'
```

## Props

### Form

Wraps `react-hook-form`'s `FormProvider`. Pass all return values from `useForm()`.

### FormField

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `control` | `Control` | — | Form control from `useForm()` |
| `name` | `string` | — | Field name in the form schema |
| `render` | `({ field }) => ReactNode` | — | Render function for the field |

### FormControl

Wraps the form input with Radix Slot for accessibility attributes (`aria-invalid`, `aria-describedby`).

### FormMessage

Automatically renders the field's error message. Falls back to `children` if no error.

## Examples

### Basic

```tsx
const form = useForm({ defaultValues: { email: '' } })

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input placeholder="email@example.com" {...field} />
          </FormControl>
          <FormDescription>Your email address.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">Submit</Button>
  </form>
</Form>
```
