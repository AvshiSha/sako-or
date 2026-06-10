import { sanitizeCmsHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'

interface RichContentProps {
  html: string
  className?: string
  dir?: 'ltr' | 'rtl'
}

export default function RichContent({ html, className, dir }: RichContentProps) {
  const sanitized = sanitizeCmsHtml(html)
  if (!sanitized.trim()) return null

  return (
    <div
      dir={dir}
      className={cn('cms-content leading-relaxed', className)}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
