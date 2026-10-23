'use client'

import { XIcon } from 'lucide-react'
import type * as React from 'react'

import { Badge } from './badge'

type BadgeClosableProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  onClose?: () => void
  children: React.ReactNode
  removeLabel?: string
}

function BadgeClosable({
  children,
  onClose,
  removeLabel,
  ...props
}: BadgeClosableProps) {
  return (
    <Badge data-slot='badge-closable' variant='secondary' {...props}>
      {children}
      <button
        type='button'
        className='focus-visible:border-ring focus-visible:ring-ring/50 -my-px -ms-px -me-1.5 relative before:absolute before:-inset-1 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[inherit] p-0 transition-[color,box-shadow] outline-none focus-visible:ring-[3px] text-current/60 hover:text-current'
        aria-label={
          removeLabel ??
          (typeof children === 'string' ? `Remove ${children}` : 'Remove')
        }
        onClick={onClose}>
        <XIcon className='size-3' aria-hidden='true' />
      </button>
    </Badge>
  )
}

export { BadgeClosable }
