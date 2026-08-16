/**
 * Values computed from a bag's dimensions rather than typed in by staff.
 *
 * Every function returns `null` when its inputs are missing — an unmeasured bag
 * stays unknown and simply doesn't render, it never gets a guessed `false`.
 *
 * These run in one place, the Firestore → Postgres sync route, and the results
 * are persisted to Postgres columns so SQL filtering stays trivial (the same
 * approach as `generated_search_keywords` and `colors_search_norm`). The admin
 * form shows them as read-only hints beside a manual override; an override, if
 * set, always wins.
 *
 * All derivations use *exterior* dimensions, so they are advisory rather than
 * exact — a soft bag swallows more than its measurements suggest, a rigid one
 * less. That's what the override is for.
 */

import type { BagSizeCategory, BagStructure, FitsLaptopInches } from '@/lib/product-enums'
import { FITS_LAPTOP_INCHES_VALUES } from '@/lib/product-enums'

/** A4 paper, in centimetres. */
const A4_HEIGHT_CM = 29.7
const A4_WIDTH_CM = 21.0

/** Clearance a sheet or device needs beyond its own footprint to actually go in. */
const PAPER_CLEARANCE_CM = 1.3
const DEVICE_CLEARANCE_CM = 1.5

/** A ~11" tablet, the common "does my iPad fit" case. */
const TABLET_HEIGHT_CM = 25.0
const TABLET_WIDTH_CM = 18.0

/** Approximate footprints of laptops by nominal screen size, largest last. */
const LAPTOP_FOOTPRINTS_CM: Record<FitsLaptopInches, { height: number; width: number }> = {
  13: { height: 21.5, width: 30.5 },
  14: { height: 22.5, width: 32.0 },
  15: { height: 24.0, width: 35.5 },
  16: { height: 24.5, width: 35.6 },
}

/**
 * Soft and slouchy bags stretch; rigid ones don't give at all. Applied as a
 * tolerance on the opening, never as a reason to invent a fit for a bag that
 * is plainly too small.
 */
const STRUCTURE_TOLERANCE_CM: Record<BagStructure, number> = {
  soft: 1.0,
  slouchy: 1.5,
  semi_structured: 0.5,
  structured: 0,
  rigid_frame: 0,
}

function structureTolerance(structure: BagStructure | null | undefined): number {
  if (!structure) return 0
  return STRUCTURE_TOLERANCE_CM[structure] ?? 0
}

