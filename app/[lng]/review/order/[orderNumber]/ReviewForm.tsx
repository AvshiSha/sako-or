'use client'

import { useState } from 'react'
import { reviewPageCopy } from './copy'

/**
 * Review capture form.
 *
 * Client-side validation here is a convenience only — the API re-verifies the signed
 * token and re-checks that every submitted item belongs to the order, so nothing
 * enforced in this component is load-bearing for correctness or security.
 */

const SIZING_VALUES = ['runs_small', 'true_to_size', 'runs_large'] as const
type SizingFit = (typeof SIZING_VALUES)[number]

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
  title: string
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
  const isRtl = language === 'he'

  const [overallRating, setOverallRating] = useState(0)
  const [serviceComment, setServiceComment] = useState('')
  const [deliveryComment, setDeliveryComment] = useState('')
  const [products, setProducts] = useState<Record<string, ProductState>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, { rating: 0, title: '', body: '', sizingFit: null }])
    )
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)

  function updateProduct(itemId: string, patch: Partial<ProductState>) {
    setProducts((previous) => ({ ...previous, [itemId]: { ...previous[itemId], ...patch } }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const allRated =
      overallRating > 0 && items.every((item) => (products[item.id]?.rating ?? 0) > 0)

    if (!allRated) {
      setError(copy.requiredError)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          token,
          overallRating,
          serviceComment: serviceComment || null,
          deliveryComment: deliveryComment || null,
          language,
          products: items.map((item) => ({
            orderItemId: item.id,
            rating: products[item.id].rating,
            title: products[item.id].title || null,
            body: products[item.id].body || null,
            sizingFit: products[item.id].sizingFit,
          })),
        }),
      })

      const data = await response.json()

      // A repeat submission is a success from the customer's perspective.
      if (data.success || data.alreadyReviewed) {
        setSucceeded(true)
        return
      }

      setError(data.messages?.[language] ?? copy.requiredError)
    } catch {
      setError(copy.requiredError)
    } finally {
      setSubmitting(false)
    }
  }

  if (succeeded) {
    return (
      <div>
        <h1 style={styles.heading}>{copy.successTitle}</h1>
        <p style={styles.paragraph}>{copy.successBody}</p>
        {googleReviewUrl ? (
          <>
            <p style={styles.paragraph}>{copy.googleNote}</p>
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.googleButton}
            >
              {copy.googleCta}
            </a>
          </>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 style={styles.heading}>{copy.title}</h1>
      <p style={styles.paragraph}>
        {customerName ? `${customerName} — ` : ''}
        {copy.intro}
      </p>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>{copy.overallLabel}</legend>
        <StarRating value={overallRating} onChange={setOverallRating} isRtl={isRtl} />
      </fieldset>

      <h2 style={styles.subheading}>{copy.productsHeading}</h2>

      {items.map((item) => {
        const state = products[item.id]
        return (
          <div key={item.id} style={styles.itemCard}>
            <div style={{ ...styles.itemHeader, flexDirection: isRtl ? 'row-reverse' : 'row' }}>
              {item.primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.primaryImage} alt={item.productName} style={styles.itemImage} />
              ) : null}
              <div>
                <div style={styles.itemName}>{item.productName}</div>
                <div style={styles.itemMeta}>
                  {item.size ? `${copy.size}: ${item.size}` : ''}
                  {item.size && item.colorName ? ' · ' : ''}
                  {item.colorName ? `${copy.color}: ${item.colorName}` : ''}
                </div>
              </div>
            </div>

            <label style={styles.label}>{copy.productRatingLabel}</label>
            <StarRating
              value={state.rating}
              onChange={(rating) => updateProduct(item.id, { rating })}
              isRtl={isRtl}
            />

            <label style={styles.label}>{copy.sizingLabel}</label>
            <div style={{ ...styles.sizingRow, flexDirection: isRtl ? 'row-reverse' : 'row' }}>
              {SIZING_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    updateProduct(item.id, {
                      sizingFit: state.sizingFit === value ? null : value,
                    })
                  }
                  aria-pressed={state.sizingFit === value}
                  style={{
                    ...styles.sizingButton,
                    ...(state.sizingFit === value ? styles.sizingButtonActive : {}),
                  }}
                >
                  {copy.sizingOptions[value]}
                </button>
              ))}
            </div>

            <label style={styles.label} htmlFor={`title-${item.id}`}>
              {copy.reviewTitleLabel}
            </label>
            <input
              id={`title-${item.id}`}
              type="text"
              maxLength={120}
              value={state.title}
              onChange={(event) => updateProduct(item.id, { title: event.target.value })}
              style={styles.input}
            />

            <label style={styles.label} htmlFor={`body-${item.id}`}>
              {copy.reviewBodyLabel}
            </label>
            <textarea
              id={`body-${item.id}`}
              rows={3}
              maxLength={4000}
              value={state.body}
              onChange={(event) => updateProduct(item.id, { body: event.target.value })}
              style={styles.textarea}
            />
          </div>
        )
      })}

      <label style={styles.label} htmlFor="service-comment">
        {copy.serviceLabel}
      </label>
      <textarea
        id="service-comment"
        rows={2}
        maxLength={4000}
        value={serviceComment}
        onChange={(event) => setServiceComment(event.target.value)}
        style={styles.textarea}
      />

      <label style={styles.label} htmlFor="delivery-comment">
        {copy.deliveryLabel}
      </label>
      <textarea
        id="delivery-comment"
        rows={2}
        maxLength={4000}
        value={deliveryComment}
        onChange={(event) => setDeliveryComment(event.target.value)}
        style={styles.textarea}
      />

      {error ? (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} style={styles.submit}>
        {submitting ? copy.submitting : copy.submit}
      </button>
    </form>
  )
}

