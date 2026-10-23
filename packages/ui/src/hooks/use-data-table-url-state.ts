'use client'

import type React from 'react'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs'
import { useCallback, useMemo, useRef } from 'react'
import type {
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
  SortingState,
} from '../components/data-table'
import type { DisplayMode } from './use-settings'
import {
  columnFiltersToUrlState,
  parseSortingParam,
  serializeSorting,
  urlStateToColumnFilters,
} from './__internal__/data-table-url-helpers'

type FilterParamType = 'faceted' | 'number' | 'date' | 'switch'

type FilterParamConfig = Record<
  string,
  {
    type: FilterParamType
    /** Custom URL param name. Defaults to the column ID. */
    paramName?: string
  }
>

type DataTableFilterPreset = {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  filters: () => ColumnFiltersState
}

type UseDataTableUrlStateOptions = {
  /** Map of column IDs to their filter type for URL serialization. */
  filters?: FilterParamConfig
  /** Default page size (default: 30). */
  defaultPageSize?: number
  /** Default sorting state when no sort param is in the URL. */
  defaultSorting?: SortingState
  /** nuqs history mode: 'replace' (default) or 'push'. */
  historyMode?: 'push' | 'replace'
  /** Default search column ID when none is in the URL. */
  defaultSearchColumn?: string
  /** Default display mode when no `display` param is in the URL (e.g. from localStorage). */
  defaultDisplayMode?: string
  /** Predefined filter presets. When a preset is active, its filters replace all manual filters. */
  presets?: DataTableFilterPreset[]
}

type UseDataTableUrlStateReturn = {
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  columnFilters: ColumnFiltersState
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  search: string
  searchColumn: string
  onSearchChange: (value: string) => void
  onSearchColumnChange: (columnId: string) => void
  displayMode: DisplayMode
  onDisplayModeChange: (mode: DisplayMode) => void
  preset: string | null
  onPresetChange: (presetId: string | null) => void
}

// biome-ignore lint/suspicious/noExplicitAny: nuqs parsers have complex generics that vary per type — dynamic map requires any
type ParserMap = Record<string, any>

const buildParsers = (
  filters: FilterParamConfig,
  defaultPageSize: number,
): ParserMap => {
  const parsers: ParserMap = {
    page: parseAsInteger,
    pageSize: parseAsInteger.withDefault(defaultPageSize),
    sort: parseAsString,
    q: parseAsString,
    qc: parseAsString,
    display: parseAsString,
    preset: parseAsString,
  }

  for (const [columnId, config] of Object.entries(filters)) {
    const name = config.paramName ?? columnId
    switch (config.type) {
      case 'faceted':
        parsers[name] = parseAsArrayOf(parseAsString, ',')
        break
      case 'number':
        parsers[`${name}_min`] = parseAsFloat
        parsers[`${name}_max`] = parseAsFloat
        break
      case 'date':
        parsers[`${name}_from`] = parseAsString
        parsers[`${name}_to`] = parseAsString
        break
      case 'switch':
        parsers[name] = parseAsBoolean
        break
    }
  }

  return parsers
}

/** Resolve a TanStack Table updater (value or callback) to a value. */
const resolveUpdater = <T>(updater: T | ((old: T) => T), prev: T): T =>
  typeof updater === 'function' ? (updater as (old: T) => T)(prev) : updater

const EMPTY_SORTING: SortingState = []
const EMPTY_FILTERS: FilterParamConfig = {}
const EMPTY_COLUMN_FILTERS: ColumnFiltersState = []

