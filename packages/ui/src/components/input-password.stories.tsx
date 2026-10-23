import type { Meta, StoryObj } from '@storybook/react-vite'
import { InputPassword } from './input-password'

const meta = {
  title: 'Forms/InputPassword',
  component: InputPassword,
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof InputPassword>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Enter your password',
    className: 'max-w-sm',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Enter your password',
    className: 'max-w-sm',
    disabled: true,
  },
}

export const WithCustomLabels: Story = {
  args: {
    placeholder: 'Enter your password',
    className: 'max-w-sm',
    labels: {
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
    },
  },
}

export const WithDefaultValue: Story = {
  args: {
    defaultValue: 'mysecretpassword',
    className: 'max-w-sm',
  },
}
