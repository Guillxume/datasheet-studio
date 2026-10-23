'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from 'react'

type DataTableFilterInteractionContextValue = {
  /** Called when a filter control opens (`true`) or closes (`false`). */
  onFilterOpenChange: (filterId: string, open: boolean) => void
}

const DataTableFilterInteractionContext =
  createContext<DataTableFilterInteractionContextValue | null>(null)

type DataTableFilterInteractionProviderProps =
  DataTableFilterInteractionContextValue & {
    children: ReactNode
  }

/**
 * Reports when a filter control is opened or closed.
 *
 * Filter controls write to the table on every interaction, so a consumer that
 * only watches the committed filter state cannot tell a finished selection
 * from an intermediate one: ticking three boxes in a faceted filter commits
 * three times. This context surfaces the missing signal — the popover closing
 * is the point at which the selection is final.
 *
 * The context is deliberately not analytics-specific, and it is optional:
 * without a provider the filter components behave exactly as before, so an app
 * that does not need the signal carries none of it.
 */
export const DataTableFilterInteractionProvider = ({
  onFilterOpenChange,
  children,
}: DataTableFilterInteractionProviderProps) => {
  const value = useMemo(() => ({ onFilterOpenChange }), [onFilterOpenChange])

  return (
    <DataTableFilterInteractionContext.Provider value={value}>
      {children}
    </DataTableFilterInteractionContext.Provider>
  )
}

/**
 * Returns a reporter for one filter control's open state.
 *
 * Resolves to a no-op when no provider is mounted or the control has no
 * resolvable id, so call sites can wire it unconditionally.
 */
export const useFilterInteractionReporter = (
  filterId: string | undefined,
): ((open: boolean) => void) => {
  const context = useContext(DataTableFilterInteractionContext)

  return useCallback(
    (open: boolean) => {
      if (!context || !filterId) return
      context.onFilterOpenChange(filterId, open)
    },
    [context, filterId],
  )
}
