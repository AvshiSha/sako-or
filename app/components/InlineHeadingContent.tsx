import { normalizeInlineFieldHtml } from '@/lib/cms-html-cleanup'
import { stripInlineBlockWrapper } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'

interface InlineHeadingContentProps {
  html: string
  fallback?: string
  className?: string
}

export default function InlineHeadingContent({
  html,
  fallback = '',
  className,
}: InlineHeadingContentProps) {
  const normalized = normalizeInlineFieldHtml(html) || normalizeInlineFieldHtml(fallback)
  const sanitized = stripInlineBlockWrapper(normalized)
  if (!sanitized.trim()) return null

  return (
    <span
      className={cn(
        'inline-heading-content [&_a]:text-[#856D55] [&_a]:underline hover:[&_a]:text-[#6d5844]',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
