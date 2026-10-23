import { z } from 'zod'
import type {
  ColumnFiltersState,
  FilterValueMap,
  SortingState,
} from '../../components/data-table'
import type { FilterParamConfig } from '../use-data-table-url-state'

const nonEmptyStringSchema = z.string().min(1)
const facetedSchema = z.array(nonEmptyStringSchema).nonempty()
const finiteNumberSchema = z.number()
const isoDateSchema = z.iso.datetime()

export const parseSortingParam = (sort: string | null): SortingState => {
  if (!sort) return []
  return sort.split(',').reduce<SortingState>((acc, segment) => {
    const lastDot = segment.lastIndexOf('.')
    if (lastDot === -1) return acc
    const id = segment.slice(0, lastDot)
    const dir = segment.slice(lastDot + 1)
    if (id && (dir === 'asc' || dir === 'desc')) {
      acc.push({ id, desc: dir === 'desc' })
    }
    return acc
  }, [])
}

export const serializeSorting = (sorting: SortingState): string | null => {
  if (sorting.length === 0) return null
  return sorting.map(s => `${s.id}.${s.desc ? 'desc' : 'asc'}`).join(',')
}

export const urlStateToColumnFilters = (
  urlState: Record<string, unknown>,
  config: FilterParamConfig,
): ColumnFiltersState => {
  const filters: ColumnFiltersState = []

  for (const [columnId, filterConfig] of Object.entries(config)) {
    const paramName = filterConfig.paramName ?? columnId

    switch (filterConfig.type) {
      case 'faceted': {
        const result = facetedSchema.safeParse(urlState[paramName])
        if (result.success) {
          filters.push({ id: columnId, value: result.data })
        }
        break
      }
      case 'number': {
        const min = finiteNumberSchema.safeParse(urlState[`${paramName}_min`])
        const max = finiteNumberSchema.safeParse(urlState[`${paramName}_max`])
        if (min.success || max.success) {
          filters.push({
            id: columnId,
            value: [
              min.success ? min.data : undefined,
              max.success ? max.data : undefined,
            ],
          })
        }
        break
      }
      case 'date': {
        const from = isoDateSchema.safeParse(urlState[`${paramName}_from`])
        const to = isoDateSchema.safeParse(urlState[`${paramName}_to`])
        if (from.success || to.success) {
          filters.push({
            id: columnId,
            value: [
              from.success ? from.data : undefined,
              to.success ? to.data : undefined,
            ],
          })
        }
        break
      }
      case 'switch': {
        if (urlState[paramName] === true) {
          filters.push({ id: columnId, value: true })
        }
        break
      }
    }
  }

  return filters
}

export const columnFiltersToUrlState = (
  filters: ColumnFiltersState,
  config: FilterParamConfig,
): Record<string, unknown> => {
  // Start with all filter params set to null (clear everything)
  const updates: Record<string, unknown> = {}

  for (const [columnId, filterConfig] of Object.entries(config)) {
    const paramName = filterConfig.paramName ?? columnId
    switch (filterConfig.type) {
      case 'faceted':
        updates[paramName] = null
        break
      case 'number':
        updates[`${paramName}_min`] = null
        updates[`${paramName}_max`] = null
        break
      case 'date':
        updates[`${paramName}_from`] = null
        updates[`${paramName}_to`] = null
        break
      case 'switch':
        updates[paramName] = null
        break
    }
  }

  // Set values from the new filters
  for (const filter of filters) {
    const filterConfig = config[filter.id]
    if (!filterConfig) continue

    const paramName = filterConfig.paramName ?? filter.id

    switch (filterConfig.type) {
      case 'faceted': {
        const value = filter.value as FilterValueMap['faceted']
        updates[paramName] = value.length > 0 ? value : null
        break
      }
      case 'number': {
        const [min, max] = filter.value as FilterValueMap['number']
        updates[`${paramName}_min`] = min ?? null
        updates[`${paramName}_max`] = max ?? null
        break
      }
      case 'date': {
        const [from, to] = filter.value as FilterValueMap['date']
        updates[`${paramName}_from`] = from ?? null
        updates[`${paramName}_to`] = to ?? null
        break
      }
      case 'switch': {
        updates[paramName] = filter.value === true ? true : null
        break
      }
    }
  }

  return updates
}
