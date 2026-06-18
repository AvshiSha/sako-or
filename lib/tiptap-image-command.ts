import type { Editor } from '@tiptap/core'
import {
  beginPendingInsertPosition,
  endPendingInsertPosition,
  isPendingInsertPositionActive,
  resolvePendingInsertPosition,
} from './tiptap-pending-insert-position'

/** Insert a block image at a validated position in the current document. */
export function insertImageAtPosition(
  editor: Editor,
  pos: number,
  attrs: { src: string; alt?: string }
): boolean {
  return editor
    .chain()
    .focus()
    .insertContentAt(pos, {
      type: 'image',
      attrs: {
        src: attrs.src,
        alt: attrs.alt || undefined,
      },
    })
    .run()
}

function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

/** Open file picker, upload, prompt for alt text, and insert at the tracked cursor position.
 *  Call `beginPendingInsertPosition` synchronously in the UI handler before invoking this. */
export async function promptAndInsertImage(
  editor: Editor,
  onUploadImage: (file: File) => Promise<string>
): Promise<void> {
  if (!isPendingInsertPositionActive(editor)) {
    beginPendingInsertPosition(editor)
  }

  try {
    const file = await pickImageFile()
    if (!file) return

    const url = await onUploadImage(file)
    const alt = window.prompt('Alt text (for accessibility)', '') || ''
    const resolved = resolvePendingInsertPosition(editor)

    if (!resolved.valid) {
      alert(
        'Could not find a valid place to insert the image. Click where you want it in the content and try again.'
      )
      return
    }

    const inserted = insertImageAtPosition(editor, resolved.pos, { src: url, alt })
    if (!inserted) {
      alert(
        'Could not insert the image. Click where you want it in the content and try again.'
      )
    }
  } catch (err) {
    console.error('Image upload failed:', err)
    alert('Failed to upload image')
  } finally {
    endPendingInsertPosition(editor)
  }
}
