/**
 * Merchandising banners that occupy a single card slot inside a product grid.
 *
 * Placement is configured as an ordinal - "after the Nth product" - rather than
 * as a row or a grid coordinate. The listing renders 2 columns on mobile and 4
 * from lg, so a row index means a different place on each, and filtering changes
 * the result set underneath it. An ordinal is the only anchor stable across both.
 * The row is derived here at runtime instead.
 */

/**
 * Where a video's centre of interest sits vertically, used as `object-position`.
 *
 * Only videos carry this. An image banner solves the same problem with
 * `srcMobile` - a second crop - which a video cannot have, because the slot is
 * filled by one file at every width (see the admin editor's media field).
 *
 * It is needed because the slot's aspect is not fixed: measured from the card
 * tokens it runs 0.52 at 360px to 0.82 at 1920px. A 9:16 clip therefore loses
 * nothing vertically on a phone but 25-31% of its height from 1280px up, and
 * `object-cover` takes that out of the middle. Whether the middle is the right
 * place is a property of the clip, not of the grid: a campaign film that pushes
 * in on a shoe wants its lower half, and one framed on a model's face wants its
 * upper. Centre is correct often enough to stay the default.
 */
export type CollectionBannerFocal = 'top' | 'upper' | 'center' | 'lower' | 'bottom'

/**
 * Full class literals, not interpolated - Tailwind scans source text, so
 * `object-[50%_${n}%]` would never be generated.
 */
export const BANNER_FOCAL_CLASS: Record<CollectionBannerFocal, string> = {
  top: 'object-top',
  upper: 'object-[50%_25%]',
  center: 'object-center',
  lower: 'object-[50%_75%]',
  bottom: 'object-bottom',
}

const FOCAL_VALUES: CollectionBannerFocal[] = ['top', 'upper', 'center', 'lower', 'bottom']

export type CollectionBannerMedia =
  /**
   * `src` is the desktop artwork; `srcMobile` is optional art direction for the
   * narrow slot, and the grid falls back to `src` without it.
   *
   * Two sources rather than one because the slot is not the same shape at the
   * two breakpoints and cannot be made so: its height is the card's image area
   * plus the info block, which gives roughly 1.84 (185x341 at 390px) against
   * 1.38 (355x491 at 1440px). That is a third apart, so a single image
   * object-covered into both loses about a quarter of its width or height at
   * one of them - a 4:5 banner was being trimmed ~32% on the sides on mobile.
   */
  | { type: 'image'; src: string; srcMobile?: string }
  /**
   * No GIF: a three-second loop is 5-10MB as a GIF against roughly 300KB as MP4,
   * and these sit in a listing that must stay smooth on a phone. `poster` is
   * required so the first paint is an image and the video stays opt-in weight.
   */
  | { type: 'video'; src: string; poster: string; focal?: CollectionBannerFocal }

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
    // srcMobile is genuinely optional: banners saved before it existed have
    // only `src`, and omitting the key entirely (rather than storing '') keeps
    // those records and new single-image ones identical in Firestore.
    const image: CollectionBannerMedia = { type: 'image', src: media.src.trim() }
    if (isNonEmptyString(media.srcMobile)) image.srcMobile = media.srcMobile.trim()
    return image
  }
  // A video without a poster would paint nothing until it downloads, so the
  // poster is part of what makes the record valid rather than an optional extra.
  if (media.type === 'video' && isNonEmptyString(media.src) && isNonEmptyString(media.poster)) {
    const video: CollectionBannerMedia = {
      type: 'video',
      src: media.src.trim(),
      poster: media.poster.trim(),
    }
    // Omitted rather than defaulted to 'center', so records saved before this
    // field existed and ones explicitly centred stay byte-identical in Firestore.
    if (FOCAL_VALUES.includes(media.focal as CollectionBannerFocal)) {
      video.focal = media.focal as CollectionBannerFocal
    }
    return video
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
