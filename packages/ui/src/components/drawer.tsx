'use client'

import { XIcon } from 'lucide-react'
import type * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { cn } from '../lib/utils'

/**
 * Drawer root component built on vaul.
 *
 * Background scaling is enabled by default and automatically disabled when
 * snap points are provided. Override with `shouldScaleBackground`.
 *
 * Scroll locking is automatically disabled when snap points are provided,
 * so the page behind remains scrollable at partial snap points. Override
 * with `noScrollLock={false}` to force scroll lock, or `noScrollLock` on
 * a non-snap-point drawer to disable it manually.
 *
 * For background scaling to work, the app's scrollable wrapper must have the
 * `data-vaul-drawer-wrapper=""` attribute. The wrapper should be a child of
 * `<body>`, not `<body>` itself, so the drawer portal renders outside the
 * scaled element.
 */
function Drawer({
  shouldScaleBackground,
  noScrollLock,
  modal,
  autoFocus,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root> & {
  noScrollLock?: boolean
}) {
  const effectiveNoScrollLock = noScrollLock ?? !!props.snapPoints
  return (
    <DrawerPrimitive.Root
      data-slot='drawer'
      shouldScaleBackground={shouldScaleBackground ?? !props.snapPoints}
      noBodyStyles={effectiveNoScrollLock || undefined}
      modal={modal ?? !effectiveNoScrollLock}
      autoFocus={autoFocus ?? !props.snapPoints}
      {...props}
    />
  )
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot='drawer-trigger' {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot='drawer-portal' {...props} />
}

function DrawerNested({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.NestedRoot>) {
  return <DrawerPrimitive.NestedRoot data-slot='drawer-nested' {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot='drawer-close' {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot='drawer-overlay'
      className={cn(
        'fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 data-[state=closed]:opacity-0 data-[vaul-snap-points=true]:data-[vaul-snap-points-overlay=false]:!pointer-events-none data-[vaul-snap-points=true]:data-[vaul-snap-points-overlay=false]:!opacity-0',
        className,
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DrawerPortal data-slot='drawer-portal'>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot='drawer-content'
        className={cn(
          'group/drawer-content bg-background fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[80vh] flex-col rounded-t-lg border-t',
          // When snap points are active, vaul controls visible height via translateY.
          // The drawer must be full-viewport tall so the visible slice matches the snap %.
          '[&[style*=--snap-point-height]]:!h-dvh [&[style*=--snap-point-height]]:!max-h-dvh',
          className,
        )}
        {...props}>
        <div className='relative mx-auto flex w-full max-w-lg flex-col overflow-hidden'>
          <div
            className='bg-muted mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full'
            aria-hidden='true'
          />
          {children}
          {showCloseButton && (
            <DrawerPrimitive.Close className='ring-offset-background focus-visible:ring-ring text-muted-foreground absolute top-3 right-3 rounded-sm opacity-0 transition-opacity focus:opacity-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none'>
              <XIcon className='size-4' aria-hidden='true' />
              <span className='sr-only'>Close</span>
            </DrawerPrimitive.Close>
          )}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-header'
      className={cn(
        'flex flex-col gap-0.5 p-4 text-center md:gap-1.5 md:text-left',
        className,
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-footer'
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot='drawer-title'
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot='drawer-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerNested,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