/** Five-star input. Rendered as radios so it is keyboard and screen-reader usable. */
function StarRating({
  value,
  onChange,
  isRtl,
}: {
  value: number
  onChange: (value: number) => void
  isRtl: boolean
}) {
  return (
    <div
      role="radiogroup"
      style={{ ...styles.stars, flexDirection: isRtl ? 'row-reverse' : 'row' }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={String(star)}
          onClick={() => onChange(star)}
          style={{ ...styles.star, color: star <= value ? '#f5a623' : '#d0d0d0' }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

const styles = {
  heading: { fontSize: '22px', fontWeight: 700, margin: '0 0 8px' },
  subheading: { fontSize: '17px', fontWeight: 600, margin: '24px 0 8px' },
  paragraph: { color: '#555555', fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' },
  fieldset: { border: 'none', margin: 0, padding: 0 },
  legend: { fontSize: '15px', fontWeight: 600, padding: 0 },
  stars: { display: 'flex', gap: '4px', margin: '8px 0 4px' },
  star: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '30px',
    lineHeight: 1,
    padding: '2px',
  },
  itemCard: {
    border: '1px solid #e6e6e6',
    borderRadius: '10px',
    margin: '0 0 16px',
    padding: '16px',
  },
  itemHeader: { alignItems: 'center', display: 'flex', gap: '12px', marginBottom: '12px' },
  itemImage: { borderRadius: '6px', height: '64px', objectFit: 'cover' as const, width: '64px' },
  itemName: { fontSize: '15px', fontWeight: 600 },
  itemMeta: { color: '#777777', fontSize: '13px', marginTop: '2px' },
  label: {
    color: '#333333',
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    margin: '12px 0 6px',
  },
  sizingRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '8px' },
  sizingButton: {
    background: '#ffffff',
    border: '1px solid #cccccc',
    borderRadius: '999px',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '8px 14px',
  },
  sizingButtonActive: { background: '#111111', borderColor: '#111111', color: '#ffffff' },
  input: {
    border: '1px solid #cccccc',
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
    fontSize: '15px',
    padding: '10px',
    width: '100%',
  },
  textarea: {
    border: '1px solid #cccccc',
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    fontSize: '15px',
    padding: '10px',
    resize: 'vertical' as const,
    width: '100%',
  },
  error: { color: '#c0392b', fontSize: '14px', margin: '16px 0 0' },
  submit: {
    background: '#111111',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 600,
    marginTop: '20px',
    padding: '14px 28px',
    width: '100%',
  },
  googleButton: {
    background: '#ffffff',
    border: '1px solid #111111',
    borderRadius: '8px',
    color: '#111111',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    padding: '12px 24px',
    textDecoration: 'none',
  },
} as const
