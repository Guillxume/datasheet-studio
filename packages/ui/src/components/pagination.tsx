import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from 'lucide-react'
import type * as React from 'react'

import { type Button, buttonVariants } from '../components/button'
import { cn } from '../lib/utils'

function Pagination({
  className,
  ariaLabel,
  ...props
}: React.ComponentProps<'nav'> & { ariaLabel?: string }) {
  return (
    <nav
      aria-label={ariaLabel ?? 'pagination'}
      data-slot='pagination'
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot='pagination-content'
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot='pagination-item' {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  React.ComponentProps<'a'>

function PaginationLink({
  className,
  isActive,
  size = 'icon',
  href,
  ...props
}: PaginationLinkProps) {
  const classes = cn(
    buttonVariants({ variant: isActive ? 'outline' : 'ghost', size }),
    className,
  )
  const shared = {
    'aria-current': isActive ? ('page' as const) : undefined,
    'data-slot': 'pagination-link' as const,
    'data-active': isActive,
    className: classes,
  }

  if (href != null) {
    return <a href={href} {...shared} {...props} />
  }

  return (
    <button
      type='button'
      {...shared}
      {...(props as React.ComponentProps<'button'>)}
    />
  )
}

function PaginationPrevious({
  className,
  label = 'Previous',
  iconOnly = false,
  previousPageLabel,
  ...props
}: React.ComponentProps<typeof PaginationLink> & {
  label?: string
  iconOnly?: boolean
  previousPageLabel?: string
}) {
  return (
    <PaginationLink
      aria-label={previousPageLabel ?? 'Go to previous page'}
      size={iconOnly ? 'icon' : 'default'}
      className={cn(!iconOnly && 'gap-1 px-2.5 sm:pl-2.5', className)}
      {...props}>
      <ChevronLeftIcon />
      {!iconOnly && <span className='hidden sm:block'>{label}</span>}
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  label = 'Next',
  iconOnly = false,
  nextPageLabel,
  ...props
}: React.ComponentProps<typeof PaginationLink> & {
  label?: string
  iconOnly?: boolean
  nextPageLabel?: string
}) {
  return (
    <PaginationLink
      aria-label={nextPageLabel ?? 'Go to next page'}
      size={iconOnly ? 'icon' : 'default'}
      className={cn(!iconOnly && 'gap-1 px-2.5 sm:pr-2.5', className)}
      {...props}>
      {!iconOnly && <span className='hidden sm:block'>{label}</span>}
      <ChevronRightIcon />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  morePagesLabel,
  ...props
}: React.ComponentProps<'span'> & { morePagesLabel?: string }) {
  return (
    <span
      data-slot='pagination-ellipsis'
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}>
      <MoreHorizontalIcon className='size-4' aria-hidden='true' />
      <span className='sr-only'>{morePagesLabel ?? 'More pages'}</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
