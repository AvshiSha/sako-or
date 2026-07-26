/**
 * Central configuration for the new structured product fields (shoe fit, sizing,
 * image types). Stored/underlying values are stable enum strings; translated labels
 * live here alongside them but are kept in separate `label_en`/`label_he` properties
 * so display text is never persisted to the database.
 */

export interface EnumOption<T extends string> {
  value: T
  label_en: string
  label_he: string
}

// ---------------------------------------------------------------------------
// Shoe fit / sizing enums
// ---------------------------------------------------------------------------

export type SizeFit =
  | 'runs_small'
  | 'true_to_size'
  | 'runs_large'
  | 'depends_on_foot_shape'
  | 'undefined'

export const SIZE_FIT_OPTIONS: EnumOption<SizeFit>[] = [
  { value: 'runs_small', label_en: 'Runs small', label_he: 'המידה קטנה מהרגיל' },
  { value: 'true_to_size', label_en: 'True to size', label_he: 'מידה במידה' },
  { value: 'runs_large', label_en: 'Runs large', label_he: 'המידה גדולה מהרגיל' },
  { value: 'depends_on_foot_shape', label_en: 'Depends on foot shape', label_he: 'תלוי במבנה כף הרגל' },
  { value: 'undefined', label_en: 'Not yet defined', label_he: 'טרם הוגדר' },
]

export type FootWidthFit =
  | 'narrow'
  | 'regular'
  | 'wide'
  | 'narrow_regular'
  | 'regular_wide'
  | 'most_widths'
  | 'adjustable'
  | 'undefined'

export const FOOT_WIDTH_FIT_OPTIONS: EnumOption<FootWidthFit>[] = [
  { value: 'narrow', label_en: 'Narrow feet', label_he: 'כף רגל צרה' },
  { value: 'regular', label_en: 'Regular-width feet', label_he: 'רוחב רגיל' },
  { value: 'wide', label_en: 'Wide feet', label_he: 'כף רגל רחבה' },
  { value: 'narrow_regular', label_en: 'Narrow to regular feet', label_he: 'צרה עד רגילה' },
  { value: 'regular_wide', label_en: 'Regular to wide feet', label_he: 'רגילה עד רחבה' },
  { value: 'most_widths', label_en: 'Suitable for most foot widths', label_he: 'מתאימה לרוב כף הרגל' },
  { value: 'adjustable', label_en: 'Adjustable fit', label_he: 'התאמה מתכווננת' },
  { value: 'undefined', label_en: 'Not yet defined', label_he: 'טרם הוגדר' },
]

export type ArchFit = 'low' | 'regular' | 'high' | 'most_arch_types' | 'undefined'

export const ARCH_FIT_OPTIONS: EnumOption<ArchFit>[] = [
  { value: 'low', label_en: 'Low arch', label_he: 'קשת כף רגל נמוכה' },
  { value: 'regular', label_en: 'Regular arch', label_he: 'קשת כף רגל רגילה' },
  { value: 'high', label_en: 'High arch', label_he: 'קשת כף רגל גבוהה' },
  { value: 'most_arch_types', label_en: 'Suitable for most arch types', label_he: 'מתאים לרוב סוגי קשת כף הרגל' },
  { value: 'undefined', label_en: 'Not yet defined', label_he: 'טרם הוגדר' },
]

export type AdjustableFeature =
  | 'buckle'
  | 'laces'
  | 'elastic'
  | 'velcro'
  | 'adjustable_strap'
  | 'stretch_material'
  | 'no_adjustment'

export const ADJUSTABLE_FEATURE_OPTIONS: EnumOption<AdjustableFeature>[] = [
  { value: 'buckle', label_en: 'Buckle', label_he: 'אבזם' },
  { value: 'laces', label_en: 'Laces', label_he: 'שרוכים' },
  { value: 'elastic', label_en: 'Elastic', label_he: 'גומי' },
  { value: 'velcro', label_en: 'Velcro', label_he: 'סקוץ\'' },
  { value: 'adjustable_strap', label_en: 'Adjustable strap', label_he: 'רצועה מתכווננת' },
  { value: 'stretch_material', label_en: 'Stretch material', label_he: 'חומר גמיש' },
  { value: 'no_adjustment', label_en: 'No adjustment', label_he: 'ללא התאמה' },
]

// ---------------------------------------------------------------------------
// Product image type/view
// ---------------------------------------------------------------------------

export type ProductImageType =
  | 'main'
  | 'front'
  | 'side'
  | 'back'
  | 'top'
  | 'detail'
  | 'on_model'
  | 'lifestyle'
  | 'sole'
  | 'interior'

export const PRODUCT_IMAGE_TYPE_OPTIONS: EnumOption<ProductImageType>[] = [
  { value: 'main', label_en: 'Main image', label_he: 'תמונה ראשית' },
  { value: 'front', label_en: 'Front view', label_he: 'מבט מלפנים' },
  { value: 'side', label_en: 'Side view', label_he: 'מבט מהצד' },
  { value: 'back', label_en: 'Back view', label_he: 'מבט מאחור' },
  { value: 'top', label_en: 'Top view', label_he: 'מבט מלמעלה' },
  { value: 'detail', label_en: 'Detail', label_he: 'תקריב פרט' },
  { value: 'on_model', label_en: 'On-model image', label_he: 'לביש על דוגמנית/ן' },
  { value: 'lifestyle', label_en: 'Lifestyle image', label_he: 'תמונת סטייל' },
  { value: 'sole', label_en: 'Sole view', label_he: 'מבט על הסוליה' },
  { value: 'interior', label_en: 'Interior view', label_he: 'מבט פנימי' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALUES_NOT_YET_DEFINED = new Set(['undefined', 'not_applicable', '', null, undefined])

/** True when a fit value is empty/unset and should not be shown to customers. */
export function isUndefinedFitValue(value: string | null | undefined): boolean {
  return VALUES_NOT_YET_DEFINED.has(value ?? '')
}

export function getOptionLabel<T extends string>(
  options: EnumOption<T>[],
  value: T | string | null | undefined,
  locale: 'en' | 'he'
): string | undefined {
  const match = options.find((option) => option.value === value)
  if (!match) return undefined
  return locale === 'he' ? match.label_he : match.label_en
}

export type CategoryFieldGroup = 'shoes' | 'bags' | 'belts' | 'other'

const SHOE_KEYWORDS = ['shoe', 'נעל', 'boot', 'מגף', 'sandal', 'סנדל', 'sneaker', 'סניקרס', 'pump', 'flat', 'heel']
const BAG_KEYWORDS = ['bag', 'תיק', 'handbag', 'purse']
const BELT_KEYWORDS = ['belt', 'חגור']

function matchesKeyword(value: string | null | undefined, keywords: string[]): boolean {
  if (!value) return false
  const normalized = value.toLowerCase()
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
}

/**
 * Determines which conditional field group a product belongs to, based on its
 * category names. Real category data has `subCategory === "Shoes"` for every
 * footwear product (see scripts/show-category-translation-mapping.md), so a
 * simple keyword match against category/subCategory/subSubCategory (en or he)
 * is reliable today and stays adaptable if new categories are added later.
 */
export function getCategoryFieldGroup(
  ...categoryNames: (string | null | undefined)[]
): CategoryFieldGroup {
  if (categoryNames.some((name) => matchesKeyword(name, SHOE_KEYWORDS))) return 'shoes'
  if (categoryNames.some((name) => matchesKeyword(name, BAG_KEYWORDS))) return 'bags'
  if (categoryNames.some((name) => matchesKeyword(name, BELT_KEYWORDS))) return 'belts'
  return 'other'
}
