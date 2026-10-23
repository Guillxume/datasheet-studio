'use client'

import { MinusIcon, PlusIcon } from 'lucide-react'
import * as React from 'react'
import { type Options as MaskOptions, withMask } from 'use-mask-input'

import { cn } from '../lib/utils'

interface InputProps extends React.ComponentProps<'input'> {
  characterLimit?: number
  numberStepper?: boolean
  mask?: string | string[]
  maskOptions?: MaskOptions
  labels?: {
    decrease?: string
    increase?: string
    warning?: string
    charactersRemaining?: string
  }
}

function Input({
  className,
  type,
  characterLimit,
  numberStepper,
  mask,
  maskOptions,
  labels,
  onChange,
  maxLength,
  ...props
}: InputProps) {
  if (numberStepper && mask) {
    throw new Error(
      'Input: "numberStepper" and "mask" are mutually exclusive. ' +
        'mask replaces the internal ref that numberStepper relies on for stepUp/stepDown.',
    )
  }

  const initialValue = props.value ?? props.defaultValue
  const initialLength =
    typeof initialValue === 'string' ? initialValue.length : 0
  const [length, setLength] = React.useState(initialLength)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const charCountId = React.useId()

  React.useEffect(() => {
    if (typeof props.value === 'string') {
      setLength(props.value.length)
    } else if (typeof props.defaultValue === 'string') {
      setLength(props.defaultValue.length)
    }
  }, [props.value, props.defaultValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLength(e.target.value.length)
    onChange?.(e)
  }

  const stepValue = (direction: 'up' | 'down') => {
    const el = inputRef.current
    if (!el) return
    if (direction === 'up') el.stepUp()
    else el.stepDown()
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const remaining =
    characterLimit !== undefined ? characterLimit - length : undefined
  const isNearLimit =
    remaining !== undefined &&
    characterLimit !== undefined &&
    remaining <= Math.ceil(characterLimit * 0.1)

  const input = (
    <input
      ref={mask ? withMask(mask, maskOptions) : inputRef}
      type={numberStepper ? 'number' : type}
      data-slot='input'
      aria-describedby={characterLimit !== undefined ? charCountId : undefined}
      maxLength={characterLimit ?? maxLength}
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-muted read-only:border-dashed read-only:opacity-50 read-only:cursor-not-allowed read-only:focus-visible:border-input read-only:focus-visible:ring-0 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        numberStepper &&
          'rounded-none border-x-0 text-center shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className,
      )}
      onChange={handleChange}
      {...props}
    />
  )

  if (numberStepper) {
    const numValue =
      typeof props.value === 'number'
        ? props.value
        : typeof props.value === 'string'
          ? Number(props.value)
          : undefined
    const atMin =
      numValue !== undefined && props.min !== undefined
        ? numValue <= Number(props.min)
        : false
    const atMax =
      numValue !== undefined && props.max !== undefined
        ? numValue >= Number(props.max)
        : false

    return (
      <div data-slot='input-number' className='flex items-center'>
        <button
          type='button'
          className='border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-l-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50'
          disabled={props.disabled || atMin}
          onClick={() => stepValue('down')}
          aria-label={labels?.decrease ?? 'Decrease'}>
          <MinusIcon className='size-4' />
        </button>
        {input}
        <button
          type='button'
          className='border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-r-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50'
          disabled={props.disabled || atMax}
          onClick={() => stepValue('up')}
          aria-label={labels?.increase ?? 'Increase'}>
          <PlusIcon className='size-4' />
        </button>
      </div>
    )
  }

  if (characterLimit !== undefined) {
    return (
      <div data-slot='input-character-limit'>
        {input}
        <p
          id={charCountId}
          aria-live='polite'
          className={cn(
            'text-muted-foreground mt-1.5 text-xs',
            isNearLimit && 'text-destructive',
          )}>
          {isNearLimit &&
            (labels?.warning ? `${labels.warning} ` : 'Warning: ')}
          {remaining} {labels?.charactersRemaining ?? 'characters remaining'}
        </p>
      </div>
    )
  }

  return input
}

export { Input }
export type { InputProps }
