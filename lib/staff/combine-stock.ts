/**
 * Joins Verifone stock, our stored warehouse locations, and optional catalog
 * enrichment into the view model the staff screen renders.
 *
 * Pure, and that is the point: this is where every rule a picker depends on
 * lives, so every rule is unit tested. Nothing here reads a database, calls
 * Verifone, or touches `process.env`.
 *
 * Three rules worth stating outright, because each one is a decision rather
 * than an implementation detail:
 *
 *  1. **Nothing is invented and nothing returned is dropped.** A colour code
 *     absent from `COLOR_CODE_MAP` still gets a card -- unlike
 *     `parseInventorySku`, which treats an unmapped code as a hard failure
 *     because the cron can only write to colours the catalog already has. A
 *     picker needs to be told about stock that physically exists even when the
 *     website has never heard of that colour.
 *  2. **A location belongs to MODEL + COLOUR**, so every size of a colour
 *     shows the same one, and colours of the same model are independent.
 *  3. **An image is only ever the matching colour's image.** There is no
 *     fallback to another colour: a picker shown the wrong photo walks to the
 *     wrong drawer. No image means no image element at all, decided here by
 *     returning null rather than a placeholder.
 */

import { COLOR_CODE_MAP } from '../color-codes'
import { getColorName } from '../colors'
import type { VerifoneItemStock } from '../verifone-stock-parse'
import { staffText, unknownColorLabel } from './messages'

/** Verifone marks a one-size item with this in the size slice. */
const ONE_SIZE_CODE = 'OS'

export type StaffLocation = {
  room: number
  route: number
  drawer: number
  /** True when the stock sits on the floor directly beneath that drawer. */
  onFloor: boolean
  /** Optimistic-concurrency token; the client sends it back on save. */
  version: number
  updatedAt: string | null
  updatedBy: string | null
}

export type StaffSizeRow = {
  /** Exactly what Verifone returned, for support and for the write path. */
  size: string
  /** What the picker reads. */
  label: string
  quantity: number
  /**
   * A CONFIRMED zero: Verifone answered for this size and said none.
   *
   * Only ever set on a card whose `stockKnown` is true, so "we could not read
   * the stock" can never reach the screen as "sold out".
   */
  soldOut: boolean
  /**
   * False when the size slice is neither two characters nor `OS`. The parser
   * admits a 12-character `ProductCode` whose size comes out one character
   * long; rather than show a picker "3" when the shelf says "35", the row is
   * labelled untrustworthy. See `lib/__tests__/verifone-stock-parse.test.ts`.
   */
  trusted: boolean
}

/** Where a colour's display name came from, so tests can pin the fallbacks. */
export type ColorNameSource = 'hebrew' | 'slug' | 'code'

export type StaffColorCard = {
  /** The stable key: Verifone's own two-digit code. */
  colorCode: string
  /** Null when the code is not in `COLOR_CODE_MAP`. */
  colorSlug: string | null
  colorName: string
  colorNameSource: ColorNameSource
  location: StaffLocation | null
  sizes: StaffSizeRow[]
  totalQuantity: number
  image: { url: string; alt: string } | null
  /**
   * The whole colour is out of stock: every size Verifone returned for it is a
   * confirmed zero.
   *
   * Requires `stockKnown`, and requires at least one size -- a colour with no
   * rows at all is "we were told nothing about this", not "there is none".
   */
  soldOut: boolean
  /**
   * False on a card built from a stored location alone, because Verifone could
   * not be reached. `sizes` is then empty and `totalQuantity` is meaningless --
   * the UI must not render a quantity for such a card, since a service failure
   * showing as 0 is the single most damaging thing this screen could do.
   */
  stockKnown: boolean
}

export type StaffCatalogEnrichment = {
  /** Hebrew product title when the website knows this model, else null. */
  productName: string | null
  /**
   * Colour-matched images, keyed by colour slug. A slug that is absent, or
   * present with null, means "no image for this colour" -- never "use another".
   */
  imagesByColorSlug: Record<string, { url: string; alt: string } | null>
}

