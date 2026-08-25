import Link from 'next/link'
import type { BreadcrumbCrumb } from '@/lib/seo'

/**
 * Visible breadcrumb trail.
 *
 * A server component on purpose: these are real internal links, and their
 * whole value is that a crawler (and Chatbase, which reads the same HTML)
 * can follow them without executing JavaScript. Product pages previously
 * linked to no category at all, which left them orphaned from the collection
 * tree they belong to.
 *
 * The labels rendered here are the same strings passed to
 * buildBreadcrumbStructuredData(), because Google requires the markup `name`
 * to match the visible label. Feed both from one array; never re-derive.
 */
export default function Breadcrumbs({
  crumbs,
  className = '',
}: {
  crumbs: BreadcrumbCrumb[]
  className?: string
}) {
  const usable = crumbs.filter((crumb) => !!crumb.name?.trim())
  if (usable.length < 2) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={`px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 ${className}`}
    >
      {/*
        One line, always. The trail used to wrap onto a second line on phones -
        the last crumb is brand + colour and overflows a 375px viewport by a
        few characters - which cost ~50px of above-the-fold height on every
        product page. Scrolling rather than wrapping is deliberately the only
        concession made: every crumb stays in the DOM, rendered, and its label
        still matches buildBreadcrumbStructuredData() exactly. Nothing is
        hidden, truncated or dropped, so the crawlable link trail and the
        JSON-LD are untouched - this is purely how many pixels tall it is.
      */}
      <ol className="flex flex-nowrap items-center gap-x-2 overflow-x-auto whitespace-nowrap no-scrollbar">
        {usable.map((crumb, index) => {
          const isLast = index === usable.length - 1
          return (
            <li key={`${crumb.name}-${index}`} className="flex items-center gap-x-2 shrink-0">
              {index > 0 && (
                // Plain slash rather than a chevron: a "›" points the wrong
                // way once the page flips to RTL for Hebrew.
                <span aria-hidden="true" className="text-gray-300 select-none">/</span>
              )}
              {isLast || !crumb.url ? (
                <span className="text-gray-900" aria-current="page">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.url} className="hover:text-gray-900 hover:underline">
                  {crumb.name}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
