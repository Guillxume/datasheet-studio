'use client'

import * as React from 'react'

import { cn } from '../lib/utils'

interface TextareaProps extends React.ComponentProps<'textarea'> {
  characterLimit?: number
}

function Textarea({
  className,
  characterLimit,
  onChange,
  maxLength,
  ...props
}: TextareaProps) {
  const initialValue = props.value ?? props.defaultValue
  const initialLength =
    typeof initialValue === 'string' ? initialValue.length : 0
  const [length, setLength] = React.useState(initialLength)
  const charCountId = React.useId()

  React.useEffect(() => {
    if (typeof props.value === 'string') {
      setLength(props.value.length)
    }
  }, [props.value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (characterLimit !== undefined) {
      setLength(e.target.value.length)
    }
    onChange?.(e)
  }

  const remaining =
    characterLimit !== undefined ? characterLimit - length : undefined
  const isNearLimit =
    remaining !== undefined &&
    characterLimit !== undefined &&
    remaining <= Math.ceil(characterLimit * 0.1)

  const textarea = (
    <textarea
      data-slot='textarea'
      aria-describedby={characterLimit !== undefined ? charCountId : undefined}
      maxLength={characterLimit ?? maxLength}
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      onChange={handleChange}
      {...props}
    />
  )

  if (characterLimit === undefined) return textarea

  return (
    <div data-slot='textarea-character-limit'>
      {textarea}
      <p
        id={charCountId}
        aria-live='polite'
        className={cn(
          'text-muted-foreground mt-1.5 text-xs',
          isNearLimit && 'text-destructive',
        )}>
        {isNearLimit && 'Warning: '}
        {remaining} characters remaining
      </p>
    </div>
  )
}

export { Textarea }
export type { TextareaProps }
