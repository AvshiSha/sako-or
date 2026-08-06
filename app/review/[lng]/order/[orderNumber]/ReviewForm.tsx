'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { getColorHex, getColorName, hasColorTranslation } from '@/lib/colors'
import { reviewPageCopy } from './copy'

/**
 * Review capture form.
 *
 * Design rules applied here, with sources:
 *  - Every tappable control is at least 44x44px (Vercel Frontend Engineering
 *    Guidelines, p.4 §22.1) — this page is mostly mobile traffic from an SMS link,
 *    and the stars and fit pills are the primary interactions.
 *  - Tap feedback via `active:scale-[0.98]`, and hover styles only where hover
 *    actually exists (Tailwind's `hover:` compiles to `@media (hover: hover)`),
 *    so touch devices never get stuck hover states (ibid. §22.2).
 *  - Every control keeps a visible focus ring (ibid. §26; Awesome Design.md p.31,
 *    p.47 — Notion and Stripe both standardise a 2px focus outline).
 *  - Inputs render at 16px so iOS Safari does not zoom on focus (Awesome
 *    Design.md pp. 24/31/47 — Linear, Notion and Stripe all set input text at 16px).
 *  - Logical properties only (ms-/me-/ps-/pe-/text-start), never left/right, so the
 *    Hebrew RTL layout mirrors without a second stylesheet (Vercel FEG p.4 §24.2).
 *  - Selected state never relies on colour alone: a chosen star changes glyph
 *    (outline to solid) and a chosen fit pill gains a checkmark plus a border
 *    change (Awesome Design.md pp. 2, 31 — Airbnb and Notion both pair colour with
 *    a shape or scale change).
 *  - Errors are announced with role="alert", tied to their field via
 *    aria-describedby, and the first invalid control receives focus (ibid. §15.2).
 *  - 8px spacing rhythm with 16/24/32 grouping tiers (Awesome Design.md pp. 2, 24,
 *    31, 47 — the value Airbnb, Linear, Notion and Stripe independently converge on).
 *
 * Client-side validation is a convenience only: the API re-verifies the signed token
 * and re-checks that every submitted item belongs to the order.
 */

const SIZING_VALUES = ['runs_small', 'true_to_size', 'runs_large'] as const
type SizingFit = (typeof SIZING_VALUES)[number]

const BODY_MAX = 4000
/** Only surface the counter near the limit — a permanent count is noise. */
const COUNTER_THRESHOLD = 40

interface Item {
  id: string
  productName: string
  productSku: string
  colorName: string | null
  size: string | null
  primaryImage: string | null
  quantity: number
}

interface ReviewFormProps {
  language: 'he' | 'en'
  orderNumber: string
  token: string
  customerName: string | null
  items: Item[]
  googleReviewUrl: string | null
}

interface ProductState {
  rating: number
  body: string
  sizingFit: SizingFit | null
}

