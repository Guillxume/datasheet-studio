'use client'

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Toasts stay clickable over a modal (Sheet, Dialog): Radix sets
 * `pointer-events: none` on <body> while one is open, and the toaster lives
 * outside it, so an action button in a toast would be dead.
 */
const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      richColors
      closeButton
      position='top-right'
      className='toaster group'
      icons={{
        success: <CircleCheckIcon aria-hidden='true' className='size-4' />,
        info: <InfoIcon aria-hidden='true' className='size-4' />,
        warning: <TriangleAlertIcon aria-hidden='true' className='size-4' />,
        error: <OctagonXIcon aria-hidden='true' className='size-4' />,
        loading: (
          <Loader2Icon
            aria-hidden='true'
            className='size-4 animate-spin motion-reduce:animate-none'
          />
        ),
      }}
      toastOptions={{
        ...toastOptions,
        classNames: {
          closeButton:
            '!static !size-5 !rounded-sm !border-none !bg-transparent !text-current/50 hover:!text-current !transform-none !top-0 !left-0 order-last !ml-auto !-mr-1',
          ...toastOptions?.classNames,
        },
        style: { pointerEvents: 'auto', ...toastOptions?.style },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      duration={5000}
      swipeDirections={['right']}
      {...props}
    />
  )
}

export { Toaster }
