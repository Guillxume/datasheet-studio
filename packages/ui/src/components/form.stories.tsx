import type { Meta, StoryObj } from '@storybook/react-vite'
import { useForm } from 'react-hook-form'
import { Button } from './button'
import { Checkbox } from './checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form'
import { Input } from './input'
import { Label } from './label'
import { RadioGroup, RadioGroupItem } from './radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import { Switch } from './switch'
import { Textarea } from './textarea'

const meta = {
  title: 'Forms/Form',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

type FormValues = {
  username: string
  email: string
  bio: string
  role: string
  plan: string
  terms: boolean
}

export const WithValidation: Story = {
  render: () => {
    const form = useForm<FormValues>({
      defaultValues: {
        username: '',
        email: '',
        bio: '',
        role: '',
        plan: '',
        terms: false,
      },
    })

    const onSubmit = (data: FormValues) => {
      alert(JSON.stringify(data, null, 2))
    }

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='max-w-md space-y-6'>
          <FormField
            control={form.control}
            name='username'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder='johndoe' {...field} />
                </FormControl>
                <FormDescription>Your public display name.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    placeholder='you@example.com'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='bio'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Tell us about yourself...'
                    {...field}
                  />
                </FormControl>
                <FormDescription>Max 160 characters.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='role'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Select a role' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='admin'>Admin</SelectItem>
                    <SelectItem value='editor'>Editor</SelectItem>
                    <SelectItem value='viewer'>Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='plan'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plan</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}>
                    <div className='flex items-center gap-2'>
                      <RadioGroupItem value='free' id='plan-free' />
                      <Label htmlFor='plan-free'>Free</Label>
                    </div>
                    <div className='flex items-center gap-2'>
                      <RadioGroupItem value='pro' id='plan-pro' />
                      <Label htmlFor='plan-pro'>Pro</Label>
                    </div>
                    <div className='flex items-center gap-2'>
                      <RadioGroupItem value='enterprise' id='plan-enterprise' />
                      <Label htmlFor='plan-enterprise'>Enterprise</Label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='terms'
            render={({ field }) => (
              <FormItem>
                <div className='flex items-center gap-2'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>Accept terms and conditions</FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit'>Submit</Button>
        </form>
      </Form>
    )
  },
}

export const InputStates: Story = {
  render: () => (
    <div className='max-w-xs space-y-4'>
      <Input placeholder='Default input' />
      <Input type='email' placeholder='Email' />
      <Input placeholder='Disabled' disabled />
    </div>
  ),
}

export const TextareaStates: Story = {
  render: () => (
    <div className='max-w-xs space-y-4'>
      <Textarea placeholder='Type your message here...' />
      <Textarea placeholder='Disabled' disabled />
    </div>
  ),
}

export const CheckboxWithLabel: Story = {
  render: () => (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <Checkbox id='terms-demo' />
        <Label htmlFor='terms-demo'>Accept terms and conditions</Label>
      </div>
      <div className='flex items-center gap-2'>
        <Checkbox id='disabled-demo' disabled />
        <Label htmlFor='disabled-demo'>Disabled checkbox</Label>
      </div>
    </div>
  ),
}

export const SelectOptions: Story = {
  render: () => (
    <Select>
      <SelectTrigger className='w-48'>
        <SelectValue placeholder='Select a fruit' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='apple'>Apple</SelectItem>
        <SelectItem value='banana'>Banana</SelectItem>
        <SelectItem value='cherry'>Cherry</SelectItem>
        <SelectItem value='grape'>Grape</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const RadioGroupOptions: Story = {
  render: () => (
    <RadioGroup defaultValue='comfortable'>
      <div className='flex items-center gap-2'>
        <RadioGroupItem value='default' id='radio-default' />
        <Label htmlFor='radio-default'>Default</Label>
      </div>
      <div className='flex items-center gap-2'>
        <RadioGroupItem value='comfortable' id='radio-comfortable' />
        <Label htmlFor='radio-comfortable'>Comfortable</Label>
      </div>
      <div className='flex items-center gap-2'>
        <RadioGroupItem value='compact' id='radio-compact' />
        <Label htmlFor='radio-compact'>Compact</Label>
      </div>
    </RadioGroup>
  ),
}

export const SwitchSizes: Story = {
  render: () => (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <Switch size='sm' id='switch-sm' />
        <Label htmlFor='switch-sm'>Small</Label>
      </div>
      <div className='flex items-center gap-2'>
        <Switch size='md' id='switch-md' />
        <Label htmlFor='switch-md'>Medium</Label>
      </div>
      <div className='flex items-center gap-2'>
        <Switch size='lg' id='switch-lg' />
        <Label htmlFor='switch-lg'>Large</Label>
      </div>
      <div className='flex items-center gap-2'>
        <Switch disabled id='switch-disabled' />
        <Label htmlFor='switch-disabled'>Disabled</Label>
      </div>
    </div>
  ),
}
