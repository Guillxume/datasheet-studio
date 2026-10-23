'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Progress } from './progress'

const TIMEOUT_MS = 8_000

type GlobalLoadingContextValue = {
  isLoading: boolean
  startLoading: () => void
  stopLoading: () => void
}

const GlobalLoadingContext = createContext<GlobalLoadingContextValue>({
  isLoading: false,
  startLoading: () => {},
  stopLoading: () => {},
})

export const useGlobalLoading = () => useContext(GlobalLoadingContext)

const isInternalLink = (anchor: HTMLAnchorElement): boolean => {
  if (anchor.target === '_blank' || anchor.hasAttribute('download'))
    return false
  if (!anchor.href) return false

  try {
    const url = new URL(anchor.href, window.location.origin)
    if (url.origin !== window.location.origin) return false
    const current = window.location
    if (url.pathname === current.pathname && url.search === current.search)
      return false
    return true
  } catch {
    return false
  }
}

const hasModifierKey = (e: MouseEvent): boolean =>
  e.metaKey || e.ctrlKey || e.shiftKey || e.altKey

const GlobalLoadingBar = ({ isLoading }: { isLoading: boolean }) => {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: visible is read but should not re-trigger the effect
  useEffect(() => {
    if (isLoading) {
      setProgress(0)
      setVisible(true)

      // Animate: fast start, slowing down toward 80%
      const start = Date.now()
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - start
        // Asymptotic curve approaching 80
        setProgress(80 * (1 - Math.exp(-elapsed / 2000)))
      }, 50)
    } else if (visible) {
      if (intervalRef.current) clearInterval(intervalRef.current)

      // Jump to 100%, then fade out
      setProgress(100)
      const timeout = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 200)
      return () => clearTimeout(timeout)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isLoading])

  if (!visible) return null

  return (
    <Progress
      value={progress}
      aria-hidden='true'
      className='bg-primary/10 fixed top-0 left-0 z-50 h-0.5 w-full rounded-none motion-reduce:transition-none [&>[data-slot=progress-indicator]]:duration-200'
    />
  )
}

/** Calls stopLoading when pathname or searchParams change (navigation completed). */
const RouteChangeListener = ({ stopLoading }: { stopLoading: () => void }) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname and searchParams intentionally trigger this effect on route change
  useEffect(() => {
    stopLoading()
  }, [pathname, searchParams, stopLoading])

  return null
}

export const GlobalLoadingProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const countRef = useRef(1)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const startLoading = useCallback(() => {
    countRef.current++
    setIsLoading(true)

    // Safety timeout to prevent stuck bars
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      countRef.current = 0
      setIsLoading(false)
    }, TIMEOUT_MS)
  }, [])

  const stopLoading = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1)
    if (countRef.current === 0) {
      setIsLoading(false)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Delegating click listener to detect internal link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (hasModifierKey(e)) return

      const anchor = (e.target as HTMLElement).closest?.('a')
      if (!anchor || !isInternalLink(anchor)) return

      startLoading()
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () =>
      document.removeEventListener('click', handleClick, { capture: true })
  }, [startLoading])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <GlobalLoadingContext value={{ isLoading, startLoading, stopLoading }}>
      <Suspense>
        <RouteChangeListener stopLoading={stopLoading} />
      </Suspense>
      <GlobalLoadingBar isLoading={isLoading} />
      {children}
    </GlobalLoadingContext>
  )
}
