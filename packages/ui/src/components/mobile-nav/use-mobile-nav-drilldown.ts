'use client'

import { useCallback, useState } from 'react'
import type { MobileNavItem, MobileNavSubItem } from './types'

type DrilldownState =
  | { level: 0 }
  | { level: 1; item: MobileNavItem }
  | { level: 2; item: MobileNavItem; subItem: MobileNavSubItem }

const useMobileNavDrilldown = () => {
  const [state, setState] = useState<DrilldownState>({ level: 0 })

  const drillInto = useCallback((item: MobileNavItem) => {
    // If all sub-items were filtered out, treat as leaf (no drill-down)
    if (!item.items || item.items.length === 0) return
    setState({ level: 1, item })
  }, [])

  const drillDeeper = useCallback(
    (subItem: MobileNavSubItem) => {
      if (state.level === 1) {
        setState({ level: 2, item: state.item, subItem })
      }
    },
    [state],
  )

  const goBack = useCallback(() => {
    if (state.level === 2) {
      setState({ level: 1, item: state.item })
    } else {
      setState({ level: 0 })
    }
  }, [state])

  const reset = useCallback(() => {
    setState({ level: 0 })
  }, [])

  return { state, drillInto, drillDeeper, goBack, reset } as const
}

export { useMobileNavDrilldown }
export type { DrilldownState }
