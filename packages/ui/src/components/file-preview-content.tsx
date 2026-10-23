'use client'

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { cn } from '../lib/utils'
import { Button } from './button'

// Configure worker via CDN to avoid pnpm hoisting issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const ZOOM_STEPS = [1, 1.25, 1.5, 2]
const DEFAULT_ZOOM_INDEX = 0 // 100% = fit

type FilePreviewContentLabels = {
  download?: string
  zoomIn?: string
  zoomOut?: string
  fitWidth?: string
  previousPage?: string
  nextPage?: string
  page?: (pageNumber: number, totalPages: number) => string
}

const defaultLabels: Required<FilePreviewContentLabels> = {
  download: 'Download',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fitWidth: 'Fit width',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  page: (pageNumber, totalPages) => `Page ${pageNumber} of ${totalPages}`,
}

/** Hook for drag-to-pan on a scrollable container */
const useDragToPan = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      e.preventDefault()
      setIsDragging(true)
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      }
    },
    [containerRef],
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      el.scrollLeft = dragStart.current.scrollLeft - dx
      el.scrollTop = dragStart.current.scrollTop - dy
    }

    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, containerRef])

  return { isDragging, handleMouseDown }
}

// Dialog horizontal padding (p-6 = 48px) + borders (2px)
const DIALOG_PADDING = 50

const PdfViewer = ({
  blobUrl,
  onDownload,
  onContentWidth,
  labels,
}: {
  blobUrl: string
  onDownload: () => void
  onContentWidth?: (width: number | undefined) => void
  labels: Required<FilePreviewContentLabels>
}) => {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [fitMode, setFitMode] = useState(true)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState<{
    w: number
    h: number
  } | null>(null)
  const [lockedHeight, setLockedHeight] = useState<number | undefined>(
    undefined,
  )
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }))
  const { isDragging, handleMouseDown } = useDragToPan(containerRef)

  const memoBlobUrl = useMemo(() => blobUrl, [blobUrl])

  // Track viewport for fit calculation (computed from viewport, not container,
  // to avoid circular dependency: container → page → dialog → container)
  useEffect(() => {
    const handleResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Capture page intrinsic dimensions (fires before canvas render)
  const onPageLoadSuccess = useCallback(
    (page: {
      getViewport: (params: { scale: number }) => {
        width: number
        height: number
      }
    }) => {
      const vp = page.getViewport({ scale: 1 })
      setPageSize(prev => {
        if (prev && prev.w === vp.width && prev.h === vp.height) return prev
        return { w: vp.width, h: vp.height }
      })
    },
    [],
  )

  // Page width that fits both viewport width (~85vw) and height (~75vh)
  const fitPageWidth = useMemo(() => {
    if (!pageSize) return undefined
    const maxW = viewport.w * 0.85 - DIALOG_PADDING
    const maxH = viewport.h * 0.75
    const fitScale = Math.min(maxW / pageSize.w, maxH / pageSize.h)
    return Math.floor(pageSize.w * fitScale)
  }, [pageSize, viewport])

  // Before page dimensions are known, use viewport-based fallback
  const fallbackWidth = useMemo(
    () => Math.floor(viewport.w * 0.85 - DIALOG_PADDING),
    [viewport],
  )

  // Report content width to parent dialog for dynamic max-width
  useEffect(() => {
    onContentWidth?.(fitPageWidth ? fitPageWidth + DIALOG_PADDING : undefined)
  }, [fitPageWidth, onContentWidth])

  // Lock container height in fit mode (used to constrain scroll area when zoomed)
  useEffect(() => {
    if (fitMode && fitPageWidth && numPages > 0) {
      requestAnimationFrame(() => {
        const el = containerRef.current
        if (el) setLockedHeight(el.clientHeight)
      })
    }
  }, [fitMode, fitPageWidth, numPages])

  const onDocLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total)
      setPageNumber(1)
    },
    [],
  )

  const isMultiPage = numPages > 1
  const canZoomIn = zoomIndex < ZOOM_STEPS.length - 1
  const canZoomOut = zoomIndex > DEFAULT_ZOOM_INDEX
  // scale=1 means "fit" (page rendered at fitPageWidth). Zoom steps multiply on top.
  const scale = fitMode ? 1 : ZOOM_STEPS[zoomIndex]
  const isZoomed = !fitMode && scale > 1
  const pageWidth = fitPageWidth ?? fallbackWidth

  const handleZoomIn = useCallback(() => {
    if (fitMode) {
      setFitMode(false)
      setZoomIndex(DEFAULT_ZOOM_INDEX + 1)
    } else {
      setZoomIndex(i => Math.min(ZOOM_STEPS.length - 1, i + 1))
    }
  }, [fitMode])

  const handleZoomOut = useCallback(() => {
    setZoomIndex(i => Math.max(DEFAULT_ZOOM_INDEX, i - 1))
  }, [])

  const handleFit = useCallback(() => {
    setFitMode(true)
    setZoomIndex(DEFAULT_ZOOM_INDEX)
    setLockedHeight(undefined)
  }, [])

  return (
    <div className='flex flex-col gap-2 overflow-x-hidden'>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: role and onMouseDown are conditionally set when isZoomed */}
      <div
        role={isZoomed ? 'application' : undefined}
        ref={containerRef}
        onMouseDown={isZoomed ? handleMouseDown : undefined}
        style={isZoomed && lockedHeight ? { height: lockedHeight } : undefined}
        className={cn(
          'bg-muted/30 max-h-[75vh] rounded-md border',
          isZoomed ? 'overflow-auto' : 'overflow-hidden',
          isZoomed && !isDragging && 'cursor-grab',
          isDragging && 'cursor-grabbing select-none',
        )}>
        {/* react-pdf 11 suspends by default; keep the inline loading/error
            props so a page change doesn't blank the dialog via a boundary. */}
        <Document
          file={memoBlobUrl}
          onLoadSuccess={onDocLoadSuccess}
          loading={null}
          suspense={false}>
          <Page
            pageNumber={pageNumber}
            width={pageWidth}
            scale={scale}
            onLoadSuccess={onPageLoadSuccess}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>

      {/* Toolbar — below content for mobile UX */}
      <div className='bg-muted/50 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2'>
        {isMultiPage ? (
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='size-7'
              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              aria-label={labels.previousPage}>
              <ChevronLeftIcon className='size-4' />
            </Button>
            <span className='text-muted-foreground min-w-[100px] text-center text-xs'>
              {labels.page(pageNumber, numPages)}
            </span>
            <Button
              variant='ghost'
              size='icon'
              className='size-7'
              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              aria-label={labels.nextPage}>
              <ChevronRightIcon className='size-4' />
            </Button>
          </div>
        ) : (
          <div />
        )}

        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='icon'
            className='size-7'
            onClick={handleZoomOut}
            disabled={fitMode || !canZoomOut}
            aria-label={labels.zoomOut}>
            <MinusIcon className='size-4' />
          </Button>
          <span className='text-muted-foreground min-w-[40px] text-center text-xs'>
            {`${Math.round(scale * 100)}%`}
          </span>
          <Button
            variant='ghost'
            size='icon'
            className='size-7'
            onClick={handleZoomIn}
            disabled={!fitMode && !canZoomIn}
            aria-label={labels.zoomIn}>
            <PlusIcon className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='size-7'
            onClick={handleFit}
            disabled={fitMode}
            aria-label={labels.fitWidth}>
            <RotateCcwIcon className='size-4' />
          </Button>
        </div>

        <Button
          variant='ghost'
          size='sm'
          className='h-7 text-xs'
          onClick={onDownload}>
          <DownloadIcon className='mr-1 size-3' />
          {labels.download}
        </Button>
      </div>
    </div>
  )
}

