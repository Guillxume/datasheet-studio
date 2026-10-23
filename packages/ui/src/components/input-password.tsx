'use client'

import { EyeIcon, EyeOffIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '../components/button'
import { Input } from '../components/input'
import { cn } from '../lib/utils'

function InputPassword({
  className,
  disabled,
  labels,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & {
  labels?: {
    showPassword?: string
    hidePassword?: string
  }
}) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div data-slot='input-password' className='relative'>
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        disabled={disabled}
        {...props}
      />
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='text-muted-foreground hover:text-foreground absolute top-0 right-0 h-full px-3 hover:bg-transparent'
        disabled={disabled}
        onClick={() => !disabled && setVisible(v => !v)}
        aria-label={
          visible
            ? (labels?.hidePassword ?? 'Hide password')
            : (labels?.showPassword ?? 'Show password')
        }
        aria-pressed={visible}>
        {visible ? (
          <EyeOffIcon className='size-4' />
        ) : (
          <EyeIcon className='size-4' />
        )}
      </Button>
    </div>
  )
}

export { InputPassword }
