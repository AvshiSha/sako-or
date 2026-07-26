'use client'

interface SeoSearchPreviewProps {
  title: string
  url: string
  description: string
  dir: 'ltr' | 'rtl'
  emptyTitlePlaceholder?: string
}

/** Approximate Google-style search-result preview. Not a guarantee of how Google will actually render the result. */
export default function SeoSearchPreview({
  title,
  url,
  description,
  dir,
  emptyTitlePlaceholder = 'Untitled product',
}: SeoSearchPreviewProps) {
  return (
    <div className="border border-gray-200 rounded-md p-4 bg-white" dir={dir}>
      <p className="text-xs text-gray-400 mb-2">Approximate preview — actual Google results may differ</p>
      <p className="text-[#1a0dab] text-lg leading-tight truncate">{title || emptyTitlePlaceholder}</p>
      <p className="text-[#006621] text-sm mb-1 truncate">{url}</p>
      <p className="text-sm text-gray-700 line-clamp-2">{description}</p>
    </div>
  )
}
