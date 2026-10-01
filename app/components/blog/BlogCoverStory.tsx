import Image from 'next/image'
import Link from 'next/link'
import InlineHeadingContent from '@/app/components/InlineHeadingContent'
import { BlogInlineLink } from './blogChrome'

/**
 * The cover story band, 438:3315.
 *
 * Two tracks on desktop: a 993.59px image (57.5%) beside a 734.41px text column
 * (42.5%), 740px tall. The text column is first in the DOM so it takes the first
 * grid track, which RTL lays out on the right - where the frame draws it. Under
 * /en the pair mirrors, which is the point of using order rather than sides.
 *
 * On phones the two stack with the image on top (flex-col-reverse over the same
 * DOM order), since there is no 390px Blog frame in the file to copy. Type steps
 * down from the frame's 116/100 heading, which is a desktop-width figure.
 *
 * Direction is inherited from the `dir` the [lng] layout puts on <html>, never
 * resolved per node - the same rule LegalPage follows. An article titled
 * "SAKO OR x ..." opens on a Latin word, and `dir="auto"` would read that first
 * strong character and flip the whole Hebrew title to LTR.
 */

interface BlogCoverStoryProps {
  href: string
  image: string
  imageAlt: string
  /** May carry inline CMS markup, so it goes through InlineHeadingContent. */
  titleHtml: string
  titleFallback: string
  excerpt: string
  eyebrow: string
  readLabel: string
}

export default function BlogCoverStory({
  href,
  image,
  imageAlt,
  titleHtml,
  titleFallback,
  excerpt,
  eyebrow,
  readLabel,
}: BlogCoverStoryProps) {
  return (
    <article className="flex flex-col-reverse lg:grid lg:min-h-[740px] lg:grid-cols-[42.5%_57.5%]">
      {/* 438:3318. items-start, not the frame's literal items-end: in Hebrew the
          logical start edge is the right one the frame aligns to. */}
      <div className="flex flex-col items-start p-[16px] sm:p-[30px] lg:p-[54px]">
        {/* 438:3319 - Latin in both languages. */}
        <p className="font-ploni text-[14px] leading-[23.1px] tracking-[1.96px] text-text-primary">
          {eyebrow}
        </p>

        {/* 438:3320 - the heading block takes the slack and pins the heading to
            its bottom edge, so the title hangs just above the paragraph however
            tall the band is. */}
        <div className="flex flex-1 flex-col justify-end pt-[24px] lg:pt-0">
          <h2 className="pb-[22px]">
            <Link
              href={href}
              className="block font-ploni text-[48px] font-black leading-[44px] text-start text-text-primary transition-opacity hover:opacity-70 md:text-[72px] md:leading-[66px] lg:text-[116px] lg:leading-[100px]"
            >
              <InlineHeadingContent html={titleHtml} fallback={titleFallback} />
            </Link>
          </h2>
        </div>

        {excerpt && (
          <div className="w-full py-[14px]">
            <p className="font-ploni text-[16px] leading-[26px] text-start text-text-primary lg:text-[21px] lg:leading-[32.55px]">
              {excerpt}
            </p>
          </div>
        )}

        {/* 438:3325 */}
        <Link href={href} className="mt-[8px] transition-opacity hover:opacity-70">
          <BlogInlineLink>{readLabel}</BlogInlineLink>
        </Link>
      </div>

      {/* 438:3316 */}
      <Link
        href={href}
        className="relative block aspect-[4/5] w-full sm:aspect-[16/10] lg:aspect-auto lg:h-[740px]"
      >
        {/* See BlogCard for why `sizes` exceeds the box: object-cover on a
            1.912 source in a narrower slot needs more image width than layout
            width. Above lg the band's height is pinned at 740px, so the width
            the picture needs is a constant 740 * 1.912 = 1415px whatever the
            viewport - no vw unit involved. Below that it follows the box ratio:
            16/10 needs 1.195x the width, 4/5 needs 2.39x. */}
        <Image
          src={image}
          alt={imageAlt}
          fill
          priority
          quality={85}
          sizes="(min-width: 1024px) 1415px, (min-width: 640px) 120vw, 239vw"
          className="object-cover"
        />
      </Link>
    </article>
  )
}
