'use client'

import {
  AlertCircleIcon,
  CheckIcon,
  Loader2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '../components/button'
import { cn } from '../lib/utils'

type FileEntryStatus = 'uploading' | 'uploaded' | 'failed'

type FileEntry = {
  id: string
  file: File
  status: FileEntryStatus
  serverData?: unknown
  error?: string
}

interface InputFileProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  /** Called per file on selection. Spinner while pending, checkmark on resolve, error icon on reject. */
  onFileAdded: (file: File) => Promise<unknown>
  /** Called when user removes an uploaded file. Optimistic remove; re-adds on rejection. */
  onFileRemoved?: (file: File, serverData: unknown) => Promise<void>
  labels?: {
    chooseFile?: string
    clickToUpload?: string
    orDragAndDrop?: string
    remove?: string
    retry?: string
  }
}

function InputFile({
  className,
  accept,
  multiple,
  disabled,
  onFileAdded,
  onFileRemoved,
  labels,
  ...props
}: InputFileProps) {
  const generatedId = React.useId()
  const [isDragging, setIsDragging] = React.useState(false)
  const [entries, setEntries] = React.useState<FileEntry[]>([])
  const entryIdCounter = React.useRef(0)

  const addFile = React.useCallback(
    async (file: File) => {
      const id = `file-${++entryIdCounter.current}`
      setEntries(prev => [...prev, { id, file, status: 'uploading' }])

      try {
        const serverData = await onFileAdded(file)
        setEntries(prev =>
          prev.map(e =>
            e.id === id ? { ...e, status: 'uploaded', serverData } : e,
          ),
        )
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Upload failed'
        setEntries(prev =>
          prev.map(e => (e.id === id ? { ...e, status: 'failed', error } : e)),
        )
      }
    },
    [onFileAdded],
  )

  const removeFile = React.useCallback(
    (entry: FileEntry) => {
      if (entry.status === 'uploaded' && onFileRemoved) {
        // Optimistic remove
        setEntries(prev => prev.filter(e => e.id !== entry.id))
        onFileRemoved(entry.file, entry.serverData).catch(() => {
          // Re-add on failure
          setEntries(prev => [...prev, entry])
        })
        return
      }
      // Failed — just remove from list
      setEntries(prev => prev.filter(e => e.id !== entry.id))
    },
    [onFileRemoved],
  )

  const retryFile = React.useCallback(
    (entry: FileEntry) => {
      setEntries(prev => prev.filter(e => e.id !== entry.id))
      addFile(entry.file)
    },
    [addFile],
  )

  const matchesAccept = React.useCallback(
    (file: File) => {
      if (!accept) return true
      const tokens = accept.split(',').map(t => t.trim().toLowerCase())
      const fileName = file.name.toLowerCase()
      const fileType = file.type.toLowerCase()
      return tokens.some(token => {
        if (token.startsWith('.')) return fileName.endsWith(token)
        if (token.endsWith('/*')) return fileType.startsWith(token.slice(0, -1))
        return fileType === token
      })
    },
    [accept],
  )

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const incoming = Array.from(fileList).filter(matchesAccept)
    const filesToAdd = multiple ? incoming : incoming.slice(0, 1)
    if (!multiple) {
      setEntries([])
    }
    for (const file of filesToAdd) {
      addFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (!disabled) handleFiles(e.dataTransfer.files)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  // Extract id so we can use it for the label-input association while still
  // forwarding it on the input (for external callers like FormControl).
  const { id: externalId, ...inputProps } = props as {
    id?: string
  } & typeof props
  const inputId = externalId ?? generatedId

  return (
    <div data-slot='input-file' className={cn('space-y-2', className)}>
      {/*
       * Using <label htmlFor> instead of <button onClick={() => ref.click()>:
       * Tailwind 4's sr-only uses clip-path: inset(50%) which reduces the
       * input to a 0×0 effective area. Some browsers (notably Chrome) block
       * programmatic element.click() on clip-path'd file inputs as a security
       * measure. The label→input native activation bypasses this entirely.
       */}
      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label={labels?.chooseFile ?? 'Choose file to upload'}
        className={cn(
          'border-input bg-background flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-4 text-center transition-colors',
          'hover:bg-muted hover:border-muted-foreground/30',
          'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]',
          isDragging && 'border-ring bg-accent/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}>
        <UploadIcon className='text-muted-foreground size-5' />
        <div>
          <span className='text-sm font-medium'>
            {labels?.clickToUpload ?? 'Click to upload'}
          </span>
          <span className='text-muted-foreground text-sm'>
            {' '}
            {labels?.orDragAndDrop ?? 'or drag and drop'}
          </span>
        </div>
        {accept && (
          <span className='text-muted-foreground text-xs'>{accept}</span>
        )}
        <input
          id={inputId}
          type='file'
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleChange}
          className='sr-only'
          {...inputProps}
        />
      </label>
      {entries.length > 0 && (
        <ul aria-live='polite' className='space-y-1'>
          {entries.map(entry => (
            <li
              key={entry.id}
              className='bg-muted flex items-center justify-between rounded-md px-3 py-2'>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2 overflow-hidden'>
                  {entry.status === 'uploading' && (
                    <Loader2Icon className='text-muted-foreground size-4 shrink-0 animate-spin' />
                  )}
                  {entry.status === 'uploaded' && (
                    <CheckIcon className='size-4 shrink-0 text-green-600' />
                  )}
                  {entry.status === 'failed' && (
                    <AlertCircleIcon className='text-destructive size-4 shrink-0' />
                  )}
                  <span className='truncate text-sm'>{entry.file.name}</span>
                </div>
                {entry.status === 'failed' && entry.error && (
                  <p className='text-destructive truncate text-xs'>
                    {entry.error}
                  </p>
                )}
              </div>
              <div className='flex items-center gap-1'>
                {entry.status === 'failed' && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-6 shrink-0'
                    onClick={() => retryFile(entry)}
                    aria-label={labels?.retry ?? 'Retry'}>
                    <UploadIcon className='size-3.5' />
                  </Button>
                )}
                {entry.status !== 'uploading' && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-6 shrink-0'
                    onClick={() => removeFile(entry)}
                    aria-label={`${labels?.remove ?? 'Remove'} ${entry.file.name}`}>
                    <XIcon className='size-3.5' />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { InputFile }
export type { InputFileProps, FileEntry, FileEntryStatus }
