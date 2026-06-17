'use client'

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { cleanupCmsHtml, isCmsHtmlEmpty } from '@/lib/cms-html-cleanup'
import { toggleListFromSelection } from '@/lib/tiptap-list-commands'
import { promptAndApplyLink } from '@/lib/tiptap-link-command'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import {
  BoldIcon,
  ItalicIcon,
  ListBulletIcon,
  LinkIcon,
  PhotoIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onUploadImage?: (file: File) => Promise<string>
  placeholder?: string
  dir?: 'ltr' | 'rtl'
  /** Remount editor when locale changes (e.g. pass activeTab "en" | "he") */
  editorKey?: string
  /** Inline mode: bold, italic, and links only (for titles). */
  variant?: 'default' | 'inline'
}

function normalizeEditorHtml(html: string): string {
  const cleaned = cleanupCmsHtml(html)
  return isCmsHtmlEmpty(cleaned) ? '' : cleaned
}

const ToolbarButton = forwardRef<
  HTMLButtonElement,
  {
    onClick?: () => void
    onMouseDown?: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onMouseDown' | 'title'>
>(function ToolbarButton(
  { onClick, onMouseDown, active, disabled, title, children, className, ...rest },
  ref
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown?.()
      }}
      onClick={(e) => {
        onClick?.()
      }}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        'rounded-md border p-1.5 transition-all',
        active
          ? 'border-[#856D55] bg-[#856D55]/15 text-gray-900 shadow-sm ring-1 ring-[#856D55]/30'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-900',
        disabled && 'cursor-not-allowed opacity-40',
        className
      )}
    >
      {children}
    </button>
  )
})

