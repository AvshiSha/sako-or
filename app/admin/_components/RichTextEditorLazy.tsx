'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
      Loading editor…
    </div>
  ),
})

export type RichTextEditorProps = ComponentProps<typeof RichTextEditor>

export default RichTextEditor
