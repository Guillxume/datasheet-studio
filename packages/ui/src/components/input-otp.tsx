'use client'

import { OTPInput, OTPInputContext } from 'input-otp'
import { MinusIcon } from 'lucide-react'
import type * as React from 'react'
import { useContext } from 'react'

import { cn } from '../lib/utils'

const InputOTP = ({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput>) => (
  <OTPInput
    data-slot='input-otp'
    containerClassName={cn(
      'flex items-center gap-2 has-disabled:opacity-50',
      containerClassName,
    )}
    className={cn('disabled:cursor-not-allowed', className)}
    {...props}
  />
)

const InputOTPGroup = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot='input-otp-group'
    className={cn('flex items-center', className)}
    {...props}
  />
)

const InputOTPSlot = ({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & { index: number }) => {
  const inputOTPContext = useContext(OTPInputContext)
  const slot = inputOTPContext?.slots?.[index]

  if (!slot) {
    return null
  }

  const { char, hasFakeCaret, isActive } = slot

  return (
    <div
      data-slot='input-otp-slot'
      data-active={isActive}
      className={cn(
        'border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all first:rounded-l-md first:border-l last:rounded-r-md',
        isActive && 'ring-ring/50 z-10 ring-[3px]',
        className,
      )}
      {...props}>
      {char}
      {hasFakeCaret && (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
          <div className='bg-foreground animate-caret-blink motion-reduce:animate-none h-4 w-px duration-1000' />
        </div>
      )}
    </div>
  )
}

const InputOTPSeparator = ({ ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='input-otp-separator' {...props}>
    <MinusIcon aria-hidden='true' />
  </div>
)

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
