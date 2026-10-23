'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon } from 'lucide-react'
import { Fragment, type ReactNode, useCallback } from 'react'
import { Icon } from './icon'

export const threadMovableOrder = <T extends { id: string }>(
  items: T[],
  isItemFixed: (item: T) => boolean,
  activeId: string,
  overId: string,
): T[] => {
  const movable = items.filter(item => !isItemFixed(item))
  const oldIndex = movable.findIndex(item => item.id === activeId)
  const newIndex = movable.findIndex(item => item.id === overId)
  if (oldIndex === -1 || newIndex === -1) return items

  const reordered = arrayMove(movable, oldIndex, newIndex)
  let cursor = 0
  return items.map(item => (isItemFixed(item) ? item : reordered[cursor++]))
}

type SortableListProps<T extends { id: string }> = {
  items: T[]
  onReorder: (items: T[]) => void
  renderItem: (item: T, index: number, dragHandle?: ReactNode) => ReactNode
  disabled?: boolean
  isItemFixed?: (item: T) => boolean
  /**
   * When true, the drag handle is passed to `renderItem` as its third argument
   * instead of being rendered in a fixed column to the left of each row. The
   * consumer then places it wherever it fits (e.g. inside a card), so the
   * handle no longer offsets the row content. Fixed rows receive `undefined`.
   */
  renderHandleInItem?: boolean
  labels?: {
    dragHandle?: string
  }
}

export const SortableList = <T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  isItemFixed,
  renderHandleInItem = false,
  labels,
}: SortableListProps<T>) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const fixed = isItemFixed ?? (() => false)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const reordered = threadMovableOrder(
        items,
        fixed,
        String(active.id),
        String(over.id),
      )
      if (reordered !== items) onReorder(reordered)
    },
    [items, fixed, onReorder],
  )

  if (disabled) {
    return (
      <div>
        {items.map((item, i) => (
          <Fragment key={item.id}>{renderItem(item, i)}</Fragment>
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.filter(item => !fixed(item)).map(i => i.id)}
        strategy={verticalListSortingStrategy}>
        {items.map((item, i) => {
          if (fixed(item)) {
            // Fixed rows are not draggable: no handle. With an in-item handle,
            // render the row as-is; otherwise reserve the handle column so rows
            // stay aligned with their draggable siblings.
            return renderHandleInItem ? (
              <Fragment key={item.id}>{renderItem(item, i)}</Fragment>
            ) : (
              <FixedItem key={item.id}>{renderItem(item, i)}</FixedItem>
            )
          }
          return (
            <SortableItem
              key={item.id}
              item={item}
              index={i}
              renderItem={renderItem}
              renderHandleInItem={renderHandleInItem}
              labels={labels}
            />
          )
        })}
      </SortableContext>
    </DndContext>
  )
}

const SortableItem = <T extends { id: string }>({
  item,
  index,
  renderItem,
  renderHandleInItem,
  labels,
}: {
  item: T
  index: number
  renderItem: (item: T, index: number, dragHandle?: ReactNode) => ReactNode
  renderHandleInItem: boolean
  labels?: { dragHandle?: string }
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handle = (
    <SortableDragHandle
      listeners={listeners}
      attributes={attributes}
      setActivatorNodeRef={setActivatorNodeRef}
      ariaLabel={labels?.dragHandle}
    />
  )

  return (
    <div ref={setNodeRef} style={style}>
      {renderHandleInItem ? (
        renderItem(item, index, handle)
      ) : (
        <div className='flex items-center gap-2'>
          {handle}
          <div className='flex-1'>{renderItem(item, index)}</div>
        </div>
      )}
    </div>
  )
}

const FixedItem = ({ children }: { children: ReactNode }) => (
  <div className='flex items-center gap-2'>
    <div className='size-9 shrink-0' aria-hidden />
    <div className='flex-1'>{children}</div>
  </div>
)

export const SortableDragHandle = ({
  listeners,
  attributes,
  setActivatorNodeRef,
  ariaLabel,
}: {
  listeners?: ReturnType<typeof useSortable>['listeners']
  attributes?: ReturnType<typeof useSortable>['attributes']
  setActivatorNodeRef?: ReturnType<typeof useSortable>['setActivatorNodeRef']
  ariaLabel?: string
}) => (
  <button
    ref={setActivatorNodeRef}
    type='button'
    aria-label={ariaLabel ?? 'Reorder item'}
    className='flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing'
    {...attributes}
    {...listeners}>
    <Icon icon={GripVerticalIcon} size='md' />
  </button>
)
