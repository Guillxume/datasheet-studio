import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/utils'

/* -------------------------------------------------------------------------- */
/*  Mark                                                                      */
/* -------------------------------------------------------------------------- */

/** viewBox of the logo mark: a sheet with a folded corner and three text lines. */
const LOGO_VIEWBOX = '0 0 48 48'

/** Square viewBox with equal padding around the mark — useful for icons and favicons. */
const LOGO_SQUARE_VIEWBOX = '-4 -4 56 56'

const LOGO_PATHS: ReadonlyArray<{ d: string; fill: string }> = [
  {
    // Sheet
    d: 'M12 4H30L38 12V42C38 43.105 37.105 44 36 44H12C10.895 44 10 43.105 10 42V6C10 4.895 10.895 4 12 4Z',
    fill: '#2E2B25',
  },
  {
    // Folded corner
    d: 'M30 4V10C30 11.105 30.895 12 32 12H38L30 4Z',
    fill: '#D9CFC2',
  },
  {
    // Text lines
    d: 'M15 19H33V22H15V19ZM15 26H33V29H15V26ZM15 33H26V36H15V33Z',
    fill: '#E8834A',
  },
]

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

const logoVariants = cva('', {
  variants: {
    size: {
      sm: 'size-8',
      default: 'size-12',
      lg: 'size-16',
      xl: 'size-24',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

type LogoProps = React.ComponentProps<'svg'> &
  VariantProps<typeof logoVariants> & {
    label?: string
    /** Render all fills as `currentColor` so the logo color is controlled via CSS `text-*` classes. */
    mono?: boolean
  }

function Logo({ className, size, label, mono = false, ...props }: LogoProps) {
  return (
    <svg
      data-slot='logo'
      xmlns='http://www.w3.org/2000/svg'
      viewBox={LOGO_VIEWBOX}
      fill='none'
      aria-hidden={label ? undefined : 'true'}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={cn(logoVariants({ size }), className)}
      {...props}>
      {LOGO_PATHS.map((p, index) => (
        <path
          key={p.d}
          d={p.d}
          fill={mono ? 'currentColor' : p.fill}
          // In mono mode the sheet stays solid and its details are lighter.
          fillOpacity={mono && index > 0 ? 0.35 : undefined}
        />
      ))}
    </svg>
  )
}

export { Logo, LOGO_PATHS, LOGO_SQUARE_VIEWBOX, LOGO_VIEWBOX, logoVariants }
export type { LogoProps }
