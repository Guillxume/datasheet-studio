import { describe, expect, it } from 'vitest'
import { threadMovableOrder } from '../sortable-list'

type Row = { id: string; status: string }
const isFixed = (r: Row) => r.status !== 'pending'

const rows: Row[] = [
  { id: 'd1', status: 'delivered' },
  { id: 'p2', status: 'pending' },
  { id: 'f3', status: 'failed' },
  { id: 'p4', status: 'pending' },
  { id: 'p5', status: 'pending' },
  { id: 'p6', status: 'pending' },
]

describe('threadMovableOrder', () => {
  it('threads moved pending rows through non-fixed slots, pinning fixed rows', () => {
    // Move pending p2 to after pending p5.
    const result = threadMovableOrder(rows, isFixed, 'p2', 'p5')
    expect(result.map(r => r.id)).toEqual(['d1', 'p4', 'f3', 'p5', 'p2', 'p6'])
  })

  it('keeps fixed rows at their absolute index', () => {
    const result = threadMovableOrder(rows, isFixed, 'p6', 'p2')
    // d1 (idx0) and f3 (idx2) must never move.
    expect(result[0].id).toBe('d1')
    expect(result[2].id).toBe('f3')
  })

  it('with no fixed rows behaves like a plain move', () => {
    const flat = rows.map(r => ({ ...r, status: 'pending' }))
    const result = threadMovableOrder(flat, () => false, 'p2', 'p5')
    expect(result.map(r => r.id)).toEqual(['d1', 'f3', 'p4', 'p5', 'p2', 'p6'])
  })

  it('returns the original list when ids are unknown', () => {
    expect(threadMovableOrder(rows, isFixed, 'nope', 'p5')).toBe(rows)
  })
})
