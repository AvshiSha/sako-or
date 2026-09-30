import { Suspense } from 'react'
import type { Metadata } from 'next'

import { fetchCartRecommendations } from '@/lib/cart-recommendations'

import CheckoutClient from './CheckoutClient'

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
export default async function CheckoutPage() {
  const recommendations = await fetchCartRecommendations().catch(() => [])

  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-secondary" />}>
      <CheckoutClient recommendations={recommendations} />
    </Suspense>
  )
}
