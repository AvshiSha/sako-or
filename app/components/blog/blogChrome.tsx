/**
 * Chrome shared by the blog listing (438:3311, Blog / Desktop).
 *
 * The frame marks its inline links with a corner arrow vectored as an L plus a
 * diagonal, exported from Figma as `Rectangle 1` and living at
 * public/icons/sako/corner-arrow.svg. It is NOT the U+2199 glyph that
 * ProductStickyAddToCart and CollectionFilterPanel draw: those frames set the
 * mark as text where this one vectors it.
 *
 * The mark is drawn pointing down-left and turned 90 degrees by the frame. The
 * rotation is physical, not logical - it points at the page edge it sits beside
 * and must not swing when the document flips to LTR under /en.
 */

import { cn } from '@/lib/utils'

/**
 * 438:3328 / 438:3335. The vector is 7px; the exported SVG is 8px because the
 * 1px stroke is centred on the path, which is what the frame's -7.14% inset
 * compensates for. Reproduced here so the mark's optical size stays 7px and the
 * half-pixel of stroke bleeds outside the box, as it does in the design.
 */
export function CornerArrow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('relative block size-[7px] shrink-0 rotate-90', className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/sako/corner-arrow.svg"
        width={8}
        height={8}
        alt=""
        className="absolute left-[-0.5px] top-[-0.5px] max-w-none"
      />
    </span>
  )
}

/**
 * The inline "לקריאה" / "לכל המוצרים" link (438:3325, 438:3333): 12px Ploni
 * Regular, 1.2px tracking, the corner arrow leading it, underscored by a
 * hairline 6px below the baseline box.
 *
 * Label first, mark second, the same way ProductStickyAddToCart reads its own
 * frame: 438:3327 lays the row out left-to-right as mark-then-label on an LTR
 * artboard whose copy is Hebrew, so the mark is on the label's far side - its
 * left. Written logically it is the label's inline end, which keeps it opposite
 * the text under /en too.
 */
export function BlogInlineLink({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex flex-col items-start border-b border-border-default pb-[6px]">
      <span className="inline-flex items-center gap-[10px]">
        <span
          dir="auto"
          className="font-ploni text-[12px] tracking-[1.2px] text-sako-black"
        >
          {children}
        </span>
        <CornerArrow />
      </span>
    </span>
  )
}

/**
 * The blog list grid, 438:3338.
 *
 * The frame builds its divisions as an ink-900 ground showing through a 1px grid
 * gap, which is exact for the four tiles it draws and wrong for any other count:
 * a last row that does not fill paints its empty cells solid black. So the
 * hairlines are borders on the tiles instead, and the two that would land on the
 * page's own edges are pushed outside a clipping wrapper - BLOG_GRID_CLIP - by
 * the 1px offset. The tile's border-t doubles as the rule under the section
 * header, which is why that header draws only border-t of its own.
 */
export const BLOG_GRID_CLIP = 'overflow-hidden'
export const BLOG_GRID =
  '-ms-px grid w-[calc(100%+1px)] [&>*]:border-s [&>*]:border-t [&>*]:border-sako-black'
