import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shell for the legal documents, from the Legal frames in Figma file
 * Q7WqJRF5rqxc4V7zqdpQUM - 438:4141 (desktop, 1728px) and 438:3872 (mobile, 390px).
 *
 * The frame draws all four documents on one artboard: numbered 01-04, each a
 * 30px block on the paper ground, hairline-ruled between blocks. Every document
 * is its own route here, so the ordinal travels with the page and the hairline
 * separates the blocks *within* a document rather than the documents themselves.
 *
 * Both frames set the body to 14px; only the heading changes across them, 48/34.56
 * on the 390px source and 60/50 on the 1728px one. Alignment is logical
 * (text-start, items-start) rather than the frames' literal right, because these
 * same pages render LTR under /en - in Hebrew the logical start *is* that right
 * edge. `dir="auto"` on the text blocks reproduces what the frame does per node,
 * and keeps the ordinal on the correct side in both languages.
 */

/**
 * The 01-04 the frame prints before each title, keyed by page. `policies` has no
 * section in the design - it is numbered after the four that are drawn.
 */
export const LEGAL_ORDINALS: Record<string, string> = {
  terms: '01',
  privacy: '02',
  'shipping-and-returns': '03',
  accessibility: '04',
  policies: '05',
}

/** 438:4148 - the 30px block every heading and section sits in. */
const BLOCK = 'flex flex-col items-stretch gap-[10px] p-[30px]'

/** 438:4153 - the rule between blocks. The frame binds black/pure, not border-default. */
const RULE = 'border-t border-sako-black'

/** Typography/Body/Small - 14px Ploni Regular, the only body size in either frame. */
export const LEGAL_BODY = 'font-ploni text-[14px] text-start text-text-primary'

interface LegalPageProps {
  /** Two-digit ordinal printed before the title. Omitted for non-legal pages. */
  ordinal?: string
  title: ReactNode
  /** Pre-formatted, e.g. "עודכן לאחרונה: 31 ביולי 2026". */
  lastUpdated?: string
  /**
   * Copy rendered inside the heading block, under the date. The frame keeps the
   * heading, the date and the document's opening copy in one 30px block and
   * rules only *between* documents, so anything that would read as the opening
   * of this document belongs here rather than in a ruled section below.
   */
  body?: ReactNode
  children?: ReactNode
}

export default function LegalPage({
  ordinal,
  title,
  lastUpdated,
  body,
  children,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className={BLOCK}>
        <h1
          dir="auto"
          className="font-ploni text-[48px] font-black leading-[34.56px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]"
        >
          {ordinal ? `${ordinal} ` : ''}
          {title}
        </h1>

        {(lastUpdated || body) && (
          <div dir="auto" className={cn(LEGAL_BODY, 'space-y-[14px]')}>
            {lastUpdated && <p>{lastUpdated}</p>}
            {body}
          </div>
        )}
      </div>

      {children}
    </div>
  )
}

interface LegalSectionProps {
  /**
   * Rendered as an h2 so the document keeps its outline. The frame shows section
   * headings at body size with no weight of their own, but it only ever draws a
   * four-paragraph excerpt - the real privacy statement runs to ten sections, and
   * with no distinction at all its outline disappears. Bold is the smallest
   * departure that keeps it scannable and stays inside the design's type scale.
   */
  title?: ReactNode
  children: ReactNode
  className?: string
}

export function LegalSection({ title, children, className }: LegalSectionProps) {
  return (
    <section dir="auto" className={cn(RULE, BLOCK, LEGAL_BODY, className)}>
      {title && <h2 className="font-bold">{title}</h2>}
      {children}
    </section>
  )
}
