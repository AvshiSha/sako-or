import { Suspense } from 'react'

import { fetchCartRecommendations } from '@/lib/cart-recommendations'

import CartClient, { CartSkeleton } from './CartClient'

/**
 * The cart itself is client-side (it reads localStorage and the signed-in user),
 * but the frame's "YOU MAY ALSO LIKE" rail (293:14026) is ordinary catalogue
 * content, so it is fetched here on the server and passed down — women's belts,
 * as an add-on to a cart that is almost always footwear.
 *
 * The Suspense boundary is required, not decorative: CartClient calls
 * useSearchParams to pick up ?coupon=.
 */
export default async function CartPage() {
  const recommendations = await fetchCartRecommendations().catch(() => [])

  return (
    <Suspense fallback={<CartSkeleton />}>
      <CartClient recommendations={recommendations} />
    </Suspense>
  )
}
