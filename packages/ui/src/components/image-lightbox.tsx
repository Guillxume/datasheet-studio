'use client'

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { Button } from './button'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import { Icon } from './icon'

export type ImageLightboxImage = {
  src: string
  alt: string
}

export type ImageLightboxProps = {
  images: ImageLightboxImage[]
  initialIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  labels?: {
    title?: string
    previous?: string
    next?: string
    close?: string
  }
  className?: string
}

const DEFAULT_LABELS = {
  title: 'Image preview',
  previous: 'Previous image',
  next: 'Next image',
  close: 'Close',
}

export const ImageLightbox = ({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
  labels,
  className,
}: ImageLightboxProps) => {
  const [index, setIndex] = useState(initialIndex)
  const total = images.length
  const labelStrings = { ...DEFAULT_LABELS, ...labels }

  useEffect(() => {
    if (!open) return
    if (total === 0) {
      setIndex(0)
      return
    }
    setIndex(Math.min(Math.max(initialIndex, 0), total - 1))
  }, [open, initialIndex, total])

  useEffect(() => {
    if (!open || total <= 1) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setIndex(idx => (idx + 1) % total)
      } else if (event.key === 'ArrowLeft') {
        setIndex(idx => (idx - 1 + total) % total)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, total])

  if (total === 0) {
    return null
  }

  const safeIndex = Math.min(Math.max(index, 0), total - 1)
  const current = images[safeIndex]
  const goPrev = () => setIndex(idx => (idx - 1 + total) % total)
  const goNext = () => setIndex(idx => (idx + 1) % total)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'max-w-[95vw] sm:max-w-4xl p-2 sm:p-4 bg-background',
          className,
        )}>
        <DialogTitle className='sr-only'>{labelStrings.title}</DialogTitle>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label={labelStrings.close}
          onClick={() => onOpenChange(false)}
          className='absolute top-3 right-3 z-10'>
          <Icon icon={XIcon} size='sm' />
        </Button>
        <div className='relative flex items-center justify-center'>
          <img
            src={current.src}
            alt={current.alt}
            className='max-h-[80vh] max-w-full object-contain'
          />
          {total > 1 && (
            <>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={goPrev}
                aria-label={labelStrings.previous}
                className='absolute left-2 top-1/2 -translate-y-1/2'>
                <Icon icon={ChevronLeftIcon} size='sm' />
              </Button>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={goNext}
                aria-label={labelStrings.next}
                className='absolute right-2 top-1/2 -translate-y-1/2'>
                <Icon icon={ChevronRightIcon} size='sm' />
              </Button>
            </>
          )}
        </div>
        {total > 1 && (
          <div className='mt-2 text-center text-xs text-muted-foreground tabular-nums'>
            {safeIndex + 1} / {total}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
