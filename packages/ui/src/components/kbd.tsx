import { Fragment } from 'react'

import type { Key, Modifier } from '../lib/keyboard'
import { cn } from '../lib/utils'

type KbdProps = {
  keyName: Key
  modifiers?: Modifier[]
  className?: string
}

const MODIFIER_LABELS: Record<Modifier, string> = {
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
}

const kbdStyles =
  'border-border bg-muted text-muted-foreground shadow-border/50 inline-flex items-center justify-center rounded border px-1.5 py-0.5 shadow-[0_1px_0_1px]'

const kbdFontStyles = 'font-sans text-xs leading-none tracking-widest'

const Kbd = ({ keyName, modifiers, className }: KbdProps) => {
  const parts = [
    ...(modifiers ?? []).map(m => MODIFIER_LABELS[m]),
    keyName.toUpperCase(),
  ]

  return (
    <kbd data-slot='kbd' className={cn(kbdStyles, kbdFontStyles, className)}>
      {parts.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && '+'}
          <kbd className='font-[inherit] [font-size:inherit]'>{label}</kbd>
        </Fragment>
      ))}
    </kbd>
  )
}

export { Kbd }
export type { KbdProps }
