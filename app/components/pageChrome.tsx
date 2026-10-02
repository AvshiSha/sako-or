import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The shell shared by the editorial storefront pages that have no Figma frame
 * of their own - About, Contact, FAQ.
 *
 * None of this is invented. Each constant is a construction approved on a
 * screen that does have a frame, so an unframed page still looks like it came
 * from the same designer and every choice has a node id behind it:
 *
 *   - RULED_BLOCK    - the Legal documents' 30px block and hairline
 *                      (438:4148 / 438:4153), at the collection's 36px desktop
 *                      gutter (438:2975).
 *   - RuledHeader    - the blog list's section header (438:3332): heading on
 *                      the inline start, a tracked label opposite.
 *   - TWO_TRACK      - the home page's About band (438:3234): a narrow label
 *                      column on the inline start, content opposite.
 *   - the type scale - H2 116/100, H6 48/34.56, Paragraph/Large 21/32.55,
 *                      Body/Regular 16, Label/DemiBold 12 at 1.2px tracking,
 *                      and the 14px/1.96px eyebrow from the blog cover (438:3319).
 *
 * These live in one module rather than being retyped per page because three
 * copies of the same literal is how a design system quietly drifts: the first
 * page to change its padding becomes the odd one out and nobody notices.
 *
 * Alignment is logical throughout (text-start, items-start). Figma's artboards
 * are LTR with Hebrew copy in them, so a frame's visual right is the logical
 * start; written this way the same markup mirrors correctly under /en. Direction
 * is inherited from the `dir` the [lng] layout puts on <html> and is never
 * resolved per node - copy opening on the Latin brand name would otherwise flip
 * a whole Hebrew block to LTR.
 */

/** Paper ground (#f2f2f2). Every one of these pages sits on it. */
export const PAGE_GROUND = 'bg-surface-secondary'

/** Horizontal inset only, for blocks that draw their own rule or none. */
export const PAGE_INSET = 'px-[16px] lg:px-[36px]'

/** A ruled section: hairline above, 30/45px of air, the page gutter. */
export const RULED_BLOCK = cn('border-t border-sako-black', PAGE_INSET, 'py-[30px] lg:py-[45px]')

/**
 * Label column on the inline start, content opposite (438:3234). 300px is wide
 * enough for a two-word Hebrew heading at 20px Black without wrapping.
 */
export const TWO_TRACK =
  'grid grid-cols-1 gap-x-[60px] gap-y-[14px] lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]'

/**
 * Reading measure for body copy. The two-track's second column runs to ~1300px
 * at 1728 and a 1300px line is unreadable; the air this leaves on the inline
 * end is the same air 438:3315 leaves around its heading.
 */
export const MEASURE = 'max-w-[760px]'

/** Typography/Heading/H2 - the page title. */
export const TYPE_PAGE_TITLE =
  'font-ploni text-[48px] font-black leading-[44px] text-start text-text-primary md:text-[72px] md:leading-[66px] lg:text-[116px] lg:leading-[100px]'

/** Typography/Heading/H6 - section headings and the one inverse closing line. */
export const TYPE_SECTION =
  'font-ploni text-[32px] font-black leading-[28px] text-text-primary lg:text-[48px] lg:leading-[34.56px]'

/** Typography/Price/Strong - 20px Black, for block headings inside a section. */
export const TYPE_BLOCK_TITLE = 'font-ploni text-[20px] font-black text-start text-text-primary'

/** Typography/Paragraph/Large - standfirsts and lead paragraphs. */
export const TYPE_LEAD =
  'font-ploni text-[17px] leading-[26px] text-start text-text-primary lg:text-[21px] lg:leading-[32.55px]'

/** Typography/Body/Regular. */
export const TYPE_BODY = 'font-ploni text-[16px] leading-[26px] text-start text-text-primary'

/** Typography/Label/DemiBold - 12px at 1.2px tracking. Colour is the caller's. */
export const TYPE_LABEL = 'font-ploni text-[12px] font-semibold tracking-[1.2px]'

/** The blog cover's eyebrow, 438:3319 - 14px at 1.96px tracking. */
export const TYPE_EYEBROW =
  'font-ploni text-[14px] leading-[23.1px] tracking-[1.96px] text-text-primary'

/**
 * 438:3332. Heading on the inline start, label opposite, hairline above.
 *
 * Draws only `border-t`: the block below supplies the rule underneath. Giving
 * this one a `border-b` as well stacks two hairlines into a 2px line, which is
 * the mistake the blog list made first.
 */
export function RuledHeader({
  heading,
  label,
  /** Rendered as h1 on pages whose visible title is the page title. */
  as: Tag = 'h2',
  className,
}: {
  heading: ReactNode
  label?: ReactNode
  as?: 'h1' | 'h2'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-end justify-between gap-[16px] border-t border-sako-black',
        PAGE_INSET,
        'py-[20px] lg:py-[33px]',
        className
      )}
    >
      <Tag className={TYPE_SECTION}>{heading}</Tag>
      {label ? (
        <p
          className={cn(
            TYPE_LABEL,
            'shrink-0 border-b border-border-default pb-[6px] text-text-primary'
          )}
        >
          {label}
        </p>
      ) : null}
    </div>
  )
}
