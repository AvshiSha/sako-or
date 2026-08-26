import Link from 'next/link'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import FaqAnswer from '@/app/components/FaqAnswer'
import { faqAnswerElementId, faqQuestionElementId } from '@/lib/faq-slug'
import { pickLocalized, type FaqLocale } from '@/lib/faq-selectors'
import type { FaqAudience, FaqCta, FaqItem } from '@/lib/faq-types'

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
    <section id={`faq-section-${audience}`} aria-labelledby={titleId} className="faq-section">
      <p id={titleId} className="faq-section-title">
        {title}
      </p>

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
                <button
                  type="button"
                  id={questionId}
                  aria-expanded="false"
                  aria-controls={answerId}
                  className="faq-trigger"
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
                <div className="faq-panel-inner">
                  {shortAnswer && (
                    <p className="faq-short-answer">{shortAnswer}</p>
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
                              className="faq-related-link"
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
            className="faq-cta"
            data-faq-cta={audience === 'men' ? 'secondary' : 'primary'}
          >
            {pickLocalized(cta.label, locale)}
          </Link>
        </div>
      )}
    </section>
  )
}