const ImageViewer = ({
  blobUrl,
  onDownload,
  labels,
}: {
  blobUrl: string
  onDownload: () => void
  labels: Required<FilePreviewContentLabels>
}) => (
  <div className='flex min-h-0 flex-1 flex-col gap-2'>
    <div className='flex flex-1 items-center justify-center overflow-auto rounded-md border'>
      {/* biome-ignore lint/performance/noImgElement: blob URL preview — next/image doesn't support blob URLs */}
      <img
        src={blobUrl}
        alt=''
        className='max-h-full max-w-full object-contain'
      />
    </div>
    <div className='bg-muted/50 flex shrink-0 justify-end rounded-md px-3 py-2'>
      <Button
        variant='ghost'
        size='sm'
        className='h-7 text-xs'
        onClick={onDownload}>
        <DownloadIcon className='mr-1 size-3' />
        {labels.download}
      </Button>
    </div>
  </div>
)

export const FilePreviewContent = ({
  blobUrl,
  contentType,
  onDownload,
  onContentWidth,
  labels: userLabels,
}: {
  blobUrl: string
  contentType: string
  onDownload: () => void
  onContentWidth?: (width: number | undefined) => void
  labels?: FilePreviewContentLabels
}) => {
  const labels = { ...defaultLabels, ...userLabels }
  const isPdf = contentType === 'application/pdf'

  if (isPdf) {
    return (
      <PdfViewer
        blobUrl={blobUrl}
        onDownload={onDownload}
        onContentWidth={onContentWidth}
        labels={labels}
      />
    )
  }

  return (
    <ImageViewer blobUrl={blobUrl} onDownload={onDownload} labels={labels} />
  )
}

export type { FilePreviewContentLabels }
