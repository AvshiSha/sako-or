import Link from 'next/link'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import FaqAnswer from '@/app/components/FaqAnswer'
import { faqAnswerElementId, faqQuestionElementId } from '@/lib/faq-slug'
import { pickLocalized, type FaqLocale } from '@/lib/faq-selectors'
import type { FaqAudience, FaqCta, FaqItem } from '@/lib/faq-types'
import { cn } from '@/lib/utils'
import {
  MEASURE,
  RULED_BLOCK,
  TWO_TRACK,
  TYPE_BLOCK_TITLE,
  TYPE_LABEL,
} from '@/app/components/pageChrome'

interface FaqAudienceSectionProps {
  audience: FaqAudience
  title: string
  items: readonly FaqItem[]
  locale: FaqLocale
  lng: string
  cta?: FaqCta
}

/**
 * One audience section, rendered entirely on the server.
 *
 * Every answer's full HTML is in this output — the panels ship `hidden`, not
 * empty. That is what makes the content available to a crawler that never
 * clicks anything, and it is why nothing here is fetched on open.
 *
 * Heading levels: the section title is a styled <p> referenced by
 * aria-labelledby, not an <h2>. Each accordion question is the <h2>, per the
 * required markup contract, so making the section titles h2 as well would flatten
 * the outline into two peer levels of different things. The section keeps its
 * accessible name through aria-labelledby either way.
 */
export default function FaqAudienceSection({
  audience,
  title,
  items,
  locale,
  lng,
  cta,
}: FaqAudienceSectionProps) {
  if (items.length === 0) return null

  const titleId = `faq-section-${audience}-title`
  const dir = locale === 'he' ? 'rtl' : 'ltr'

  return (
    // Two-track (438:3234): the audience title on the inline start, its
    // questions opposite. The classes the accordion client keys off -
    // .faq-item, .faq-trigger, .faq-trigger-text, data-faq-* and data-open -
    // are untouched; only the shell around them moved onto the design system.
    <section
      id={`faq-section-${audience}`}
      aria-labelledby={titleId}
      className={cn('faq-section', RULED_BLOCK, TWO_TRACK)}
    >
      <p id={titleId} className={TYPE_BLOCK_TITLE}>
        {title}
      </p>

      {/* List and CTA share one grid cell. Left as siblings they are separate
          grid items, and the CTA auto-places into the next row's first track -
          i.e. under the audience title, in the narrow label column, away from
          the questions it belongs to. */}
      <div className={cn(MEASURE, 'w-full')}>
      <div className="faq-list">
        {items.map((item) => {
          const question = pickLocalized(item.question, locale)
          const answerHtml = pickLocalized(item.answerHtml, locale)
          const shortAnswer = pickLocalized(item.shortAnswer, locale)
          const questionId = faqQuestionElementId(item.slug)
          const answerId = faqAnswerElementId(item.slug)

          return (
            <div
              key={item.slug}
              className="faq-item"
              // The delegated click handler reads its analytics context from
              // these, so the client component never has to carry item data.
              data-faq-slug={item.slug}
              data-faq-audience={item.audience}
              data-faq-topic={item.topic}
            >
              <h2 className="faq-question-heading">
                {/* Type lives on utilities, not in the stylesheet: --font-ploni
                    is declared in `@theme inline` and so is empty at :root, which
                    makes `font-family: var(--font-ploni)` in hand-written CSS a
                    no-op. The .faq-* rules therefore carry colour and structure
                    only. */}
                <button
                  type="button"
                  id={questionId}
                  aria-expanded="false"
                  aria-controls={answerId}
                  className="faq-trigger font-ploni text-[16px] font-bold leading-[26px]"
                >
                  <span className="faq-trigger-text">{question}</span>
                  <ChevronDownIcon className="faq-chevron" aria-hidden="true" />
                </button>
              </h2>

              <div
                id={answerId}
                role="region"
                aria-labelledby={questionId}
                className="faq-panel"
                hidden
              >
                {/* font-ploni here rather than on each child: the answer HTML
                    comes from the CMS, so everything inside has to inherit the
                    face rather than be given a class. */}
                <div className="faq-panel-inner font-ploni text-[16px] leading-[26px]">
                  {shortAnswer && (
                    <p className="faq-short-answer font-bold">{shortAnswer}</p>
                  )}
                  <FaqAnswer html={answerHtml} dir={dir} tableLabel={question} />

                  {item.relatedLinks && item.relatedLinks.length > 0 && (
                    <ul className="faq-related-links">
                      {item.relatedLinks.map((related) => {
                        const label = pickLocalized(related.label, locale)
                        if (!label) return null
                        return (
                          <li key={`${item.slug}-${related.href}`}>
                            <Link
                              href={`/${lng}${related.href}`}
                              className={cn('faq-related-link', TYPE_LABEL)}
                              data-faq-cta="related"
                            >
                              {label}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {cta && pickLocalized(cta.label, locale) && (
        <div className="faq-cta-row">
          {/* A real anchor, not a router push: this has to be crawlable and
              middle-clickable like any other link on the site. */}
          <Link
            href={`/${lng}${cta.href}`}
            className="faq-cta font-ploni text-[12px] font-bold"
            data-faq-cta={audience === 'men' ? 'secondary' : 'primary'}
          >
            {pickLocalized(cta.label, locale)}
          </Link>
        </div>
      )}
      </div>
    </section>
  )
}
