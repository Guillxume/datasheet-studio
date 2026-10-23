import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from './input'
import { Label } from './label'

const meta = {
  title: 'Forms/Input',
  component: Input,
  tags: ['autodocs'],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Type something...',
  },
}

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    value: 'https://api.example.com/orders/123',
  },
}

export const Required: Story = {
  render: () => (
    <div className='max-w-sm space-y-4'>
      <div className='grid gap-2'>
        <Label htmlFor='email-demo'>
          Email
          <span className='text-destructive' aria-hidden='true'>
            *
          </span>
        </Label>
        <Input
          id='email-demo'
          type='email'
          required
          placeholder='you@example.com'
        />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='company-demo'>
          Company name
          <span className='text-destructive' aria-hidden='true'>
            *
          </span>
        </Label>
        <Input id='company-demo' required placeholder='Acme Inc.' />
      </div>
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
}

export const CharacterLimit: Story = {
  args: {
    characterLimit: 50,
    placeholder: 'Enter a title',
  },
}

export const NumberStepper: Story = {
  render: () => (
    <div className='max-w-sm space-y-4'>
      <Input numberStepper defaultValue={1} min={0} max={10} />
      <Input numberStepper defaultValue={0} step={5} min={0} max={100} />
      <Input numberStepper disabled defaultValue={3} />
    </div>
  ),
}

export const InputMask: Story = {
  render: () => (
    <div className='max-w-sm space-y-4'>
      <div className='grid gap-1.5'>
        <Label htmlFor='mask-phone'>Phone</Label>
        <Input
          id='mask-phone'
          mask='(99) 99999-9999'
          placeholder='(00) 00000-0000'
        />
      </div>
      <div className='grid gap-1.5'>
        <Label htmlFor='mask-date'>Date</Label>
        <Input id='mask-date' mask='99/99/9999' placeholder='DD/MM/YYYY' />
      </div>
      <div className='grid gap-1.5'>
        <Label htmlFor='mask-card'>Credit card</Label>
        <Input
          id='mask-card'
          mask='9999 9999 9999 9999'
          placeholder='0000 0000 0000 0000'
        />
      </div>
      <div className='grid gap-1.5'>
        <Label htmlFor='mask-currency'>Currency</Label>
        <Input
          id='mask-currency'
          mask='currency'
          maskOptions={{ prefix: '$ ', digits: 2, rightAlign: false }}
          placeholder='$ 0.00'
        />
      </div>
    </div>
  ),
}
