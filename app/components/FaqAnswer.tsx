import { sanitizeFaqAnswerHtml } from '@/lib/sanitize-html'
import { wrapFaqTables } from '@/lib/faq-html'
import { cn } from '@/lib/utils'

interface FaqAnswerProps {
  html: string
  className?: string
  dir?: 'ltr' | 'rtl'
  /** Accessible name for a table's scroll region — pass the question text. */
  tableLabel?: string
}

/**
 * Renders one FAQ answer.
 *
 * A near-twin of RichContent, differing only in which sanitizer it calls:
 * sanitizeFaqAnswerHtml demotes h1/h2 to h3 (the page owns the h1 and each
 * question is an h2) and drops iframes. A separate component rather than a prop
 * on RichContent keeps the storefront's CMS renderer untouched.
 *
 * The answer is already sanitized on write, in the admin API route. Sanitizing
 * again here is the safety net for seeded rows and for anything written before
 * that route existed — cheap, and it means no path can reach the DOM unchecked.
 *
 * Server component: sanitize-html is Node-only and must never be pulled into a
 * client bundle.
 */
export default function FaqAnswer({ html, className, dir, tableLabel }: FaqAnswerProps) {
  const sanitized = sanitizeFaqAnswerHtml(html)
  if (!sanitized.trim()) return null

  // Sanitized HTML has no .tableWrapper (that is a TipTap editor artifact), so
  // a wide table would push the page sideways on a phone without this.
  const withScrollableTables = wrapFaqTables(sanitized, tableLabel || 'Table')

  return (
    <div
      dir={dir}
      className={cn('cms-content faq-answer leading-relaxed', className)}
      dangerouslySetInnerHTML={{ __html: withScrollableTables }}
    />
  )
}
