'use client'

import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '../lib/utils'

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot='sheet' {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot='sheet-trigger' {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot='sheet-close' {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot='sheet-portal' {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot='sheet-overlay'
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'right' | 'left'
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot='sheet-content'
        onOpenAutoFocus={
          onOpenAutoFocus ??
          (e => {
            // Radix auto-focuses the first tabbable element which may be the
            // close button. Redirect focus to the first interactive child
            // element instead, keeping the close button last in tab order.
            const content = e.currentTarget as HTMLElement
            const first = content.querySelector<HTMLElement>(
              ':is(input, select, textarea, button):not([disabled]):not([data-slot="sheet-close"]), [tabindex]:not([tabindex="-1"]):not([data-slot="sheet-close"])',
            )
            if (first) {
              e.preventDefault()
              first.focus()
            }
          })
        }
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-xl transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 rounded-lg',
          side === 'right' &&
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-[5%] sm:right-5 top-[5%] sm:top-5 bottom-[5%] sm:bottom-5 left-[5%] sm:left-auto w-auto sm:w-3/4 sm:max-w-sm',
          side === 'left' &&
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-[5%] sm:left-5 top-[5%] sm:top-5 bottom-[5%] sm:bottom-5 right-[5%] sm:right-auto w-auto sm:w-3/4 sm:max-w-sm',
          className,
        )}
        {...props}>
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot='sheet-close'
            className='ring-offset-background focus:ring-ring data-[state=open]:bg-secondary text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-xs transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none disabled:cursor-not-allowed'>
            <XIcon className='size-4' />
            <span className='sr-only'>Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sheet-header'
      className={cn('flex flex-col gap-1.5 p-4 border-b', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sheet-footer'
      className={cn('mt-auto flex flex-col gap-2 p-4 border-t', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot='sheet-title'
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot='sheet-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