export type LocationAssignment = StaffLocation & { colorCode: string }

export type CombineStockInput = {
  /** Canonical `XXXX-XXXX`. */
  modelCode: string
  items: VerifoneItemStock[]
  assignments: LocationAssignment[]
  catalog?: StaffCatalogEnrichment | null
}

export type CombineStockOutput = {
  colors: StaffColorCard[]
  /** Summed across every colour and size returned. */
  totalQuantity: number
  /**
   * Rows Verifone returned under a different base SKU than the one asked for.
   * Should always be zero; counted rather than silently tolerated so that one
   * model can never contribute stock to another model's heading.
   */
  foreignRowsDropped: number
  /** Rows sharing a colour and size with an earlier row. */
  duplicateRowsDropped: number
}

/** Human label for a size, without guessing at an untrustworthy one. */
export function sizeLabel(size: string, trusted: boolean): string {
  if (!trusted) return staffText.sizeUnknown
  if (size.trim().toUpperCase() === ONE_SIZE_CODE) return staffText.oneSize
  return size.trim()
}

/**
 * A size is trustworthy when it is the literal one-size marker or exactly two
 * characters, which is the whole width of the slice the parser takes.
 */
export function isTrustedSize(size: string): boolean {
  const trimmed = (size ?? '').trim()
  if (trimmed.toUpperCase() === ONE_SIZE_CODE) return true
  return /^\d{2}$/.test(trimmed)
}

/**
 * Display order for sizes: numeric ascending first, then anything non-numeric
 * alphabetically, with one-size last.
 *
 * Verifone returns rows in its own order, and an unordered size column defeats
 * the point of a picking aid.
 */
export function compareSizes(a: string, b: string): number {
  const au = (a ?? '').trim().toUpperCase()
  const bu = (b ?? '').trim().toUpperCase()

  const aOne = au === ONE_SIZE_CODE
  const bOne = bu === ONE_SIZE_CODE
  if (aOne !== bOne) return aOne ? 1 : -1
  if (aOne && bOne) return 0

  const aNum = /^\d+$/.test(au) ? Number(au) : null
  const bNum = /^\d+$/.test(bu) ? Number(bu) : null

  if (aNum !== null && bNum !== null) return aNum - bNum
  if (aNum !== null) return -1
  if (bNum !== null) return 1

  return au.localeCompare(bu, 'he')
}

/**
 * Colour name, with its provenance.
 *
 * Three cases, and the middle one is load-bearing: eight of the slugs in
 * `COLOR_CODE_MAP` have no entry in `colorTranslations` (`zebra`, `coffee`,
 * `black-lack`, `white-lack`, `capuchino`, `turquoise`, `dark-gray`,
 * `natural`). `getColorName` already falls back to the slug for those, which is
 * a real English-ish word on a Hebrew screen -- not ideal, but correct, and far
 * better than inventing Hebrew product copy here. Those eight names are raised
 * separately for approval; this function needs no change when they land.
 */
export function resolveColorName(colorCode: string): {
  colorSlug: string | null
  colorName: string
  colorNameSource: ColorNameSource
} {
  const colorSlug = COLOR_CODE_MAP[colorCode] ?? null

  if (!colorSlug) {
    return {
      colorSlug: null,
      colorName: unknownColorLabel(colorCode),
      colorNameSource: 'code',
    }
  }

  const hebrew = getColorName(colorSlug, 'he')
  // getColorName returns the slug itself when it has no translation.
  if (hebrew && hebrew !== colorSlug) {
    return { colorSlug, colorName: hebrew, colorNameSource: 'hebrew' }
  }

  return { colorSlug, colorName: colorSlug, colorNameSource: 'slug' }
}

