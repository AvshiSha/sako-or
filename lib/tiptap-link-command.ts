import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface SavedEditorSelection {
  from: number
  to: number
  empty: boolean
}

/** Capture the current editor selection (call before window.prompt). */
export function captureEditorSelection(editor: Editor): SavedEditorSelection {
  const { from, to, empty } = editor.state.selection
  return { from, to, empty }
}

/** Expand to the word at `pos`, including when pos is 0. */
export function getWordRangeAtPosition(doc: ProseMirrorNode, pos: number): { from: number; to: number } {
  const clamped = Math.max(0, Math.min(pos, doc.content.size))
  const $pos = doc.resolve(clamped)
  const parent = $pos.parent

  if (!parent.isTextblock) {
    return { from: clamped, to: clamped }
  }

  const blockStart = $pos.start()
  const text = parent.textBetween(0, parent.content.size, undefined, '\ufffc')
  const offset = $pos.parentOffset

  let from = offset
  let to = offset

  while (from > 0 && !/\s/u.test(text.charAt(from - 1))) {
    from -= 1
  }
  while (to < text.length && !/\s/u.test(text.charAt(to))) {
    to += 1
  }

  return {
    from: blockStart + from,
    to: blockStart + to,
  }
}

function resolveLinkRange(
  doc: ProseMirrorNode,
  selection: SavedEditorSelection
): { from: number; to: number } | null {
  const hasExplicitRange =
    !selection.empty && selection.from < selection.to

  if (hasExplicitRange) {
    return { from: selection.from, to: selection.to }
  }

  const word = getWordRangeAtPosition(doc, selection.from)
  if (word.from < word.to) {
    return word
  }

  return null
}

/**
 * Apply or remove a link using a selection captured before window.prompt.
 * Works for first/middle/last word and full-range selections (from may be 0).
 */
export function applyLinkToSelection(
  editor: Editor,
  url: string | null,
  savedSelection: SavedEditorSelection
): boolean {
  if (url === null) return false

  const trimmed = url.trim()

  if (trimmed === '') {
    const range = resolveLinkRange(editor.state.doc, savedSelection)
    const chain = editor.chain().focus()

    if (range) {
      chain.setTextSelection(range)
    } else {
      chain.setTextSelection({ from: savedSelection.from, to: savedSelection.to })
    }

    return chain.extendMarkRange('link').unsetLink().run()
  }

  const range = resolveLinkRange(editor.state.doc, savedSelection)
  if (!range) {
    return false
  }

  return editor
    .chain()
    .focus()
    .setTextSelection(range)
    .setLink({ href: trimmed })
    .run()
}

/** Prompt for a URL and apply it to the current/saved selection. */
export function promptAndApplyLink(editor: Editor): void {
  const savedSelection = captureEditorSelection(editor)
  const previousUrl = editor.getAttributes('link').href as string | undefined
  const url = window.prompt('URL', previousUrl ?? 'https://')
  applyLinkToSelection(editor, url, savedSelection)
}
