import { describe, expect, it } from 'vitest'
import {
  columnFiltersToUrlState,
  parseSortingParam,
  serializeSorting,
  urlStateToColumnFilters,
} from '../__internal__/data-table-url-helpers'
import type { FilterParamConfig } from '../use-data-table-url-state'

describe('parseSortingParam', () => {
  it('returns empty array for null', () => {
    expect(parseSortingParam(null)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseSortingParam('')).toEqual([])
  })

  it('parses a single ascending sort', () => {
    expect(parseSortingParam('name.asc')).toEqual([{ id: 'name', desc: false }])
  })

  it('parses a single descending sort', () => {
    expect(parseSortingParam('date.desc')).toEqual([{ id: 'date', desc: true }])
  })

  it('parses multiple sorts', () => {
    expect(parseSortingParam('name.asc,date.desc')).toEqual([
      { id: 'name', desc: false },
      { id: 'date', desc: true },
    ])
  })

  it('handles dotted column IDs (last dot is the separator)', () => {
    expect(parseSortingParam('nested.field.asc')).toEqual([
      { id: 'nested.field', desc: false },
    ])
  })

  it('skips segments with no dot', () => {
    expect(parseSortingParam('invalid')).toEqual([])
  })

  it('skips segments with invalid direction', () => {
    expect(parseSortingParam('name.up')).toEqual([])
  })
})

describe('serializeSorting', () => {
  it('returns null for empty array', () => {
    expect(serializeSorting([])).toBeNull()
  })

  it('serializes a single ascending sort', () => {
    expect(serializeSorting([{ id: 'name', desc: false }])).toBe('name.asc')
  })

  it('serializes a single descending sort', () => {
    expect(serializeSorting([{ id: 'date', desc: true }])).toBe('date.desc')
  })

  it('serializes multiple sorts', () => {
    expect(
      serializeSorting([
        { id: 'name', desc: false },
        { id: 'date', desc: true },
      ]),
    ).toBe('name.asc,date.desc')
  })
})

describe('parseSortingParam / serializeSorting roundtrip', () => {
  it('roundtrips single sort', () => {
    const original = 'name.asc'
    expect(serializeSorting(parseSortingParam(original))).toBe(original)
  })

  it('roundtrips multi sort', () => {
    const original = 'name.asc,date.desc'
    expect(serializeSorting(parseSortingParam(original))).toBe(original)
  })
})

describe('urlStateToColumnFilters', () => {
  it('parses faceted filter', () => {
    const config: FilterParamConfig = { status: { type: 'faceted' } }
    const urlState = { status: ['pending', 'shipped'] }
    expect(urlStateToColumnFilters(urlState, config)).toEqual([
      { id: 'status', value: ['pending', 'shipped'] },
    ])
  })

  it('ignores faceted filter with empty array', () => {
    const config: FilterParamConfig = { status: { type: 'faceted' } }
    const urlState = { status: [] }
    expect(urlStateToColumnFilters(urlState, config)).toEqual([])
  })

  it('parses number filter with min and max', () => {
    const config: FilterParamConfig = { amount: { type: 'number' } }
    const urlState = { amount_min: 10, amount_max: 100 }
    expect(urlStateToColumnFilters(urlState, config)).toEqual([
      { id: 'amount', value: [10, 100] },
    ])
  })

  it('parses number filter with only min', () => {
    const config: FilterParamConfig = { amount: { type: 'number' } }
    const urlState = { amount_min: 10, amount_max: null }
    expect(urlStateToColumnFilters(urlState, config)).toEqual([
      { id: 'amount', value: [10, undefined] },
    ])
  })

  it('parses date filter with from and to', () => {
    const config: FilterParamConfig = { created: { type: 'date' } }
    const urlState = {
      created_from: '2026-01-01T00:00:00Z',
      created_to: '2026-12-31T00:00:00Z',
    }
    expect(urlStateToColumnFilters(urlState, config)).toEqual([
      {
        id: 'created',
        value: ['2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z'],
      },
    ])
  })

  it('parses switch filter', () => {
    const config: FilterParamConfig = { active: { type: 'switch' } }
    const urlState = { active: true }
    expect(urlStateToColumnFilters(urlState, config)).toEqual([
      { id: 'active', value: true },
    ])
  })

  it('ignores switch filter when false', () => {
    const config: FilterParamConfig = { active: { type: 'switch' } }
    const urlState = { active: false }
    expect(urlStateToColumnFilters(urlState, config)).toEqual([])
  })

  it('uses custom paramName', () => {
    const config: FilterParamConfig = {
      status: { type: 'faceted', paramName: 's' },
    }
    const urlState = { s: ['pending'] }
    expect(urlStateToColumnFilters(urlState, config)).toEqual([
      { id: 'status', value: ['pending'] },
    ])
  })
})