function EditorToolbar({
  editor,
  onUploadImage,
  onAddImage,
  onAddYoutube,
  onSetLink,
  variant = 'default',
}: {
  editor: Editor
  onUploadImage?: (file: File) => Promise<string>
  onAddImage: () => void
  onAddYoutube: () => void
  onSetLink: () => void
  variant?: 'default' | 'inline'
}) {
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false)
  const [tableGridHover, setTableGridHover] = useState<{ rows: number; cols: number } | null>(
    null
  )

  const maxGrid = 8
  const gridRows = useMemo(() => Array.from({ length: maxGrid }, (_, i) => i + 1), [])
  const gridCols = useMemo(() => Array.from({ length: maxGrid }, (_, i) => i + 1), [])

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed || ed.isDestroyed) {
        return {
          h2: false,
          h3: false,
          bold: false,
          italic: false,
          bulletList: false,
          orderedList: false,
          link: false,
          table: false,
        }
      }

      return {
        h2: ed.isActive('heading', { level: 2 }),
        h3: ed.isActive('heading', { level: 3 }),
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        bulletList: ed.isActive('bulletList'),
        orderedList: ed.isActive('orderedList'),
        link: ed.isActive('link'),
        table: ed.isActive('table'),
      }
    },
  })

  const toggleHeading = (level: 2 | 3) => {
    if (editor.isActive('heading', { level })) {
      editor.chain().focus().setParagraph().run()
    } else {
      editor.chain().focus().setHeading({ level }).run()
    }
  }

  const insertTable = (rows: number, cols: number) => {
    if (!rows || !cols) return
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: false })
      .run()
    setTablePopoverOpen(false)
    setTableGridHover(null)
  }

  const can = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed || ed.isDestroyed) {
        return {
          addColumnBefore: false,
          addColumnAfter: false,
          deleteColumn: false,
          addRowBefore: false,
          addRowAfter: false,
          deleteRow: false,
          mergeCells: false,
          splitCell: false,
          deleteTable: false,
        }
      }

      return {
        addColumnBefore:
          typeof ed.commands.addColumnBefore === 'function' &&
          ed.can().chain().focus().addColumnBefore().run(),
        addColumnAfter:
          typeof ed.commands.addColumnAfter === 'function' &&
          ed.can().chain().focus().addColumnAfter().run(),
        deleteColumn:
          typeof ed.commands.deleteColumn === 'function' &&
          ed.can().chain().focus().deleteColumn().run(),
        addRowBefore:
          typeof ed.commands.addRowBefore === 'function' && ed.can().chain().focus().addRowBefore().run(),
        addRowAfter:
          typeof ed.commands.addRowAfter === 'function' && ed.can().chain().focus().addRowAfter().run(),
        deleteRow:
          typeof ed.commands.deleteRow === 'function' && ed.can().chain().focus().deleteRow().run(),
        mergeCells:
          typeof ed.commands.mergeCells === 'function' && ed.can().chain().focus().mergeCells().run(),
        splitCell:
          typeof ed.commands.splitCell === 'function' && ed.can().chain().focus().splitCell().run(),
        deleteTable:
          typeof ed.commands.deleteTable === 'function' && ed.can().chain().focus().deleteTable().run(),
      }
    },
  })

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
      {variant === 'default' && (
        <>
          <ToolbarButton
            onClick={() => toggleHeading(2)}
            active={active.h2}
            title="Heading 2"
          >
            <span className={cn('text-xs font-bold px-0.5', active.h2 && 'text-[#856D55]')}>H2</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => toggleHeading(3)}
            active={active.h3}
            title="Heading 3"
          >
            <span className={cn('text-xs font-bold px-0.5', active.h3 && 'text-[#856D55]')}>H3</span>
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden />
        </>
      )}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={active.bold}
        title="Bold (Ctrl+B)"
      >
        <BoldIcon className={cn('h-4 w-4', active.bold && 'stroke-[2.5px] text-[#856D55]')} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={active.italic}
        title="Italic (Ctrl+I)"
      >
        <ItalicIcon className={cn('h-4 w-4', active.italic && 'stroke-[2.5px] text-[#856D55]')} />
      </ToolbarButton>
      {variant === 'default' && (
        <>
          <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden />
          <ToolbarButton
            onMouseDown={() => toggleListFromSelection(editor, 'bulletList')}
            active={active.bulletList}
            title="Bullet list"
          >
            <ListBulletIcon
              className={cn('h-4 w-4', active.bulletList && 'stroke-[2.5px] text-[#856D55]')}
            />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={() => toggleListFromSelection(editor, 'orderedList')}
            active={active.orderedList}
            title="Numbered list"
          >
            <span
              className={cn(
                'text-xs font-semibold px-0.5',
                active.orderedList && 'text-[#856D55]'
              )}
            >
              1.
            </span>
          </ToolbarButton>
        </>
      )}
      <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden />
      <ToolbarButton onMouseDown={onSetLink} active={active.link} title="Link">
        <LinkIcon className={cn('h-4 w-4', active.link && 'stroke-[2.5px] text-[#856D55]')} />
      </ToolbarButton>
      {variant === 'default' && (
        <Popover open={tablePopoverOpen} onOpenChange={setTablePopoverOpen}>
          <PopoverTrigger asChild>
            <ToolbarButton
              title="Table"
              active={active.table}
              disabled={!editor.isEditable}
              onClick={() => setTablePopoverOpen((v) => !v)}
            >
              <span className={cn('text-xs font-semibold px-0.5', active.table && 'text-[#856D55]')}>
                Tbl
              </span>
            </ToolbarButton>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-gray-700">Insert table</div>
                <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${maxGrid}, 1fr)` }}>
                  {gridRows.flatMap((r) =>
                    gridCols.map((c) => {
                      const isActive =
                        tableGridHover != null &&
                        r <= tableGridHover.rows &&
                        c <= tableGridHover.cols
                      return (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          onMouseEnter={() => setTableGridHover({ rows: r, cols: c })}
                          onFocus={() => setTableGridHover({ rows: r, cols: c })}
                          onClick={() => insertTable(r, c)}
                          className={cn(
                            'h-5 w-5 rounded-sm border transition-colors',
                            isActive ? 'border-[#856D55] bg-[#856D55]/15' : 'border-gray-200 bg-white'
                          )}
                          aria-label={`Insert ${r} by ${c} table`}
                        />
                      )
                    })
                  )}
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  {tableGridHover ? `${tableGridHover.rows} × ${tableGridHover.cols}` : `Up to ${maxGrid} × ${maxGrid}`}
                </div>
              </div>

              {active.table && (
                <div className="border-t pt-3 space-y-2">
                  <div className="text-xs font-medium text-gray-700">Table actions</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!can.addRowBefore}
                      onClick={() => editor.chain().focus().addRowBefore().run()}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                    >
                      Add row above
                    </button>
                    <button
                      type="button"
                      disabled={!can.addRowAfter}
                      onClick={() => editor.chain().focus().addRowAfter().run()}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                    >
                      Add row below
                    </button>
                    <button
                      type="button"
                      disabled={!can.deleteRow}
                      onClick={() => editor.chain().focus().deleteRow().run()}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                    >
                      Delete row
                    </button>
                    <button
                      type="button"
                      disabled={!can.addColumnBefore}
                      onClick={() => editor.chain().focus().addColumnBefore().run()}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                    >
                      Add column left
                    </button>
                    <button
                      type="button"
                      disabled={!can.addColumnAfter}
                      onClick={() => editor.chain().focus().addColumnAfter().run()}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                    >
                      Add column right
                    </button>
                    <button
                      type="button"
                      disabled={!can.deleteColumn}
                      onClick={() => editor.chain().focus().deleteColumn().run()}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                    >
                      Delete column
                    </button>
                    <button
                      type="button"
                      disabled={!can.mergeCells}
                      onClick={() => editor.chain().focus().mergeCells().run()}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                    >
                      Merge cells
                    </button>
                    <button
                      type="button"
                      disabled={!can.splitCell}
                      onClick={() => editor.chain().focus().splitCell().run()}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                    >
                      Split cell
                    </button>
                    <button
                      type="button"
                      disabled={!can.deleteTable}
                      onClick={() => editor.chain().focus().deleteTable().run()}
                      className="col-span-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 disabled:opacity-40"
                    >
                      Delete table
                    </button>
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {variant === 'default' && onUploadImage && (
        <ToolbarButton onClick={onAddImage} title="Insert image">
          <PhotoIcon className="h-4 w-4" />
        </ToolbarButton>
      )}
      {variant === 'default' && (
        <ToolbarButton onClick={onAddYoutube} title="Insert YouTube video">
          <VideoCameraIcon className="h-4 w-4" />
        </ToolbarButton>
      )}
      {variant === 'default' && (
        <span className="ms-auto hidden text-[11px] text-gray-400 sm:inline">
          Enter = blank line · Shift+Enter = line break
        </span>
      )}
    </div>
  )
}

export default function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  placeholder,
  dir = 'ltr',
  editorKey,
  variant = 'default',
}: RichTextEditorProps) {
  const isInternalUpdate = useRef(false)
  const isInline = variant === 'inline'

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: isInline ? false : { levels: [2, 3] },
        bulletList: isInline ? false : undefined,
        orderedList: isInline ? false : undefined,
        listItem: isInline ? false : undefined,
        blockquote: isInline ? false : undefined,
        codeBlock: isInline ? false : undefined,
        horizontalRule: isInline ? false : undefined,
      }),
      ...(isInline
        ? []
        : [
            Table.configure({
              HTMLAttributes: {
                class: 'cms-table',
              },
            }),
            TableRow,
            TableHeader,
            TableCell,
          ]),
      ...(isInline
        ? []
        : [
            Image.configure({
              HTMLAttributes: {
                class: 'max-w-full h-auto rounded-md',
              },
            }),
            Youtube.configure({
              width: 640,
              height: 360,
              HTMLAttributes: {
                class: 'youtube-embed w-full aspect-video rounded-md',
              },
            }),
          ]),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#856D55] underline',
        },
      }),
    ],
    content: normalizeEditorHtml(value) || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn('outline-none', isInline && 'min-h-[2.5rem]'),
        dir,
      },
      handleKeyDown: (_view, event) => {
        if (isInline && event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true
      onChange(ed.getHTML())
    },
  }, [editorKey, variant])

  useEffect(() => {
    if (!editor) return
    editor.view.dom.setAttribute('dir', dir)
  }, [editor, dir])

  useEffect(() => {
    if (!editor) return

    const handleBlur = () => {
      const raw = editor.getHTML()
      const cleaned = normalizeEditorHtml(raw)
      if (cleaned !== raw) {
        isInternalUpdate.current = true
        editor.commands.setContent(cleaned || '', { emitUpdate: false })
        onChange(cleaned)
      }
    }

    editor.on('blur', handleBlur)
    return () => {
      editor.off('blur', handleBlur)
    }
  }, [editor, onChange])

  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    const current = editor.getHTML()
    if (normalizeEditorHtml(value) !== normalizeEditorHtml(current)) {
      editor.commands.setContent(normalizeEditorHtml(value) || '', { emitUpdate: false })
    }
  }, [editor, value, editorKey])

  const setLink = useCallback(() => {
    if (!editor) return
    promptAndApplyLink(editor)
  }, [editor])

  const addImage = useCallback(async () => {
    if (!editor || !onUploadImage) return

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const url = await onUploadImage(file)
        const alt = window.prompt('Alt text (for accessibility)', '') || ''
        editor.chain().focus().setImage({ src: url, alt }).run()
      } catch (err) {
        console.error('Image upload failed:', err)
        alert('Failed to upload image')
      }
    }
    input.click()
  }, [editor, onUploadImage])

  const addYoutube = useCallback(() => {
    if (!editor) return
    const url = window.prompt(
      'Paste YouTube URL (watch, short, or embed)',
      'https://www.youtube.com/watch?v='
    )
    if (!url?.trim()) return
    editor.commands.setYoutubeVideo({ src: url.trim() })
  }, [editor])

  const hasText = useEditorState({
    editor,
    selector: ({ editor: ed }) => Boolean(ed && ed.getText().trim().length > 0),
  })

  if (!editor) {
    return (
      <div className="rounded-md border border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
        Loading editor…
      </div>
    )
  }

  return (
    <div dir={dir} className="rounded-md border border-gray-300 bg-white overflow-hidden">
      <EditorToolbar
        editor={editor}
        onUploadImage={onUploadImage}
        onAddImage={addImage}
        onAddYoutube={addYoutube}
        onSetLink={setLink}
        variant={variant}
      />
      <div
        dir={dir}
        className={cn(
          'cms-content cms-editor relative bg-white',
          isInline ? 'cms-editor-inline px-3 py-1.5 text-sm' : undefined
        )}
      >
        <EditorContent editor={editor} />
        {placeholder && !hasText && (
          <p
            className={cn(
              'pointer-events-none absolute start-3 text-sm text-gray-400',
              isInline ? 'top-2' : 'top-4'
            )}
          >
            {placeholder}
          </p>
        )}
      </div>
    </div>
  )
}
