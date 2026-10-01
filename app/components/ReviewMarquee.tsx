import type { FeaturedReview } from '@/lib/reviews/featured-reviews'

/**
 * The moving review band on the About page.
 *
 * Built on the design system's existing vocabulary rather than a new one: paper
 * ground, hairline rules, Ploni, sharp corners. The heading row is the same
 * ruled header the blog list and the About chapters use, and the cards borrow
 * the blog tile's caption block - 20px Black for the name, Body/Regular for the
 * words.
 *
 * There is no JavaScript here at all, by design, and the component is a server
 * component as a result. The first version drove reduced-motion and
 * pause-on-hover from React state, and the two could disagree with the
 * stylesheet: with the OS set to reduce motion, CSS correctly stopped the
 * animation while the component still believed it was running, so it kept the
 * container `overflow-hidden` and every card past the third was unreachable.
 * Anything CSS can decide for itself is therefore left to CSS, and the band
 * behaves identically before and after hydration:
 *
 *   - the container always scrolls, so the full list is reachable whether or not
 *     the animation is running;
 *   - `:hover` / `:focus-within` pause the animation (see globals.css), so a
 *     quote can be read and a card tabbed to without it sliding away;
 *   - `prefers-reduced-motion` stops it outright - an auto-scrolling marquee is
 *     exactly the vestibular trigger that setting exists for - and the band is
 *     then an ordinary horizontally scrollable list.
 *
 * The track holds the reviews twice and travels exactly one copy's width, so the
 * loop has no seam. Duration scales with the card count, so featuring another
 * review slows the band rather than making the same card whip past faster. The
 * duplicate copy is `aria-hidden`, so a screen reader hears each review once.
 */

interface ReviewMarqueeProps {
  reviews: FeaturedReview[]
  heading: string
  /** Short label opposite the heading, e.g. "ממה שלקוחות כותבים". */
  label: string
}

/** Seconds on screen per card. 7s reads comfortably at this card width. */
const SECONDS_PER_CARD = 7

export default function ReviewMarquee({ reviews, heading, label }: ReviewMarqueeProps) {
  // Nothing featured yet: render nothing rather than a ruled band and a heading
  // over blank paper.
  if (reviews.length === 0) return null

  return (
    <section aria-label={heading} className="sako-marquee border-t border-sako-black">
      {/* Same ruled header as the About chapters above it. */}
      <div className="flex items-end justify-between gap-[16px] px-[16px] py-[20px] lg:px-[36px] lg:py-[33px]">
        <h2 className="font-ploni text-[32px] font-black leading-[28px] text-text-primary lg:text-[48px] lg:leading-[34.56px]">
          {heading}
        </h2>
        <p className="shrink-0 border-b border-border-default pb-[6px] font-ploni text-[12px] font-semibold tracking-[1.2px] text-text-primary">
          {label}
        </p>
      </div>

      {/* Always a scroll container, animating or not - that is what guarantees
          the later reviews are reachable when the animation is off. Safe to
          combine with the transform because the track always travels toward the
          inline start, and browsers do not add inline-start overflow to the
          scrollable area. */}
      <div
        tabIndex={0}
        role="group"
        aria-label={label}
        className="overflow-x-auto border-t border-sako-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul
          className="animate-sako-marquee flex w-max"
          style={{ animationDuration: `${reviews.length * SECONDS_PER_CARD}s` }}
        >
          {reviews.map((review) => (
            <ReviewCardItem key={review.id} review={review} />
          ))}

          {/* The seamless half: hidden from assistive tech so the same quote is
              not announced twice. Rendered unconditionally - with the animation
              off it simply becomes more of the scrollable list. */}
          {reviews.map((review) => (
            <ReviewCardItem key={`echo-${review.id}`} review={review} ariaHidden />
          ))}
        </ul>
      </div>
    </section>
  )
}

function ReviewCardItem({
  review,
  ariaHidden = false,
}: {
  review: FeaturedReview
  ariaHidden?: boolean
}) {
  return (
    <li
      aria-hidden={ariaHidden || undefined}
      // border-s on every card: the leading hairline rides off the edge with the
      // card as the track moves, so no negative-margin trick is needed here.
      className="flex w-[300px] shrink-0 flex-col gap-[14px] border-s border-sako-black px-[16px] py-[30px] lg:w-[420px] lg:px-[36px] lg:py-[45px]"
    >
      <Stars value={review.rating} />

      <blockquote className="flex-1 font-ploni text-[16px] leading-[26px] text-start text-text-primary lg:text-[17px]">
        &ldquo;{review.quote}&rdquo;
      </blockquote>

      <footer className="flex flex-col gap-[4px]">
        <p className="font-ploni text-[20px] font-black text-start text-text-primary">
          {review.author}
        </p>
        {review.products.length > 0 ? (
          <p className="font-ploni text-[12px] tracking-[1.2px] text-start text-text-secondary">
            {review.products.join(' · ')}
          </p>
        ) : null}
      </footer>
    </li>
  )
}

/**
 * Five glyphs, the filled ones carrying the score. `aria-label` states the
 * rating in words because a row of stars read out character by character tells
 * a screen-reader user nothing.
 */
function Stars({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)))
  return (
    <p
      aria-label={`${filled}/5`}
      className="font-ploni text-[14px] leading-none tracking-[2px] text-text-primary"
    >
      <span aria-hidden="true">
        {'★'.repeat(filled)}
        <span className="text-sako-gray-500">{'★'.repeat(5 - filled)}</span>
      </span>
    </p>
  )
}
