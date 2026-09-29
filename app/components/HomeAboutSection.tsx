import Link from 'next/link'

/**
 * "About the store" band on the home page, design system 438:3234.
 *
 * Two columns: the eyebrow and the oversized heading on the inline start, the
 * standfirst and a rule-underlined link on the inline end. The frame lays these
 * out as col-2 / col-1 of an LTR artboard - i.e. heading right, copy left - so
 * here the heading column simply comes first and mirrors on its own.
 */
export default function HomeAboutSection({
  lng,
  eyebrow,
  heading,
  body,
  linkLabel,
  href,
}: {
  lng: 'en' | 'he'
  eyebrow: string
  heading: string
  body: string
  linkLabel: string
  href?: string
}) {
  return (
    <section
      // 116px is the frame's desktop size (Typography/Heading/H2). Home / Mobile
      // is a separate frame and has not been read yet, so the small-screen step is
      // a proportional guess rather than a spec - revisit with 438:3416.
      className="grid grid-cols-1 items-end gap-x-[151px] gap-y-[20px] px-[16px] py-[45px] lg:grid-cols-2 lg:px-[36px]"
    >
      <div className="flex flex-col gap-[20px]">
        {/* Typography/Price/Strong — Black 20, the same weight as the heading. */}
        <p className="font-ploni text-[20px] font-black leading-none text-text-primary">
          {eyebrow}
        </p>
        <h2 className="font-ploni text-[48px] font-black leading-[44px] text-text-primary lg:text-[116px] lg:leading-[100px]">
          {heading}
        </h2>
      </div>

      <div className="flex flex-col items-start gap-[10px] lg:h-[200px] lg:justify-end">
        {/* Typography/Paragraph/Large — 21 / 32.55. */}
        <p className="font-ploni text-[17px] leading-[26px] text-text-primary lg:text-[21px] lg:leading-[32.55px]">
          {body}
        </p>

        {/* The link is underlined by a real border rather than text-decoration, so
            the rule sits 6px clear of the baseline as the frame draws it. */}
        {href ? (
          <Link
            href={`/${lng}${href}`}
            className="inline-flex items-center gap-[10px] border-b border-border-default pb-[6px] transition-opacity hover:opacity-70"
          >
            <span className="font-ploni text-[12px] tracking-[1.2px] text-text-primary">
              {linkLabel}
            </span>
            {/* 438:3242 is a 7px square turned on its corner. Drawn in CSS for the
                same reason as the collection bar's caret - it is a geometric
                primitive, not artwork. */}
            <i
              aria-hidden="true"
              className="block size-[7px] shrink-0 rotate-45 border-b border-l border-text-primary"
            />
          </Link>
        ) : null}
      </div>
    </section>
  )
}
