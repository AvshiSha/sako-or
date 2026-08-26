'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Bars3Icon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/app/contexts/AuthContext'
import { adminTheme } from '@/app/(unlocalized)/admin/_components/adminTheme'
import { reorderFaqs } from '@/lib/admin/faq-client'
import { sortFaqs } from '@/lib/faq-order'
import { FAQ_AUDIENCES, FAQ_AUDIENCE_LABELS, FAQ_STATUS_LABELS, type FaqAudience, type FaqItem } from '@/lib/faq-types'

interface FaqReorderBoardProps {
  items: FaqItem[]
  onSaved: (message: string) => void
  onError: (message: string) => void
  /** Refetch, so a 409 recovers with the true current list. */
  onRefetch: () => Promise<void>
  onClose: () => void
}

function statusBadgeClass(status: FaqItem['status']): string {
  if (status === 'published') return adminTheme.badgeActive
  if (status === 'hidden') return adminTheme.badgeNew
  return adminTheme.badgeInactive
}

function SortableRow({
  item,
  index,
  total,
  onMove,
}: {
  item: FaqItem
  index: number
  total: number
  onMove: (index: number, direction: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2 last:border-b-0"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        aria-label={`Drag to reorder: ${item.question.he || item.question.en}`}
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      <span className="w-8 shrink-0 text-sm tabular-nums text-gray-400">{index + 1}</span>

      <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
        {item.question.he || item.question.en}
      </span>

      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}>
        {FAQ_STATUS_LABELS[item.status].en}
      </span>

      {/* Arrow buttons alongside dnd-kit: dragging is awkward on touch and
          impossible for some assistive tech, and this list decides the public
          order — it cannot be mouse-only. */}
      <span className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          aria-label="Move up"
        >
          <ChevronUpIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          aria-label="Move down"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </span>
    </li>
  )
}

/**
 * Reorders one audience group.
 *
 * The list shows every status, not just published questions. Order is stored as
 * a dense 0..n-1 sequence over the whole group, so excluding hidden and draft
 * items here would submit a list the server rejects as incomplete — and, if it
 * did not, would leave gaps that decide where the next published question lands.
 *
 * Saving is explicit rather than per-drag, matching CategoryMerchandisingBoard:
 * one request per intent, and a drag can be undone before it is committed.
 */
export default function FaqReorderBoard({
  items,
  onSaved,
  onError,
  onRefetch,
  onClose,
}: FaqReorderBoardProps) {
  const { user } = useAuth()
  const [audience, setAudience] = useState<FaqAudience>('women')
  const [ordered, setOrdered] = useState<FaqItem[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    setOrdered(sortFaqs(items.filter((item) => item.audience === audience)))
  }, [items, audience])

  const sensors = useSensors(
    // A small threshold so a click on the drag handle is still a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrdered((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id)
      const newIndex = current.findIndex((item) => item.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return current
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  const handleMove = (index: number, direction: -1 | 1) => {
    setOrdered((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      return arrayMove(current, index, target)
    })
  }

  const handleSave = async () => {
    if (inFlight.current || !user || ordered.length === 0) return
    inFlight.current = true
    setIsSaving(true)

    try {
      const result = await reorderFaqs(
        user,
        audience,
        ordered.map((item) => item.id)
      )

      if (!result.ok) {
        if (result.status === 409) {
          // Someone else changed this group. Reconciling client-side would drop
          // or resurrect a question, so refetch and let the admin redo the move
          // against the real list.
          onError('Someone else changed this list. Reloading the current order — please reorder again.')
          await onRefetch()
        } else {
          onError(result.error)
        }
        return
      }

      onSaved(`Order saved for ${FAQ_AUDIENCE_LABELS[audience].en}.`)
      await onRefetch()
    } catch (error) {
      console.error('Error reordering FAQs:', error)
      onError('Something went wrong while saving the order.')
    } finally {
      setIsSaving(false)
      inFlight.current = false
    }
  }

  return (
    <div className={`${adminTheme.card} p-4`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Reorder questions</h2>
          <p className="mt-1 text-sm text-gray-500">
            Drag, or use the arrows. Drafts and hidden questions are included so the numbering stays
            continuous.
          </p>
        </div>
        <button type="button" onClick={onClose} className={adminTheme.buttonSecondary}>
          Done
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {FAQ_AUDIENCES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAudience(value)}
            className={`rounded-full border px-3 py-1 text-sm ${
              audience === value
                ? 'border-[#856D55] bg-[#856D55] text-white'
                : 'border-[#B2A28E] bg-white text-[#5C4A3A] hover:bg-[#E1DBD7]/50'
            }`}
          >
            {FAQ_AUDIENCE_LABELS[value].en}
          </button>
        ))}
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm text-gray-500">No questions in this section yet.</p>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={ordered.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="overflow-hidden rounded-md border border-gray-200">
                {ordered.map((item, index) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    index={index}
                    total={ordered.length}
                    onMove={handleMove}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={adminTheme.buttonPrimary}
            >
              {isSaving ? 'Saving…' : 'Save order'}
            </button>
            <span className="text-sm text-gray-500">
              The public page updates as soon as this is saved.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