const useDataTableUrlState = (
  options: UseDataTableUrlStateOptions,
): UseDataTableUrlStateReturn => {
  const {
    filters = EMPTY_FILTERS,
    defaultPageSize = 30,
    defaultSorting = EMPTY_SORTING,
    defaultSearchColumn = '',
    defaultDisplayMode = 'table',
    historyMode = 'replace',
  } = options

  // Stable memoization key for the config object
  const configKey = JSON.stringify({ filters, defaultPageSize })

  // biome-ignore lint/correctness/useExhaustiveDependencies: configKey serializes the deps
  const parsers = useMemo(
    () => buildParsers(filters, defaultPageSize),
    [configKey],
  )

  const [urlState, setUrlState] = useQueryStates(parsers, {
    history: historyMode,
  })

  // --- Derive TanStack Table state from URL ---

  // Single typed extraction of base URL state keys (nuqs parsers guarantee these shapes)
  const {
    page,
    pageSize: urlPageSize,
    sort,
    q,
    qc,
    display,
    preset: urlPreset,
    ...filterUrlState
  } = urlState as {
    page: number | null
    pageSize: number
    sort: string | null
    q: string | null
    qc: string | null
    display: string | null
    preset: string | null
    [key: string]: unknown
  }

  // URL uses 1-indexed pages (?page=2), TanStack Table uses 0-indexed (pageIndex: 1)
  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: Math.max((page ?? 1) - 1, 0),
      pageSize: urlPageSize ?? defaultPageSize,
    }),
    [page, urlPageSize, defaultPageSize],
  )

  const sorting: SortingState = useMemo(() => {
    const parsed = parseSortingParam(sort)
    return parsed.length > 0 ? parsed : defaultSorting
  }, [sort, defaultSorting])

  // biome-ignore lint/correctness/useExhaustiveDependencies: configKey stabilizes filters
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const result = urlStateToColumnFilters(filterUrlState, filters)
    return result.length === 0 ? EMPTY_COLUMN_FILTERS : result
  }, [urlState, configKey])

  // Use refs so callbacks don't close over stale state
  const stateRef = useRef({ pagination, sorting, columnFilters })
  stateRef.current = { pagination, sorting, columnFilters }

  const onPaginationChange: OnChangeFn<PaginationState> = useCallback(
    updater => {
      const next = resolveUpdater(updater, stateRef.current.pagination)
      // Convert 0-indexed pageIndex to 1-indexed URL param; page 1 is omitted
      const urlPage = next.pageIndex + 1
      setUrlState({
        page: urlPage <= 1 ? null : urlPage,
        pageSize: next.pageSize === defaultPageSize ? null : next.pageSize,
      })
    },
    [setUrlState, defaultPageSize],
  )

  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    updater => {
      const prev = stateRef.current.sorting
      const next = resolveUpdater(updater, prev)
      // Only reset page when sorting actually changed (TanStack may fire this on mount)
      const changed =
        prev.length !== next.length ||
        prev.some((s, i) => s.id !== next[i]?.id || s.desc !== next[i]?.desc)
      setUrlState({
        sort: serializeSorting(next),
        ...(changed ? { page: null } : {}),
      })
    },
    [setUrlState],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: configKey stabilizes filters
  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
    updater => {
      const prev = stateRef.current.columnFilters
      const next = resolveUpdater(updater, prev)
      // Only reset page when filters actually changed (TanStack may fire this on mount)
      const changed = JSON.stringify(prev) !== JSON.stringify(next)
      setUrlState({
        ...columnFiltersToUrlState(next, filters),
        ...(changed ? { page: null, preset: null } : {}),
      })
    },
    [setUrlState, configKey],
  )

  const displayMode = (display ?? defaultDisplayMode) as DisplayMode

  const preset = urlPreset ?? null

  const onDisplayModeChange = useCallback(
    (mode: DisplayMode) => {
      setUrlState({ display: mode === defaultDisplayMode ? null : mode })
    },
    [setUrlState, defaultDisplayMode],
  )

  const search = q ?? ''
  const searchColumn = qc ?? defaultSearchColumn

  const onSearchChange = useCallback(
    (value: string) => {
      setUrlState({
        q: value || null,
        page: null,
      })
    },
    [setUrlState],
  )

  const onSearchColumnChange = useCallback(
    (columnId: string) => {
      setUrlState({
        qc: columnId || null,
        page: null,
      })
    },
    [setUrlState],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: configKey stabilizes filters
  const onPresetChange = useCallback(
    (presetId: string | null) => {
      const { presets: presetDefs = [] } = options
      const presetDef = presetId
        ? presetDefs.find(p => p.id === presetId)
        : undefined
      const presetFilters = presetDef ? presetDef.filters() : []

      setUrlState({
        ...columnFiltersToUrlState(presetFilters, filters),
        preset: presetId,
        q: null,
        qc: null,
        page: null,
      })
    },
    [setUrlState, options, configKey],
  )

  return {
    pagination,
    onPaginationChange,
    sorting,
    onSortingChange,
    columnFilters,
    onColumnFiltersChange,
    search,
    searchColumn,
    onSearchChange,
    onSearchColumnChange,
    displayMode,
    onDisplayModeChange,
    preset,
    onPresetChange,
  }
}

export { useDataTableUrlState }
export type {
  DataTableFilterPreset,
  FilterParamConfig,
  FilterParamType,
  UseDataTableUrlStateOptions,
  UseDataTableUrlStateReturn,
}
