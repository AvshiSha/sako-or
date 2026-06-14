import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

type ListType = 'bulletList' | 'orderedList'

function getSelectedTopLevelTextblocks(editor: Editor): { pos: number; node: ProseMirrorNode }[] {
  const { state } = editor
  const { from, to } = state.selection
  const blocks: { pos: number; node: ProseMirrorNode }[] = []

  state.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (parent !== state.doc || !node.isTextblock) return
    blocks.push({ pos, node })
  })

  return blocks
}

/** Toggle a list; when multiple paragraphs are selected, each becomes its own list item. */
export function toggleListFromSelection(editor: Editor, listType: ListType): boolean {
  const listItemType = editor.schema.nodes.listItem
  const listNodeType = editor.schema.nodes[listType]
  if (!listItemType || !listNodeType) return false

  if (editor.isActive(listType)) {
    return editor.chain().focus().toggleList(listType, 'listItem').run()
  }

  const otherList: ListType = listType === 'bulletList' ? 'orderedList' : 'bulletList'
  if (editor.isActive(otherList)) {
    return editor
      .chain()
      .focus()
      .toggleList(otherList, 'listItem')
      .toggleList(listType, 'listItem')
      .run()
  }

  const { state, view } = editor
  const { empty } = state.selection
  const blocks = getSelectedTopLevelTextblocks(editor)

  if (empty || blocks.length <= 1) {
    return editor.chain().focus().toggleList(listType, 'listItem').run()
  }

  const firstPos = blocks[0].pos
  const lastBlock = blocks[blocks.length - 1]
  const lastEnd = lastBlock.pos + lastBlock.node.nodeSize

  const listItems = blocks.map(({ node }) => listItemType.create(null, node))
  const list = listNodeType.create(null, listItems)

  view.dispatch(state.tr.replaceWith(firstPos, lastEnd, list).scrollIntoView())
  editor.commands.focus()
  return true
}
