/**
 * A bag's structured attributes, resolved to bilingual label/value rows.
 *
 * One builder, three consumers: the product page's spec table, the JSON-LD
 * `additionalProperty` list, and the bag guide page. They must not drift —
 * Chatbase reads the rendered text and the structured data from the same page,
 * and a bag that claims one thing in the table and another in the markup is
 * worse than one that says nothing.
 *
 * Rows are omitted entirely when their value is unknown. Nothing here invents a
 * value: a `null` boolean produces no row, rather than a row saying "No".
 */

import {
  BAG_TYPE_OPTIONS,
  BAG_INTENDED_USE_OPTIONS,
  CARRYING_OPTION_OPTIONS,
  BAG_STYLE_OPTIONS,
  BAG_STRUCTURE_OPTIONS,
  BAG_SIZE_CATEGORY_OPTIONS,
  STRAP_TYPE_OPTIONS,
  HARDWARE_COLOR_OPTIONS,
  getOptionLabel,
  getOptionLabels,
  type HardwareColor,
} from '@/lib/product-enums'
import { deriveBagFacts } from '@/lib/bag-derived'
import type { Product } from '@/lib/product-types'

export interface BagFactRow {
  /** Stable key, for React lists and for callers that want to pick specific rows. */
  key: string
  label: string
  value: string
}

type Locale = 'en' | 'he'

interface BagFactsOptions {
  /** Resolved hardware colour for the displayed variant, if any. */
  hardwareColor?: HardwareColor
}

/** Dimensions and weight as their own rows — shared by bags, belts and anything
 * else non-footwear, so this is separate from the bag-only rows below. */
export function buildMeasurementRows(
  product: Pick<Product, 'materialCare'>,
  locale: Locale
): BagFactRow[] {
  const mc = product.materialCare
  const rows: BagFactRow[] = []
  const cm = (value: number) => (locale === 'he' ? `${value} ס"מ` : `${value} cm`)

  const push = (key: string, label: string, value: string | undefined) => {
    if (value) rows.push({ key, label, value })
  }

  if (typeof mc?.heightCm === 'number') {
    push('heightCm', locale === 'he' ? 'גובה' : 'Height', cm(mc.heightCm))
  } else {
    push('height', locale === 'he' ? 'גובה' : 'Height', locale === 'he' ? mc?.height_he : mc?.height_en)
  }

  if (typeof mc?.widthCm === 'number') {
    push('widthCm', locale === 'he' ? 'רוחב' : 'Width', cm(mc.widthCm))
  } else {
    push('width', locale === 'he' ? 'רוחב' : 'Width', locale === 'he' ? mc?.width_he : mc?.width_en)
  }

  if (typeof mc?.depthCm === 'number') {
    push('depthCm', locale === 'he' ? 'עומק' : 'Depth', cm(mc.depthCm))
  } else {
    push('depth', locale === 'he' ? 'עומק' : 'Depth', locale === 'he' ? mc?.depth_he : mc?.depth_en)
  }

  if (typeof mc?.weightGrams === 'number') {
    push('weightGrams', locale === 'he' ? 'משקל' : 'Weight', locale === 'he' ? `${mc.weightGrams} גרם` : `${mc.weightGrams} g`)
  }

  return rows
}

/**
 * Bag-only rows: type, use, carry, strap, compartments, and the values derived
 * from the dimensions. Returns an empty array for a product with no bagSpecs,
 * so callers can render it unconditionally.
 */
