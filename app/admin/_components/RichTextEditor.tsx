'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import { cleanupCmsHtml, isCmsHtmlEmpty } from '@/lib/cms-html-cleanup'
import { toggleListFromSelection } from '@/lib/tiptap-list-commands'
import { promptAndApplyLink } from '@/lib/tiptap-link-command'
import { cn } from '@/lib/utils'
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

function ToolbarButton({
  onClick,
  onMouseDown,
  active,
  disabled,
  title,
  children,
}: {
  onClick?: () => void
  onMouseDown?: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown?.()
      }}
      onClick={() => onClick?.()}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        'rounded-md border p-1.5 transition-all',
        active
          ? 'border-[#856D55] bg-[#856D55]/15 text-gray-900 shadow-sm ring-1 ring-[#856D55]/30'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-900',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      {children}
    </button>
  )
}

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
  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      h2: ed.isActive('heading', { level: 2 }),
      h3: ed.isActive('heading', { level: 3 }),
      bold: ed.isActive('bold'),
      italic: ed.isActive('italic'),
      bulletList: ed.isActive('bulletList'),
      orderedList: ed.isActive('orderedList'),
      link: ed.isActive('link'),
    }),
  })

  const toggleHeading = (level: 2 | 3) => {
    if (editor.isActive('heading', { level })) {
      editor.chain().focus().setParagraph().run()
    } else {
      editor.chain().focus().setHeading({ level }).run()
    }
  }

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
