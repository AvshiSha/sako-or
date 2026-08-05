import type { Metadata } from 'next'
import { loadReviewableOrder } from '@/lib/reviews/review-submission'
import ReviewForm from './ReviewForm'
import { reviewPageCopy } from './copy'

/**
 * Customer review page, reached from the signed link in the post-delivery message.
 *
 * A server component on purpose: the token is verified here, before any order data is
 * fetched or rendered, so an invalid link never reaches the client and cannot be used
 * to probe which order numbers exist.
 */

export const dynamic = 'force-dynamic'

/** Never index review pages — they are private, per-order URLs. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ lng: string; orderNumber: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function ReviewOrderPage({ params, searchParams }: PageProps) {
  const { lng, orderNumber: rawOrderNumber } = await params
  const { token } = await searchParams

  const language = lng === 'en' ? 'en' : 'he'
  const copy = reviewPageCopy[language]
  const orderNumber = decodeURIComponent(rawOrderNumber)

  const result = await loadReviewableOrder({ orderNumber, token })

  if (!result.ok) {
    // Both failure modes render the same message deliberately: distinguishing
    // "bad token" from "no such order" would leak which order numbers are real.
    return (
      <Shell language={language}>
        <h1 style={styles.heading}>{copy.invalidTitle}</h1>
        <p style={styles.paragraph}>{copy.invalidBody}</p>
      </Shell>
    )
  }

  const { order } = result

  if (order.alreadyReviewed) {
    return (
      <Shell language={language}>
        <h1 style={styles.heading}>{copy.alreadyTitle}</h1>
        <p style={styles.paragraph}>{copy.alreadyBody}</p>
        <GoogleReviewLink language={language} />
      </Shell>
    )
  }

  return (
    <Shell language={language}>
      <ReviewForm
        language={language}
        orderNumber={order.orderNumber}
        token={token ?? ''}
        customerName={order.customerName}
        items={order.items}
        googleReviewUrl={process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ?? null}
      />
    </Shell>
  )
}

function Shell({ language, children }: { language: 'he' | 'en'; children: React.ReactNode }) {
  const dir = language === 'he' ? 'rtl' : 'ltr'
  return (
    <main dir={dir} style={{ ...styles.main, textAlign: language === 'he' ? 'right' : 'left' }}>
      <div style={styles.card}>{children}</div>
    </main>
  )
}

function GoogleReviewLink({ language }: { language: 'he' | 'en' }) {
  const url = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL
  if (!url) return null

  const copy = reviewPageCopy[language]
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={styles.googleButton}>
      {copy.googleCta}
    </a>
  )
}

const styles = {
  main: {
    background: '#f6f6f6',
    minHeight: '100vh',
    padding: '32px 16px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    margin: '0 auto',
    maxWidth: '640px',
    padding: '32px 24px',
  },
  heading: {
    fontSize: '22px',
    fontWeight: 700,
    margin: '0 0 12px',
  },
  paragraph: {
    color: '#555555',
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 20px',
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