/** True when a value is a usable positive measurement. */
function isMeasured(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Interior volume in litres, from exterior height × width × depth.
 * Rounded to one decimal place — the inputs are whole centimetres at best, so
 * more precision would imply an accuracy that isn't there.
 */
export function deriveBagCapacityLiters(
  heightCm: number | null | undefined,
  widthCm: number | null | undefined,
  depthCm: number | null | undefined
): number | null {
  if (!isMeasured(heightCm) || !isMeasured(widthCm) || !isMeasured(depthCm)) return null
  return Math.round(((heightCm * widthCm * depthCm) / 1000) * 10) / 10
}

/**
 * Size bucket from capacity. Thresholds are inclusive at the lower bound:
 * <2 mini · 2–5 small · 5–12 medium · 12–25 large · >25 oversized.
 */
export function deriveBagSizeCategory(
  capacityLiters: number | null | undefined
): BagSizeCategory | null {
  if (!isMeasured(capacityLiters)) return null
  if (capacityLiters < 2) return 'mini'
  if (capacityLiters < 5) return 'small'
  if (capacityLiters < 12) return 'medium'
  if (capacityLiters <= 25) return 'large'
  return 'oversized'
}

/**
 * Whether a sheet of A4 fits through the opening, in either orientation.
 * Depth is irrelevant — paper is flat; what matters is the height × width of
 * the face.
 */
export function deriveFitsA4(
  heightCm: number | null | undefined,
  widthCm: number | null | undefined,
  structure?: BagStructure | null
): boolean | null {
  return fitsFlatItem(heightCm, widthCm, A4_HEIGHT_CM, A4_WIDTH_CM, PAPER_CLEARANCE_CM, structure)
}

/** Whether a ~11" tablet fits. Same geometry as A4, different footprint. */
export function deriveFitsTablet(
  heightCm: number | null | undefined,
  widthCm: number | null | undefined,
  structure?: BagStructure | null
): boolean | null {
  return fitsFlatItem(
    heightCm,
    widthCm,
    TABLET_HEIGHT_CM,
    TABLET_WIDTH_CM,
    DEVICE_CLEARANCE_CM,
    structure
  )
}

/**
 * The largest laptop the bag can take, or `null` when none of them fit (or the
 * bag hasn't been measured). Returning null for "fits nothing" is deliberate:
 * the field answers "which laptop", and a bag that fits no laptop has no answer.
 */
export function deriveFitsLaptopInches(
  heightCm: number | null | undefined,
  widthCm: number | null | undefined,
  structure?: BagStructure | null
): FitsLaptopInches | null {
  if (!isMeasured(heightCm) || !isMeasured(widthCm)) return null

  let largest: FitsLaptopInches | null = null
  for (const inches of FITS_LAPTOP_INCHES_VALUES) {
    const footprint = LAPTOP_FOOTPRINTS_CM[inches]
    const fits = fitsFlatItem(
      heightCm,
      widthCm,
      footprint.height,
      footprint.width,
      DEVICE_CLEARANCE_CM,
      structure
    )
    if (fits) largest = inches
  }
  return largest
}

/**
 * Shared geometry for flat items (paper, tablets, laptops): the item fits if
 * the bag's face covers its footprint in either orientation, once clearance and
 * any structural give are accounted for.
 */
function fitsFlatItem(
  bagHeightCm: number | null | undefined,
  bagWidthCm: number | null | undefined,
  itemHeightCm: number,
  itemWidthCm: number,
  clearanceCm: number,
  structure?: BagStructure | null
): boolean | null {
  if (!isMeasured(bagHeightCm) || !isMeasured(bagWidthCm)) return null

  const give = structureTolerance(structure)
  const availableHeight = bagHeightCm + give
  const availableWidth = bagWidthCm + give
  const neededHeight = itemHeightCm + clearanceCm
  const neededWidth = itemWidthCm + clearanceCm

  const upright = availableHeight >= neededHeight && availableWidth >= neededWidth
  const sideways = availableHeight >= neededWidth && availableWidth >= neededHeight
  return upright || sideways
}

export interface BagDerivedInput {
  heightCm?: number | null
  widthCm?: number | null
  depthCm?: number | null
  bagStructure?: BagStructure | null
}

export interface BagDerivedFacts {
  bagCapacityLiters: number | null
  bagSizeCategory: BagSizeCategory | null
  fitsA4: boolean | null
  fitsTablet: boolean | null
  fitsLaptopInches: FitsLaptopInches | null
}

/** All derived facts at once — what the sync route and the admin hints call. */
export function deriveBagFacts(input: BagDerivedInput): BagDerivedFacts {
  const { heightCm, widthCm, depthCm, bagStructure } = input
  const bagCapacityLiters = deriveBagCapacityLiters(heightCm, widthCm, depthCm)

  return {
    bagCapacityLiters,
    bagSizeCategory: deriveBagSizeCategory(bagCapacityLiters),
    fitsA4: deriveFitsA4(heightCm, widthCm, bagStructure),
    fitsTablet: deriveFitsTablet(heightCm, widthCm, bagStructure),
    fitsLaptopInches: deriveFitsLaptopInches(heightCm, widthCm, bagStructure),
  }
}

/**
 * A single measurement in centimetres parsed from free text, or undefined when
 * the text isn't one. Used by the dimension backfill to read the legacy
 * `height_en`/`height_he` strings.
 *
 * Deliberately strict, because whatever this returns the site presents as a
 * fact. `"20-25"` is a range, not a measurement; `"approx 25"` carries a hedge
 * the number alone would lose; `"25 x 13"` is two measurements in one field.
 * All three are left for a human rather than half-read.
 */
export function parseCmValue(text: string | undefined | null): number | undefined {
  if (!text) return undefined

  const trimmed = String(text).trim()
  if (!trimmed) return undefined

  // number, optional decimal, optional unit (cm / ס"מ / ס״מ / centimetres)
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(cm|ס"מ|ס״מ|סמ|centimeters?|centimetres?)?\.?$/i)
  if (!match) return undefined

  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0 || value > 200) return undefined
  return value
}

/**
 * Dimensions that don't describe a plausible bag, for the backfill's review
 * report. Depth deeper than the bag is wide is the signature of transposed
 * width/depth values, which is a real problem in the existing free-text data —
 * flagged for a human, never silently swapped.
 */
export function findDimensionAnomalies(input: BagDerivedInput): string[] {
  const { heightCm, widthCm, depthCm } = input
  const anomalies: string[] = []

  if (isMeasured(depthCm) && isMeasured(widthCm) && depthCm > widthCm) {
    anomalies.push(
      `depth (${depthCm}cm) exceeds width (${widthCm}cm) — width/depth may be transposed`
    )
  }
  if (isMeasured(depthCm) && depthCm > 20) {
    anomalies.push(`depth (${depthCm}cm) is unusually deep for a bag`)
  }
  if (isMeasured(heightCm) && isMeasured(widthCm) && isMeasured(depthCm)) {
    const liters = deriveBagCapacityLiters(heightCm, widthCm, depthCm)
    if (liters !== null && liters > 60) {
      anomalies.push(`computed capacity (${liters}L) is implausibly large`)
    }
  }
  return anomalies
}
