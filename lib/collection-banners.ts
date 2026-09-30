/**
 * Merchandising banners that occupy a single card slot inside a product grid.
 *
 * Placement is configured as an ordinal - "after the Nth product" - rather than
 * as a row or a grid coordinate. The listing renders 2 columns on mobile and 4
 * from lg, so a row index means a different place on each, and filtering changes
 * the result set underneath it. An ordinal is the only anchor stable across both.
 * The row is derived here at runtime instead.
 */

export type CollectionBannerMedia =
  | { type: 'image'; src: string }
  /**
   * No GIF: a three-second loop is 5-10MB as a GIF against roughly 300KB as MP4,
   * and these sit in a listing that must stay smooth on a phone. `poster` is
   * required so the first paint is an image and the video stays opt-in weight.
   */
  | { type: 'video'; src: string; poster: string }

export interface CollectionBanner {
  id: string
  media: CollectionBannerMedia
  /** Path within the locale, e.g. "/collection/women/shoes/platform-loafers". */
  href: string
  /** Describes the destination, not the artwork - these are navigation, not decoration. */
  alt: string
  /** How many products precede it. 8 means it follows the eighth card. */
  afterProducts: number
  enabled: boolean
  /** Merchandiser ordering; ties break on afterProducts. */
  order: number
}

/**
 * Cap per category. Past roughly one banner in ten slots the grid stops reading as
 * a product listing, and each one is a media download on a page that already
 * carries a lot of them.
 */
export const MAX_COLLECTION_BANNERS = 6

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function sanitizeMedia(input: unknown): CollectionBannerMedia | null {
  if (!input || typeof input !== 'object') return null
  const media = input as Record<string, unknown>

  if (media.type === 'image' && isNonEmptyString(media.src)) {
    return { type: 'image', src: media.src.trim() }
  }
  // A video without a poster would paint nothing until it downloads, so the
  // poster is part of what makes the record valid rather than an optional extra.
  if (media.type === 'video' && isNonEmptyString(media.src) && isNonEmptyString(media.poster)) {
    return { type: 'video', src: media.src.trim(), poster: media.poster.trim() }
  }
  return null
}

/**
 * Coerce stored or submitted data into banners the grid can trust.
 *
 * Invalid entries are dropped rather than thrown on: this runs over documents an
 * admin saved earlier as well as over fresh input, and one malformed row should
 * cost that row, not the whole listing.
 */
export function sanitizeCollectionBanners(input: unknown): CollectionBanner[] {
  if (!Array.isArray(input)) return []

  const seen = new Set<string>()
  const banners: CollectionBanner[] = []

  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>

    const id = isNonEmptyString(raw.id) ? raw.id.trim() : null
    if (!id || seen.has(id)) continue

    const media = sanitizeMedia(raw.media)
    if (!media) continue

    // Internal paths only. An absolute URL here would send shoppers off-site from
    // inside the product grid, which is not what this feature is for.
    const href = isNonEmptyString(raw.href) ? raw.href.trim() : null
    if (!href || !href.startsWith('/') || href.startsWith('//')) continue

    const afterProducts = Number(raw.afterProducts)
    if (!Number.isFinite(afterProducts) || afterProducts < 0) continue

    seen.add(id)
    banners.push({
      id,
      media,
      href,
      alt: isNonEmptyString(raw.alt) ? raw.alt.trim() : '',
      afterProducts: Math.floor(afterProducts),
      enabled: raw.enabled !== false,
      order: Number.isFinite(Number(raw.order)) ? Math.floor(Number(raw.order)) : banners.length,
    })

    if (banners.length >= MAX_COLLECTION_BANNERS) break
  }

  return banners
}

export interface CollectionBannerPlacement {
  /** Index in the display list (products with banners already spliced in). */
  displayIndex: number
  banner: CollectionBanner
}

/**
 * Default cadence. Expressed per breakpoint so the *row* rhythm stays constant:
 * one banner roughly every two to three rows on both, even though the product
 * counts differ. A single shared number would read as every two rows on desktop
 * and every four on mobile.
 */
export const BANNER_CADENCE = { mobile: 6, desktop: 8 } as const

/**
 * Resolve configured banners into display-list positions.
 *
 * - the ordinal is honoured literally: "after 2" puts the banner in the third slot,
 *   first row included. An earlier version pushed anything landing in row 0 down a
 *   row, which quietly overrode the configured number and is the merchandiser's
 *   call to make, not this function's.
 * - at most one per row, which is why a displaced banner lands on the next row's
 *   first slot
 * - skipped entirely when fewer cards are loaded than it asks to follow, so it
 *   appears naturally as pagination brings more in rather than jumping the queue
 *
 * "Products" here means grid cards. The listing renders one card per colour
 * variant, so a style in three colours occupies three slots.
 */
export function resolveBannerPlacements(
  banners: CollectionBanner[],
  columns: number,
  productCount: number
): CollectionBannerPlacement[] {
  const safeColumns = Math.max(1, Math.floor(columns))
  const active = banners
    .filter((banner) => banner.enabled)
    .sort((a, b) => a.order - b.order || a.afterProducts - b.afterProducts)

  const placements: CollectionBannerPlacement[] = []
  const usedRows = new Set<number>()

  for (const banner of active) {
    if (banner.afterProducts < 0 || banner.afterProducts >= productCount) continue

    let displayIndex = banner.afterProducts + placements.length
    let row = Math.floor(displayIndex / safeColumns)

    // One per row: fall through to the next free row, landing at its first slot.
    while (usedRows.has(row)) {
      row += 1
      displayIndex = row * safeColumns
    }

    // Pushing can carry a banner past the products actually loaded; leave it for
    // a later page rather than trailing it after the last card.
    if (displayIndex - placements.length > productCount) continue

    usedRows.add(row)
    placements.push({ displayIndex, banner })
  }

  return placements
}

/**
 * Splice placements into a product list, returning the display list the grid
 * renders. Products keep their own order and are never mutated - the counters,
 * the load-more baseline and scroll restoration all index the product array, so
 * banners exist only in this derived view.
 */
export function buildDisplayList<T>(
  products: T[],
  placements: CollectionBannerPlacement[]
): Array<{ kind: 'product'; item: T; productIndex: number } | { kind: 'banner'; banner: CollectionBanner }> {
  const byIndex = new Map(placements.map((placement) => [placement.displayIndex, placement.banner]))
  const display: Array<
    { kind: 'product'; item: T; productIndex: number } | { kind: 'banner'; banner: CollectionBanner }
  > = []

  let productIndex = 0
  while (productIndex < products.length || byIndex.has(display.length)) {
    const banner = byIndex.get(display.length)
    if (banner) {
      display.push({ kind: 'banner', banner })
      continue
    }
    display.push({ kind: 'product', item: products[productIndex], productIndex })
    productIndex += 1
  }

  return display
}
