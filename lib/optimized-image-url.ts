/**
 * Build a same-origin Next.js image optimizer URL for remote Firebase assets.
 * Use for video posters and other cases that cannot use the Image component.
 */
export function getOptimizedRemoteImageUrl(
  src: string,
  width: number,
  quality = 75
): string {
  if (!src || src.startsWith('/_next/image')) return src
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    q: String(quality),
  })
  return `/_next/image?${params.toString()}`
}

/**
 * Quality for the poster helpers below. It MUST be one of `images.qualities` in
 * next.config.ts (currently [75, 85, 100]) - the optimizer answers 400 for any
 * other value and the poster silently never loads.
 *
 * These helpers asked for 80 until this was spotted, which is not in that list,
 * so every poster built through them was a dead request.
 */
const POSTER_QUALITY = 85

/** Mobile hero video poster (9:16, ~2× typical phone width). */
export function getHomeHeroMobilePosterUrl(posterSrc: string): string {
  return getOptimizedRemoteImageUrl(posterSrc, 1080, POSTER_QUALITY)
}

/** Mobile hero video poster (~412px display width). */
export function getMobileVideoPosterUrl(posterSrc: string): string {
  return getOptimizedRemoteImageUrl(posterSrc, 828, POSTER_QUALITY)
}

/** Desktop hero video poster. */
export function getDesktopVideoPosterUrl(posterSrc: string): string {
  return getOptimizedRemoteImageUrl(posterSrc, 1200, POSTER_QUALITY)
}

/**
 * Marketing assets flagged by Lighthouse for manual re-compression in Firebase Storage.
 * Re-export at these approximate dimensions before upload:
 * - bags_image_hero_mobile.webp → 828×1104 (~80–120 KB)
 * - moccasin_tiles.webp, belts_tiles.webp → 400×533 (~40–80 KB)
 * - new_in.webp, limited_editoin_v2.webp → 960×540 (~80–120 KB)
 */
export const OVERSIZED_MARKETING_ASSETS = [
  'images/bags_image_hero_mobile.webp',
  'images/moccasin_tiles.webp',
  'images/belts_tiles.webp',
  'images/new_in.webp',
  'images/limited_editoin_v2.webp',
] as const
