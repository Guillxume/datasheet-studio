'use client'

import { AlertCircleIcon, Loader2Icon } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'

import type { FilePreviewContentLabels } from './file-preview-content'

const FilePreviewContent = lazy(() =>
  import('./file-preview-content').then(mod => ({
    default: mod.FilePreviewContent,
  })),
)

type FilePreviewDialogLabels = FilePreviewContentLabels & {
  loading?: string
  error?: string
  notFound?: string
  retry?: string
}

const isNotFoundError = (e: unknown): boolean =>
  !!e && typeof e === 'object' && 'status' in e && e.status === 404

interface FilePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: () => Promise<Blob>
  contentType?: string
  fileName?: string
  title?: string
  labels?: FilePreviewDialogLabels
}

const FilePreviewDialog = ({
  open,
  onOpenChange,
  src,
  contentType: contentTypeProp,
  fileName,
  title,
  labels,
}: FilePreviewDialogProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [detectedType, setDetectedType] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [contentMaxWidth, setContentMaxWidth] = useState<number | undefined>(
    undefined,
  )
  const blobUrlRef = useRef<string | null>(null)
  const srcRef = useRef(src)
  srcRef.current = src

  const contentType = contentTypeProp ?? detectedType

  const cleanup = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setBlobUrl(null)
    setDetectedType('')
    setError(false)
    setNotFound(false)
    setContentMaxWidth(undefined)
  }, [])

  const fetchBlob = useCallback(async () => {
    cleanup()
    setLoading(true)
    setError(false)
    setNotFound(false)
    try {
      const blob = await srcRef.current()
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      setBlobUrl(url)
      setDetectedType(blob.type)
    } catch (e) {
      setError(true)
      setNotFound(isNotFoundError(e))
    } finally {
      setLoading(false)
    }
  }, [cleanup])

  useEffect(() => {
    if (open) {
      fetchBlob()
    } else {
      cleanup()
    }
  }, [open, fetchBlob, cleanup])

  const handleDownload = useCallback(() => {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName ?? 'file'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [blobUrl, fileName])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='overflow-hidden sm:max-w-[90vw] md:max-w-[85vw]'
        style={contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined}>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}

        {loading && (
          <div className='flex min-h-[300px] items-center justify-center'>
            <Loader2Icon className='text-muted-foreground size-8 animate-spin' />
          </div>
        )}

        {error && (
          <div className='flex min-h-[300px] flex-col items-center justify-center gap-3'>
            <AlertCircleIcon className='text-muted-foreground size-8' />
            <p className='text-muted-foreground text-sm'>
              {notFound
                ? (labels?.notFound ?? 'File not found')
                : (labels?.error ?? 'Failed to load preview')}
            </p>
            {!notFound && (
              <Button variant='outline' size='sm' onClick={fetchBlob}>
                {labels?.retry ?? 'Retry'}
              </Button>
            )}
          </div>
        )}

        {blobUrl && !loading && !error && contentType && (
          <Suspense fallback={null}>
            <FilePreviewContent
              blobUrl={blobUrl}
              contentType={contentType}
              onDownload={handleDownload}
              onContentWidth={setContentMaxWidth}
              labels={labels}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { FilePreviewDialog }
export type { FilePreviewDialogProps, FilePreviewDialogLabels }
