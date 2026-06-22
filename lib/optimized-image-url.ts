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

/** Mobile hero video poster (~412px display width). */
export function getMobileVideoPosterUrl(posterSrc: string): string {
  return getOptimizedRemoteImageUrl(posterSrc, 828, 80)
}

/** Desktop hero video poster. */
export function getDesktopVideoPosterUrl(posterSrc: string): string {
  return getOptimizedRemoteImageUrl(posterSrc, 1200, 80)
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
