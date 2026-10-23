import type { RowData } from '@tanstack/react-table'

import type { Table as TanstackTable } from '../components/data-table-types'
import { useState } from 'react'

type UseDragReorderOptions<TData extends RowData> = {
  table: TanstackTable<TData>
  enableColumnReordering: boolean
}

type UseDragReorderReturn = {
  draggedColumnId: string | null
  dropTargetColumnId: string | null
  isColumnDraggable: (columnId: string) => boolean
  handleDragStart: (e: React.DragEvent, columnId: string) => void
  handleDragOver: (e: React.DragEvent, columnId: string) => void
  handleDrop: (e: React.DragEvent, targetColumnId: string) => void
  handleDragEnd: () => void
}

const useDragReorder = <TData extends RowData>({
  table,
  enableColumnReordering,
}: UseDragReorderOptions<TData>): UseDragReorderReturn => {
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(
    null,
  )

  const isColumnDraggable = (columnId: string) => {
    if (!enableColumnReordering) return false
    const column = table.getColumn(columnId)
    if (!column) return false
    if (column.getIsPinned()) return false
    const meta = column.columnDef.meta
    return meta?.reorderable !== false
  }

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', columnId)
    setDraggedColumnId(columnId)
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    if (isColumnDraggable(columnId)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropTargetColumnId(columnId)
    } else {
      setDropTargetColumnId(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    const sourceColumnId = e.dataTransfer.getData('text/plain')
    if (
      sourceColumnId &&
      sourceColumnId !== targetColumnId &&
      isColumnDraggable(targetColumnId)
    ) {
      const currentOrder = table.getAllLeafColumns().map(c => c.id)
      const sourceIndex = currentOrder.indexOf(sourceColumnId)
      const targetIndex = currentOrder.indexOf(targetColumnId)
      if (sourceIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...currentOrder]
        newOrder.splice(sourceIndex, 1)
        const adjustedIndex =
          sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
        newOrder.splice(adjustedIndex, 0, sourceColumnId)
        table.setColumnOrder(newOrder)
      }
    }
    setDraggedColumnId(null)
    setDropTargetColumnId(null)
  }

  const handleDragEnd = () => {
    setDraggedColumnId(null)
    setDropTargetColumnId(null)
  }

  return {
    draggedColumnId,
    dropTargetColumnId,
    isColumnDraggable,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  }
}

export { useDragReorder }
export type { UseDragReorderOptions, UseDragReorderReturn }