export function buildBagFactRows(
  product: Pick<Product, 'bagSpecs' | 'materialCare'>,
  locale: Locale,
  options: BagFactsOptions = {}
): BagFactRow[] {
  const bagSpecs = product.bagSpecs
  if (!bagSpecs) return []

  const mc = product.materialCare
  const derived = deriveBagFacts({
    heightCm: mc?.heightCm,
    widthCm: mc?.widthCm,
    depthCm: mc?.depthCm,
    bagStructure: bagSpecs.bagStructure ?? null,
  })

  // An admin override always wins over the computed value.
  const sizeCategory = bagSpecs.bagSizeCategory ?? derived.bagSizeCategory
  const fitsA4 = bagSpecs.fitsA4 ?? derived.fitsA4
  const fitsTablet = bagSpecs.fitsTablet ?? derived.fitsTablet
  const fitsLaptop = bagSpecs.fitsLaptopInches ?? derived.fitsLaptopInches

  const he = locale === 'he'
  const yesText = he ? 'כן' : 'Yes'
  const noText = he ? 'לא' : 'No'

  const rows: BagFactRow[] = []
  const push = (key: string, label: string, value: string | undefined) => {
    if (value) rows.push({ key, label, value })
  }
  const pushBool = (key: string, label: string, value: boolean | null | undefined) => {
    if (typeof value === 'boolean') rows.push({ key, label, value: value ? yesText : noText })
  }
  const pushNumber = (key: string, label: string, value: number | null | undefined, format?: (n: number) => string) => {
    if (typeof value === 'number') rows.push({ key, label, value: format ? format(value) : String(value) })
  }

  push('bagType', he ? 'סוג תיק' : 'Bag Type', getOptionLabel(BAG_TYPE_OPTIONS, bagSpecs.bagType, locale))
  push('bagSizeCategory', he ? 'גודל' : 'Size', getOptionLabel(BAG_SIZE_CATEGORY_OPTIONS, sizeCategory, locale))
  pushNumber('capacity', he ? 'נפח' : 'Capacity', derived.bagCapacityLiters, (n) =>
    he ? `${n} ליטר` : `${n} L`
  )
  push('bagStructure', he ? 'מבנה' : 'Structure', getOptionLabel(BAG_STRUCTURE_OPTIONS, bagSpecs.bagStructure, locale))
  push('intendedUse', he ? 'מתאים ל' : 'Intended Use', getOptionLabels(BAG_INTENDED_USE_OPTIONS, bagSpecs.intendedUse, locale))
  push('carryingOptions', he ? 'אופן נשיאה' : 'Carrying Options', getOptionLabels(CARRYING_OPTION_OPTIONS, bagSpecs.carryingOptions, locale))
  push('bagStyle', he ? 'סגנון' : 'Style', getOptionLabels(BAG_STYLE_OPTIONS, bagSpecs.bagStyle, locale))
  push('strapType', he ? 'סוג רצועה' : 'Strap Type', getOptionLabel(STRAP_TYPE_OPTIONS, bagSpecs.strapType, locale))
  pushNumber('strapDropCm', he ? 'אורך רצועה' : 'Strap Drop', bagSpecs.strapDropCm, (n) =>
    he ? `${n} ס"מ` : `${n} cm`
  )
  pushBool('adjustableStrap', he ? 'רצועה מתכווננת' : 'Adjustable Strap', bagSpecs.adjustableStrap)
  pushBool('removableStrap', he ? 'רצועה ניתנת להסרה' : 'Removable Strap', bagSpecs.removableStrap)
  pushNumber('mainCompartments', he ? 'תאים ראשיים' : 'Main Compartments', bagSpecs.mainCompartments)
  pushNumber('internalPockets', he ? 'כיסים פנימיים' : 'Internal Pockets', bagSpecs.internalPockets)
  pushNumber('externalPockets', he ? 'כיסים חיצוניים' : 'External Pockets', bagSpecs.externalPockets)
  push(
    'hardwareColor',
    he ? 'צבע אביזרים' : 'Hardware Colour',
    getOptionLabel(HARDWARE_COLOR_OPTIONS, options.hardwareColor ?? bagSpecs.hardwareColor, locale)
  )
  pushBool('baseFeet', he ? 'רגליות הגנה' : 'Protective Base Feet', bagSpecs.baseFeet)
  pushBool('fitsA4', he ? 'מתאים ל-A4' : 'Fits A4', fitsA4)
  pushBool('fitsTablet', he ? 'מתאים לטאבלט' : 'Fits a Tablet', fitsTablet)
  pushNumber('fitsLaptopInches', he ? 'מתאים למחשב נייד' : 'Fits Laptop', fitsLaptop, (n) =>
    he ? `עד ${n}"` : `Up to ${n}"`
  )

  return rows
}
