import { Suspense } from 'react'
import type { Metadata } from 'next'

import { fetchCartRecommendations } from '@/lib/cart-recommendations'

import CheckoutClient from './CheckoutClient'
import CheckoutSkeleton from '@/app/components/checkout/CheckoutSkeleton'

// Per-visitor state, not content — same reasoning as the cart.
export const metadata: Metadata = {
  robots: { index: false, follow: true }
}

/**
 * Checkout (438:2725) — a single screen that ends at the payment gateway.
 * Client-side, because the cart it prices lives in localStorage; the
 * recommendations rail is ordinary catalogue content and is fetched here.
 * useCartPricing reads ?coupon=, so the Suspense boundary is required rather
 * than decorative.
 */
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ lng: string }>
}) {
  const [{ lng }, recommendations] = await Promise.all([
    params,
    fetchCartRecommendations().catch(() => []),
  ])

  const language = lng === 'he' ? 'he' : 'en'

  return (
    // The fallback is not decorative here. useCartPricing reads ?coupon= through
    // useSearchParams, which bails this boundary out of server rendering
    // altogether - BAILOUT_TO_CLIENT_SIDE_RENDERING is in the served HTML - so
    // whatever stands here is what every visitor looks at until the checkout
    // bundle has hydrated. It used to be an empty box: 1794ms of nothing on
    // desktop, 9597ms on mobile at 4x CPU.
    <Suspense fallback={<CheckoutSkeleton language={language} />}>
      <CheckoutClient recommendations={recommendations} />
    </Suspense>
  )
}
