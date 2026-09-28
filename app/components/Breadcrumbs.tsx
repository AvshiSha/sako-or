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
    // 438:2629 — a 50px rule under the header, inset 36px on desktop. No justify
    // class: the frame pushes the trail to the right, which in RTL is simply the
    // inline start, so the default start alignment mirrors correctly in both
    // languages. Reading justify-end off the LTR artboard would pin it left in Hebrew.
    <nav
      aria-label="Breadcrumb"
      className={`flex h-[50px] items-center border-b border-border-default px-4 sm:px-6 lg:px-[36px] ${className}`}
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
      {/* Typography/Caption: Ploni Regular 9 with a 0.72px track. */}
      <ol className="flex flex-nowrap items-center gap-x-2 overflow-x-auto whitespace-nowrap no-scrollbar font-ploni text-[9px] tracking-[0.72px] text-text-primary">
        {usable.map((crumb, index) => {
          const isLast = index === usable.length - 1
          return (
            <li key={`${crumb.name}-${index}`} className="flex items-center gap-x-2 shrink-0">
              {index > 0 && (
                // Plain slash rather than a chevron: a "›" points the wrong
                // way once the page flips to RTL for Hebrew.
                // The slash is a size up from the labels and untracked (438:2633).
                <span aria-hidden="true" className="select-none text-[10px] tracking-normal">/</span>
              )}
              {isLast || !crumb.url ? (
                <span aria-current="page">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.url} className="transition-opacity hover:opacity-70">
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