export function combineStock(input: CombineStockInput): CombineStockOutput {
  const { modelCode, items, assignments, catalog } = input

  const locationByColor = new Map<string, StaffLocation>()
  for (const assignment of assignments) {
    const { colorCode, ...location } = assignment
    locationByColor.set(colorCode, location)
  }

  const grouped = new Map<string, VerifoneItemStock[]>()
  const seen = new Set<string>()
  let foreignRowsDropped = 0
  let duplicateRowsDropped = 0

  for (const item of items) {
    // Verifone is asked for one ItemCode, so this should never fire. It is here
    // because showing another model's stock under this heading is the one
    // failure mode the brief singles out as unacceptable.
    if (item.sku !== modelCode) {
      foreignRowsDropped++
      continue
    }

    const key = `${item.colorCode}|${item.size}`
    if (seen.has(key)) {
      // Keep the first. Summing would invent a quantity Verifone never stated.
      duplicateRowsDropped++
      continue
    }
    seen.add(key)

    const bucket = grouped.get(item.colorCode)
    if (bucket) bucket.push(item)
    else grouped.set(item.colorCode, [item])
  }

  const colors: StaffColorCard[] = []
  let totalQuantity = 0

  // Sort colour cards by code so the same model always reads the same way.
  const colorCodes = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, 'en'))

  for (const colorCode of colorCodes) {
    const rows = grouped.get(colorCode) ?? []
    const { colorSlug, colorName, colorNameSource } = resolveColorName(colorCode)

    const sizes: StaffSizeRow[] = rows
      .map((row) => {
        const trusted = isTrustedSize(row.size)
        return {
          size: row.size,
          label: sizeLabel(row.size, trusted),
          quantity: row.quantity,
          // The quantity is trustworthy even when the size LABEL is not: the
          // two come from different parts of the ProductCode.
          soldOut: row.quantity === 0,
          trusted,
        }
      })
      .sort((a, b) => compareSizes(a.size, b.size))

    const colorTotal = sizes.reduce((sum, row) => sum + row.quantity, 0)
    totalQuantity += colorTotal

    // Every returned size is a confirmed zero. `sizes.length > 0` matters: a
    // colour Verifone said nothing about must not be labelled sold out.
    const colorSoldOut = sizes.length > 0 && sizes.every((row) => row.soldOut)

    colors.push({
      colorCode,
      colorSlug,
      colorName,
      colorNameSource,
      location: locationByColor.get(colorCode) ?? null,
      sizes,
      totalQuantity: colorTotal,
      // Only ever this colour's own image.
      image: (colorSlug && catalog?.imagesByColorSlug?.[colorSlug]) || null,
      soldOut: colorSoldOut,
      stockKnown: true,
    })
  }

  return { colors, totalQuantity, foreignRowsDropped, duplicateRowsDropped }
}

/**
 * Cards built from stored locations alone, for when Verifone is unreachable.
 *
 * The brief asks for stock and locations to stay independently usable, and this
 * is the half that is still usable: "Verifone is down, but the colours we have
 * on record live here." Every card is marked `stockKnown: false` and carries no
 * sizes, so no quantity is shown and nothing implies the stock is zero.
 */
export function locationOnlyCards(
  assignments: LocationAssignment[],
  catalog?: StaffCatalogEnrichment | null
): StaffColorCard[] {
  return assignments
    .slice()
    .sort((a, b) => a.colorCode.localeCompare(b.colorCode, 'en'))
    .map((assignment) => {
      const { colorCode, ...location } = assignment
      const { colorSlug, colorName, colorNameSource } = resolveColorName(colorCode)

      return {
        colorCode,
        colorSlug,
        colorName,
        colorNameSource,
        location,
        sizes: [],
        totalQuantity: 0,
        image: (colorSlug && catalog?.imagesByColorSlug?.[colorSlug]) || null,
        // Verifone could not be reached, so nothing is confirmed about stock.
        // This is the single most important false here: an unreachable ERP
        // must never render as "sold out".
        soldOut: false,
        stockKnown: false,
      }
    })
}