export default function ReviewForm({
  language,
  orderNumber,
  token,
  customerName,
  items,
  googleReviewUrl,
}: ReviewFormProps) {
  const copy = reviewPageCopy[language]

  const [overallRating, setOverallRating] = useState(0)
  const [serviceRating, setServiceRating] = useState(0)
  const [deliveryRating, setDeliveryRating] = useState(0)
  const [packagingRating, setPackagingRating] = useState(0)
  const [serviceComment, setServiceComment] = useState('')
  const [deliveryComment, setDeliveryComment] = useState('')
  const [packagingComment, setPackagingComment] = useState('')
  const [products, setProducts] = useState<Record<string, ProductState>>(() =>
    Object.fromEntries(items.map((item) => [item.id, { rating: 0, body: '', sizingFit: null }]))
  )
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [succeeded, setSucceeded] = useState(false)

  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)

  const updateProduct = useCallback((itemId: string, patch: Partial<ProductState>) => {
    setProducts((previous) => ({ ...previous, [itemId]: { ...previous[itemId], ...patch } }))
  }, [])

  const ratedCount = items.filter((item) => (products[item.id]?.rating ?? 0) > 0).length

  // Move focus to the outcome so it is announced and the user is not left at the
  // bottom of a form that has visually changed above them.
  useEffect(() => {
    if (succeeded) successRef.current?.focus()
  }, [succeeded])

  useEffect(() => {
    if (showErrors && errors.length > 0) errorSummaryRef.current?.focus()
  }, [showErrors, errors])

  function collectErrors(): string[] {
    const found: string[] = []
    if (overallRating === 0) found.push(copy.errorOverall)
    for (const item of items) {
      if ((products[item.id]?.rating ?? 0) === 0) {
        found.push(copy.errorProduct(item.productName))
      }
    }
    return found
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const found = collectErrors()
    if (found.length > 0) {
      setErrors(found)
      setShowErrors(true)
      return
    }

    setErrors([])
    setShowErrors(false)
    setSubmitting(true)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          token,
          overallRating,
          // 0 means "not answered" in local state; the API expects null.
          serviceRating: serviceRating || null,
          deliveryRating: deliveryRating || null,
          packagingRating: packagingRating || null,
          serviceComment: serviceComment || null,
          deliveryComment: deliveryComment || null,
          packagingComment: packagingComment || null,
          language,
          products: items.map((item) => ({
            orderItemId: item.id,
            rating: products[item.id].rating,
            body: products[item.id].body || null,
            sizingFit: products[item.id].sizingFit,
          })),
        }),
      })

      const data = await response.json()

      // A repeat submission is a success from the customer's point of view.
      if (data.success || data.alreadyReviewed) {
        setSucceeded(true)
        return
      }

      setErrors([data.messages?.[language] ?? copy.errorGeneric])
      setShowErrors(true)
    } catch {
      setErrors([copy.errorGeneric])
      setShowErrors(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (succeeded) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="py-4 text-center outline-none"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-3xl text-emerald-600"
        >
          ✓
        </div>
        <h1 className="text-[22px] font-bold text-neutral-900">{copy.successTitle}</h1>
        <p className="mx-auto mt-3 max-w-[42ch] text-[15px] leading-7 text-neutral-600">
          {copy.successBody}
        </p>

        {googleReviewUrl ? (
          <div className="mt-8 border-t border-neutral-200 pt-6">
            <p className="mx-auto max-w-[42ch] text-[14px] leading-6 text-neutral-500">
              {copy.googleNote}
            </p>
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-neutral-900 px-6 text-[15px] font-semibold text-neutral-900 transition active:scale-[0.98] hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              {copy.googleCta}
            </a>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="mb-6 text-center text-[13px] font-semibold tracking-[0.3em] text-neutral-400">
        SAKO OR
      </p>

      <h1 className="text-[24px] font-bold leading-8 text-neutral-900">{copy.title}</h1>
      <p className="mt-2 max-w-[46ch] text-[15px] leading-7 text-neutral-600">
        {customerName ? `${customerName.split(/\s+/)[0]} — ` : ''}
        {copy.intro}
      </p>
      <p className="mt-1 text-[13px] text-neutral-400">
        {copy.orderLabel} {orderNumber}
      </p>

      {/* Overall rating — first and visually heaviest: it is the one question
          every customer can answer without thinking. */}
      <section className="mt-8 rounded-xl bg-neutral-50 p-5 text-center ring-1 ring-neutral-900/5">
        <h2 className="text-[15px] font-semibold text-neutral-800">{copy.overallLabel}</h2>
        <div className="mt-3 flex justify-center">
          <StarRating
            value={overallRating}
            onChange={(value) => {
              setOverallRating(value)
              if (showErrors) setErrors(collectErrors())
            }}
            label={copy.overallLabel}
            starLabel={copy.starLabel}
            invalid={showErrors && overallRating === 0}
            size="lg"
          />
        </div>
        <p aria-live="polite" className="mt-2 h-5 text-[13px] font-medium text-neutral-500">
          {overallRating > 0 ? copy.ratingWords[overallRating] : ''}
        </p>
      </section>

      {/* Products */}
      <div className="mt-8 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-neutral-900">{copy.productsHeading}</h2>
        {items.length > 1 ? (
          <span aria-live="polite" className="text-[13px] tabular-nums text-neutral-500">
            {copy.progress(ratedCount, items.length)}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {items.map((item) => {
          const state = products[item.id]
          const missing = showErrors && state.rating === 0
          return (
            <section
              key={item.id}
              className={`rounded-xl border p-4 transition-colors ${
                missing ? 'border-red-300 bg-red-50/40' : 'border-neutral-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.primaryImage ? (
                  <Image
                    src={item.primaryImage}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-neutral-900/5"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-16 w-16 shrink-0 rounded-lg bg-neutral-100"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold text-neutral-900">
                    {item.productName}
                  </h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-neutral-500">
                    {item.size ? (
                      <span>
                        {copy.size}: {item.size}
                      </span>
                    ) : null}
                    {item.size && item.colorName ? <span aria-hidden="true">·</span> : null}
                    {item.colorName ? <ColorLabel slug={item.colorName} language={language} label={copy.color} /> : null}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <FieldLabel>{copy.productRatingLabel}</FieldLabel>
                <StarRating
                  value={state.rating}
                  onChange={(rating) => {
                    updateProduct(item.id, { rating })
                    if (showErrors) {
                      setErrors(
                        collectErrors().filter((e) => e !== copy.errorProduct(item.productName))
                      )
                    }
                  }}
                  label={`${copy.productRatingLabel} — ${item.productName}`}
                  starLabel={copy.starLabel}
                  invalid={missing}
                />
              </div>

              <div className="mt-4">
                <FieldLabel optional={copy.optional}>{copy.sizingLabel}</FieldLabel>
                <div role="group" aria-label={copy.sizingLabel} className="flex flex-wrap gap-2">
                  {SIZING_VALUES.map((value) => {
                    const selected = state.sizingFit === value
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          updateProduct(item.id, { sizingFit: selected ? null : value })
                        }
                        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[14px] transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
                          selected
                            ? 'border-neutral-900 bg-neutral-900 font-semibold text-white'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'
                        }`}
                      >
                        {/* Checkmark, not just colour, marks the selection. */}
                        <span aria-hidden="true" className={selected ? '' : 'hidden'}>
                          ✓
                        </span>
                        {copy.sizingOptions[value]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4">
                <FieldLabel htmlFor={`body-${item.id}`} optional={copy.optional}>
                  {copy.reviewBodyLabel}
                </FieldLabel>
                <textarea
                  id={`body-${item.id}`}
                  rows={3}
                  maxLength={BODY_MAX}
                  value={state.body}
                  placeholder={copy.reviewBodyPlaceholder}
                  onChange={(event) => updateProduct(item.id, { body: event.target.value })}
                  className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2.5 text-[16px] leading-6 text-neutral-900 placeholder:text-neutral-400 focus-visible:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-neutral-900"
                />
                <CharCount value={state.body} max={BODY_MAX} copy={copy} />
              </div>
            </section>
          )
        })}
      </div>

      {/* Service and delivery. Shown open rather than behind a disclosure: these
          are the questions the business most wants answered, and a collapsed
          section reads as "skip me". */}
      <section className="mt-8">
        <h2 className="text-[17px] font-semibold text-neutral-900">{copy.moreHeading}</h2>
        <p className="mt-1 text-[13px] text-neutral-500">{copy.moreIntro}</p>

        <div className="mt-4 space-y-4">
          {/* Service */}
          <div className="rounded-xl border border-neutral-200 p-4">
            <AspectRating
              label={copy.serviceRatingLabel}
              value={serviceRating}
              onChange={setServiceRating}
              starLabel={copy.starLabel}
              ratingWords={copy.ratingWords}
            />
            <div className="mt-4">
              <FieldLabel htmlFor="service-comment" optional={copy.optional}>
                {copy.serviceLabel}
              </FieldLabel>
              <textarea
                id="service-comment"
                rows={2}
                maxLength={BODY_MAX}
                value={serviceComment}
                onChange={(event) => setServiceComment(event.target.value)}
                className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2.5 text-[16px] leading-6 text-neutral-900 focus-visible:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-neutral-900"
              />
            </div>
          </div>

          {/* Delivery */}
          <div className="rounded-xl border border-neutral-200 p-4">
            <AspectRating
              label={copy.deliveryRatingLabel}
              value={deliveryRating}
              onChange={setDeliveryRating}
              starLabel={copy.starLabel}
              ratingWords={copy.ratingWords}
            />
            <div className="mt-4">
              <FieldLabel htmlFor="delivery-comment" optional={copy.optional}>
                {copy.deliveryLabel}
              </FieldLabel>
              <textarea
                id="delivery-comment"
                rows={2}
                maxLength={BODY_MAX}
                value={deliveryComment}
                onChange={(event) => setDeliveryComment(event.target.value)}
                className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2.5 text-[16px] leading-6 text-neutral-900 focus-visible:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-neutral-900"
              />
            </div>
          </div>

          {/* Condition on arrival — distinct from the courier's handling above. */}
          <div className="rounded-xl border border-neutral-200 p-4">
            <AspectRating
              label={copy.packagingRatingLabel}
              hint={copy.packagingHint}
              value={packagingRating}
              onChange={setPackagingRating}
              starLabel={copy.starLabel}
              ratingWords={copy.ratingWords}
            />
            <div className="mt-4">
              <FieldLabel htmlFor="packaging-comment" optional={copy.optional}>
                {copy.packagingLabel}
              </FieldLabel>
              <textarea
                id="packaging-comment"
                rows={2}
                maxLength={BODY_MAX}
                value={packagingComment}
                onChange={(event) => setPackagingComment(event.target.value)}
                className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2.5 text-[16px] leading-6 text-neutral-900 focus-visible:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-neutral-900"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Error summary: named problems, listed, focusable — not one generic line. */}
      {showErrors && errors.length > 0 ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 outline-none"
        >
          <p className="text-[14px] font-semibold text-red-800">{copy.errorSummaryTitle}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-[14px] text-red-700">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="mt-6 w-full min-h-[52px] rounded-xl bg-neutral-900 px-6 text-[16px] font-semibold text-white transition active:scale-[0.99] hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
      >
        {submitting ? copy.submitting : copy.submit}
      </button>
    </form>
  )
}

/**
 * Colour of a purchased item, localised.
 *
 * `OrderItem.colorName` stores the raw slug ("dark-brown"), which is unreadable to a
 * Hebrew-speaking customer. `getColorName` maps it through the shared translation
 * table in `lib/colors.ts` — the same table the order-confirmation email uses, so the
 * two messages name the same colour identically. Unknown slugs fall back to the raw
 * value rather than rendering blank.
 *
 * The swatch is decorative and paired with the name, never a substitute for it: a
 * dot alone would be unreadable to a colour-blind customer and meaningless to a
 * screen reader.
 */
function ColorLabel({
  slug,
  language,
  label,
}: {
  slug: string
  language: 'he' | 'en'
  label: string
}) {
  const name = getColorName(slug, language)
  const known = hasColorTranslation(slug)

  return (
    <span className="inline-flex items-center gap-1.5">
      {known ? (
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/15"
          style={{ backgroundColor: getColorHex(slug) }}
        />
      ) : null}
      <span>
        {label}: {name}
      </span>
    </span>
  )
}

function FieldLabel({
  children,
  htmlFor,
  optional,
}: {
  children: React.ReactNode
  htmlFor?: string
  optional?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[14px] font-semibold text-neutral-800"
    >
      {children}
      {/* Optional fields are marked, not required ones — required is the default,
          so marking it everywhere is noise. */}
      {optional ? (
        <span className="ms-1.5 text-[12px] font-normal text-neutral-400">({optional})</span>
      ) : null}
    </label>
  )
}

/**
 * An optional aspect rating (service, delivery, condition on arrival).
 *
 * Unlike the overall and per-product ratings these are never required, so the
 * control is not marked `aria-required` and never enters the error summary. The
 * chosen word ("מצוין") is echoed under the stars so the scale is unambiguous —
 * five stars means the same thing to everyone only once it is labelled.
 */
function AspectRating({
  label,
  hint,
  value,
  onChange,
  starLabel,
  ratingWords,
}: {
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
  starLabel: (n: number) => string
  ratingWords: readonly string[]
}) {
  return (
    <div>
      <p className="text-[15px] font-semibold text-neutral-800">{label}</p>
      {hint ? <p className="mt-0.5 text-[13px] text-neutral-500">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3">
        <StarRating value={value} onChange={onChange} label={label} starLabel={starLabel} />
        <span aria-live="polite" className="text-[13px] font-medium text-neutral-500">
          {value > 0 ? ratingWords[value] : ''}
        </span>
      </div>
    </div>
  )
}

/** Character counter that only appears as the limit approaches. */
function CharCount({
  value,
  max,
  copy,
}: {
  value: string
  max: number
  copy: (typeof reviewPageCopy)['he'] | (typeof reviewPageCopy)['en']
}) {
  const remaining = max - value.length
  if (remaining > COUNTER_THRESHOLD) return null
  return (
    <p aria-live="polite" className="mt-1 text-[12px] text-neutral-500 text-end">
      {copy.charsLeft(remaining)}
    </p>
  )
}

/**
 * Five-star input.
 *
 * Implemented as a WAI-ARIA radiogroup: each star is a radio, only the selected one
 * (or the first, when empty) is tabbable, and arrow keys move between them. That
 * roving-tabindex pattern is what makes the control usable by keyboard and by screen
 * readers without trapping the user in five separate tab stops.
 *
 * NOTE: this follows the WAI-ARIA Authoring Practices radio-group pattern from
 * general knowledge — the book that would have specified the canonical rating-widget
 * pattern was not readable on this account, so it is not a book-sourced choice.
 */
function StarRating({
  value,
  onChange,
  label,
  starLabel,
  invalid,
  size = 'md',
}: {
  value: number
  onChange: (value: number) => void
  label: string
  starLabel: (n: number) => string
  invalid?: boolean
  size?: 'md' | 'lg'
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  function focusStar(next: number) {
    const clamped = Math.min(5, Math.max(1, next))
    onChange(clamped)
    const button = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-star="${clamped}"]`
    )
    button?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    // In RTL the visual direction of the arrows is mirrored by the browser's own
    // handling of the flex row, so previous/next map to the same logical step.
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault()
        focusStar((value || 0) + 1)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault()
        focusStar((value || 2) - 1)
        break
      case 'Home':
        event.preventDefault()
        focusStar(1)
        break
      case 'End':
        event.preventDefault()
        focusStar(5)
        break
    }
  }

  const starSize = size === 'lg' ? 'text-[34px]' : 'text-[28px]'

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={label}
      aria-required="true"
      aria-invalid={invalid || undefined}
      onKeyDown={handleKeyDown}
      className="flex gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value
        return (
          <button
            key={star}
            type="button"
            role="radio"
            data-star={star}
            aria-checked={value === star}
            aria-label={starLabel(star)}
            // Roving tabindex: one tab stop for the whole group.
            tabIndex={value === star || (value === 0 && star === 1) ? 0 : -1}
            onClick={() => onChange(star)}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg leading-none transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${starSize} ${
              filled ? 'text-amber-400' : 'text-neutral-300 hover:text-amber-200'
            }`}
          >
            {/* Glyph changes shape, not just colour, so the selection survives
                greyscale and colour-blind rendering. */}
            <span aria-hidden="true">{filled ? '★' : '☆'}</span>
          </button>
        )
      })}
    </div>
  )
}
