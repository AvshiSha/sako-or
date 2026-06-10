'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
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
}

function normalizeEditorHtml(html: string): string {
  const trimmed = html?.trim() ?? ''
  if (
    !trimmed ||
    trimmed === '<p></p>' ||
    trimmed === '<p><br></p>' ||
    trimmed === '<p><br class="ProseMirror-trailingBreak"></p>'
  ) {
    return ''
  }
  return trimmed
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded p-1.5 transition-colors ${
        active
          ? 'bg-gray-200 text-black'
          : 'text-gray-600 hover:bg-gray-100 hover:text-black'
      } disabled:opacity-40`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  placeholder,
  dir = 'ltr',
  editorKey,
}: RichTextEditorProps) {
  const isInternalUpdate = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#856D55] underline',
        },
      }),
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
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[200px] px-3 py-2 focus:outline-none text-gray-900 prose-headings:text-gray-900 prose-p:text-gray-900 prose-li:text-gray-900 prose-strong:text-gray-900',
        dir,
      },
    },
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true
      onChange(ed.getHTML())
    },
  }, [editorKey])

  useEffect(() => {
    if (!editor) return
    editor.view.dom.setAttribute('dir', dir)
  }, [editor, dir])

  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    const current = editor.getHTML()
    if (normalizeEditorHtml(value) !== normalizeEditorHtml(current)) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value, editorKey])

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
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

  if (!editor) {
    return (
      <div className="rounded-md border border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
        Loading editor…
      </div>
    )
  }

  return (
    <div dir={dir} className="rounded-md border border-gray-300 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <span className="text-xs font-bold px-0.5">H2</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <span className="text-xs font-bold px-0.5">H3</span>
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <BoldIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <ItalicIcon className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <ListBulletIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <span className="text-xs font-medium px-0.5">1.</span>
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Link">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        {onUploadImage && (
          <ToolbarButton onClick={addImage} title="Insert image">
            <PhotoIcon className="h-4 w-4" />
          </ToolbarButton>
        )}
        <ToolbarButton onClick={addYoutube} title="Insert YouTube video">
          <VideoCameraIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div
        dir={dir}
        className="cms-content relative text-gray-900 [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:text-gray-900 [&_.ProseMirror]:caret-black [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold"
      >
        <EditorContent editor={editor} />
        {placeholder && !editor.getText().trim() && (
          <p className="pointer-events-none absolute start-3 top-2 text-sm text-gray-400">
            {placeholder}
          </p>
        )}
      </div>
    </div>
  )
}
