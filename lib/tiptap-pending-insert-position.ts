import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'

export interface InsertAnchor {
  docSize: number
  parentType: string
  parentOffset: number
  beforeText: string
  afterText: string
}

interface PendingInsertState {
  pos: number
  anchor: InsertAnchor
}

const PENDING_INSERT_KEY = new PluginKey<PendingInsertState>('pendingInsertPosition')

function clampToDoc(editor: Editor, pos: number): number {
  return Math.max(0, Math.min(pos, editor.state.doc.content.size))
}

function captureInsertAnchor(editor: Editor, pos: number): InsertAnchor {
  const { doc } = editor.state
  const clamped = clampToDoc(editor, pos)
  const $pos = doc.resolve(clamped)
  const parent = $pos.parent

  let beforeText = ''
  let afterText = ''

  if (parent.isTextblock) {
    const offset = $pos.parentOffset
    beforeText = parent.textBetween(Math.max(0, offset - 32), offset, undefined, '\ufffc')
    afterText = parent.textBetween(
      offset,
      Math.min(parent.content.size, offset + 32),
      undefined,
      '\ufffc'
    )
  }

  return {
    docSize: doc.content.size,
    parentType: parent.type.name,
    parentOffset: $pos.parentOffset,
    beforeText,
    afterText,
  }
}

function createPendingInsertPositionPlugin(startPos: number, anchor: InsertAnchor): Plugin {
  return new Plugin({
    key: PENDING_INSERT_KEY,
    state: {
      init: () => ({ pos: startPos, anchor }),
      apply(tr, value) {
        if (!tr.docChanged) return value
        return {
          ...value,
          pos: tr.mapping.map(value.pos),
        }
      },
    },
  })
}

/** Whether a pending insert position is already being tracked. */
export function isPendingInsertPositionActive(editor: Editor): boolean {
  return PENDING_INSERT_KEY.getState(editor.state) != null
}

/** Begin tracking an insert point across document edits (e.g. while file picker is open). */
export function beginPendingInsertPosition(editor: Editor): void {
  endPendingInsertPosition(editor)
  const pos = editor.state.selection.from
  editor.registerPlugin(createPendingInsertPositionPlugin(pos, captureInsertAnchor(editor, pos)))
}

/** Stop tracking if active. Safe to call multiple times. */
export function endPendingInsertPosition(editor: Editor): void {
  editor.unregisterPlugin(PENDING_INSERT_KEY)
}

function canInsertBlockImageAt(editor: Editor, pos: number): boolean {
  const clamped = clampToDoc(editor, pos)
  return editor.can().insertContentAt(clamped, {
    type: 'image',
    attrs: { src: 'https://placeholder.invalid/pending-insert-check' },
  })
}

function findPositionFromAnchor(editor: Editor, anchor: InsertAnchor): number | null {
  if (!anchor.beforeText && !anchor.afterText) return null

  const { doc } = editor.state
  let found: number | null = null

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (!node.isTextblock || found != null) return

    const text = node.textContent
    const needle = anchor.beforeText + anchor.afterText
    if (!needle) return

    const index = text.indexOf(needle)
    if (index === -1) return

    found = pos + 1 + index + anchor.beforeText.length
  })

  return found
}

function nearestValidImageInsertPosition(editor: Editor, pos: number): number | null {
  const clamped = clampToDoc(editor, pos)
  const $pos = editor.state.doc.resolve(clamped)
  const candidates = [
    clamped,
    TextSelection.near($pos, -1).from,
    TextSelection.near($pos, 1).from,
    editor.state.selection.from,
    editor.state.doc.content.size,
  ]

  for (const candidate of candidates) {
    if (canInsertBlockImageAt(editor, candidate)) {
      return clampToDoc(editor, candidate)
    }
  }

  return null
}

export interface ResolvedInsertPosition {
  pos: number
  valid: boolean
  strategy: 'mapped' | 'anchor' | 'nearest' | 'none'
}

/** Resolve a tracked insert point in the current document. Does not stop tracking — caller must call `endPendingInsertPosition`. */
export function resolvePendingInsertPosition(editor: Editor): ResolvedInsertPosition {
  const pending = PENDING_INSERT_KEY.getState(editor.state)

  if (!pending) {
    const pos = nearestValidImageInsertPosition(editor, editor.state.selection.from)
    return pos == null
      ? { pos: 0, valid: false, strategy: 'none' }
      : { pos, valid: true, strategy: 'nearest' }
  }

  if (canInsertBlockImageAt(editor, pending.pos)) {
    return { pos: clampToDoc(editor, pending.pos), valid: true, strategy: 'mapped' }
  }

  const anchorPos = findPositionFromAnchor(editor, pending.anchor)
  if (anchorPos != null && canInsertBlockImageAt(editor, anchorPos)) {
    return { pos: clampToDoc(editor, anchorPos), valid: true, strategy: 'anchor' }
  }

  const nearest = nearestValidImageInsertPosition(editor, pending.pos)
  if (nearest != null) {
    return { pos: nearest, valid: true, strategy: 'nearest' }
  }

  return { pos: clampToDoc(editor, pending.pos), valid: false, strategy: 'none' }
}
