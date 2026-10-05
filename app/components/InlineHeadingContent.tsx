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
        // accent-link, matching .cms-content a. No hover colour: that rule changes
        // only the underline on hover, so the two CMS link surfaces now agree.
        'inline-heading-content [&_a]:text-accent-link [&_a]:underline',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