describe('columnFiltersToUrlState', () => {
  it('converts faceted filter to url state', () => {
    const config: FilterParamConfig = { status: { type: 'faceted' } }
    const filters = [{ id: 'status', value: ['pending', 'shipped'] }]
    const result = columnFiltersToUrlState(filters, config)
    expect(result.status).toEqual(['pending', 'shipped'])
  })

  it('sets faceted param to null when filter is removed', () => {
    const config: FilterParamConfig = { status: { type: 'faceted' } }
    const result = columnFiltersToUrlState([], config)
    expect(result.status).toBeNull()
  })

  it('converts number filter to min/max url params', () => {
    const config: FilterParamConfig = { amount: { type: 'number' } }
    const filters = [{ id: 'amount', value: [10, 100] }]
    const result = columnFiltersToUrlState(filters, config)
    expect(result.amount_min).toBe(10)
    expect(result.amount_max).toBe(100)
  })

  it('sets number params to null for undefined values', () => {
    const config: FilterParamConfig = { amount: { type: 'number' } }
    const filters = [{ id: 'amount', value: [10, undefined] }]
    const result = columnFiltersToUrlState(filters, config)
    expect(result.amount_min).toBe(10)
    expect(result.amount_max).toBeNull()
  })

  it('converts date filter to from/to url params', () => {
    const config: FilterParamConfig = { created: { type: 'date' } }
    const filters = [
      {
        id: 'created',
        value: ['2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z'],
      },
    ]
    const result = columnFiltersToUrlState(filters, config)
    expect(result.created_from).toBe('2026-01-01T00:00:00Z')
    expect(result.created_to).toBe('2026-12-31T00:00:00Z')
  })

  it('converts switch filter to url state', () => {
    const config: FilterParamConfig = { active: { type: 'switch' } }
    const filters = [{ id: 'active', value: true }]
    const result = columnFiltersToUrlState(filters, config)
    expect(result.active).toBe(true)
  })

  it('sets switch param to null when filter removed', () => {
    const config: FilterParamConfig = { active: { type: 'switch' } }
    const result = columnFiltersToUrlState([], config)
    expect(result.active).toBeNull()
  })

  it('uses custom paramName', () => {
    const config: FilterParamConfig = {
      status: { type: 'faceted', paramName: 's' },
    }
    const filters = [{ id: 'status', value: ['pending'] }]
    const result = columnFiltersToUrlState(filters, config)
    expect(result.s).toEqual(['pending'])
  })
})

describe('urlStateToColumnFilters / columnFiltersToUrlState roundtrip', () => {
  it('roundtrips faceted filters', () => {
    const config: FilterParamConfig = { status: { type: 'faceted' } }
    const original = [{ id: 'status', value: ['pending', 'shipped'] }]
    const urlState = columnFiltersToUrlState(original, config)
    const result = urlStateToColumnFilters(urlState, config)
    expect(result).toEqual(original)
  })

  it('roundtrips number filters', () => {
    const config: FilterParamConfig = { amount: { type: 'number' } }
    const original = [{ id: 'amount', value: [10, 100] }]
    const urlState = columnFiltersToUrlState(original, config)
    const result = urlStateToColumnFilters(urlState, config)
    expect(result).toEqual(original)
  })
})
