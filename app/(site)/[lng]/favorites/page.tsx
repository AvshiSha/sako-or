import { fetchCartRecommendations } from '@/lib/cart-recommendations'

import FavoritesClient from './FavoritesClient'

/**
 * Favorites, Figma 438:4076 (SAKO OR — Update).
 *
 * The list itself is client-side — favourites live in localStorage for guests
 * and on the account for signed-in users — but the frame instances the same
 * "Section / Product Carousel" the cart does (438:4125), and that is ordinary
 * catalogue content, so it is fetched here on the server and passed down.
 *
 * It reuses the cart's rail rather than introducing a second query: both
 * screens sit under a list of saved footwear, and an accessory is the useful
 * suggestion in both places.
 */
export default async function FavoritesPage() {
  const recommendations = await fetchCartRecommendations().catch(() => [])

  return <FavoritesClient recommendations={recommendations} />
}
