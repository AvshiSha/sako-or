import { loadReviewableOrder } from '@/lib/reviews/review-submission'
import { buildReviewPath } from '@/lib/server/review-token'
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
        <Brand />
        <h1 className="text-[22px] font-bold text-neutral-900">{copy.invalidTitle}</h1>
        <p className="mt-3 text-[15px] leading-7 text-neutral-600">{copy.invalidBody}</p>
      </Shell>
    )
  }

  const { order } = result

  // Built here rather than in the client so the return path carries a freshly-minted
  // token; the one in the URL may be near the end of its 30-day life.
  const reviewPath = buildReviewPath({ orderNumber: order.orderNumber, language, token })
  const signupUrl = `/${language}/signup?redirect=${encodeURIComponent(reviewPath)}`

  if (order.alreadyReviewed) {
    const { reward } = order
    return (
      <Shell language={language}>
        <Brand />
        <h1 className="text-[22px] font-bold text-neutral-900">{copy.alreadyTitle}</h1>
        <p className="mt-3 text-[15px] leading-7 text-neutral-600">{copy.alreadyBody}</p>

        {/* A guest who reviewed can still claim the points by registering — the
            offer stays open rather than being lost with the submission. */}
        {reward.status === 'not_eligible' ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[15px] font-semibold text-amber-900">
              {copy.rewardSuccessGuestTitle(reward.points)}
            </p>
            <p className="mt-1 text-[14px] leading-6 text-amber-800">
              {copy.rewardSuccessGuestBody(reward.points)}
            </p>
            <a
              href={signupUrl}
              data-auth-trigger
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-neutral-900 px-5 text-[15px] font-semibold text-white transition active:scale-[0.98] hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              {copy.rewardGuestCta(reward.points)}
            </a>
          </div>
        ) : reward.status === 'pending' || reward.status === 'credited' ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-[14px] text-emerald-800">
            {copy.rewardEligibleNow(reward.points)}
          </p>
        ) : null}

        {process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ? (
          <a
            href={process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-neutral-900 px-6 text-[15px] font-semibold text-neutral-900 transition active:scale-[0.98] hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            {copy.googleCta}
          </a>
        ) : null}
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
        // Resolved on the server. Deliberately not derived from useAuth() on the
        // client: for the first ~2s the review page runs under a lightweight auth
        // stub reporting `user: null, loading: false`, which is indistinguishable
        // from signed-out and would flash the wrong message at a logged-in customer.
        isRegistered={order.reward.isRegistered}
        rewardPoints={order.reward.points}
        signupUrl={signupUrl}
      />
    </Shell>
  )
}

/**
 * Page frame. `dir` is set here so every logical Tailwind utility below
 * (ms-/me-/ps-/pe-/text-start) resolves correctly for Hebrew without duplicate
 * styles — physical left/right properties are avoided throughout.
 */
function Shell({ language, children }: { language: 'he' | 'en'; children: React.ReactNode }) {
  return (
    <div dir={language === 'he' ? 'rtl' : 'ltr'} className="min-h-screen bg-neutral-100">
      <main className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-10">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-900/5 sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-[12px] text-neutral-400">SAKO OR</p>
      </main>
    </div>
  )
}

function Brand() {
  return (
    <p className="mb-6 text-center text-[13px] font-semibold tracking-[0.3em] text-neutral-400">
      SAKO OR
    </p>
  )
}
