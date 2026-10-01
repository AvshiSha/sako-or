import Image from 'next/image'
import Link from 'next/link'
import InlineHeadingContent from '@/app/components/InlineHeadingContent'

/**
 * One tile in the blog list, 438:3339.
 *
 * 431.25 x 564 on the frame: a 507.35px image over a 76px caption ruled off by a
 * hairline. The aspect ratio is kept rather than the pixel height, so the tile
 * scales with however many columns the viewport gets.
 *
 * The caption is title-then-link in the DOM with justify-between, which puts the
 * title on the inline start - the right, in Hebrew, as the frame draws it - and
 * the read link opposite. The frame sets the read label as text with U+2199
 * inside it (not the vectored mark the section header uses), so the glyph stays
 * part of the string and BiDi places it at the visual end of the run.
 */

interface BlogCardProps {
  href: string
  image?: string
  imageAlt: string
  /** May carry inline CMS markup, so it goes through InlineHeadingContent. */
  titleHtml: string
  titleFallback: string
  readLabel: string
}

export default function BlogCard({
  href,
  image,
  imageAlt,
  titleHtml,
  titleFallback,
  readLabel,
}: BlogCardProps) {
  return (
    <Link href={href} className="group flex flex-col bg-surface-secondary">
      {/* 438:3340
          `sizes` is deliberately far larger than the tile. It has to describe
          the width of the IMAGE, not of the box, and object-cover on a mismatched
          ratio makes those two different numbers: the slot is 431x507 (0.850)
          while every blog featured image in Firebase is 1650x863 (1.912), so
          covering scales to the height and the picture is 1.912/0.850 = 2.25x
          wider than the tile before it is cropped. Describing the box instead
          fetched the 500px candidate for a slot needing 970px and the tiles
          rendered visibly soft. The multiplier is tied to the 1.912 library
          ratio; a portrait upload just over-fetches, which is the safe direction.
          1280px/640px are the xl/sm breakpoints the grid switches columns on. */}
      <div className="relative aspect-[431/507] w-full overflow-hidden">
        {image && (
          <Image
            src={image}
            alt={imageAlt}
            fill
            quality={85}
            sizes="(min-width: 1280px) 57vw, (min-width: 640px) 113vw, 225vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        )}
      </div>

      {/* 438:3342 - the frame binds black/pure here, not border-default. */}
      <div className="flex min-h-[76px] items-center justify-between gap-[16px] border-t border-sako-black px-[16px] pb-[14px] pt-[15px]">
        <h3
          dir="auto"
          className="font-ploni text-[20px] font-black text-start text-text-primary"
        >
          <InlineHeadingContent html={titleHtml} fallback={titleFallback} />
        </h3>

        {/* 438:3344 */}
        <span
          dir="auto"
          className="shrink-0 self-center whitespace-nowrap border-b border-border-default pb-[6px] font-ploni text-[11px] font-bold text-text-primary"
        >
          {readLabel}
        </span>
      </div>
    </Link>
  )
}
