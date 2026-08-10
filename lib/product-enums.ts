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
// Product attribute dropdowns (Upper Material, Lining, Insole, Outsole,
// Toe Shape, Heel Type, Closure Type, Sole Type, Heel Height). Field ->
// CategoryFieldGroup gating: UpperMaterial is always shown; Lining/Insole/
// Outsole/SoleType/ToeShape/HeelType/HeelHeightCm are shoe-only (shown when
// fieldGroup === 'shoes'); ClosureType uses shoes/bags/belts; dimensions
// (Height/Width/Depth) are shown for every non-shoe fieldGroup, since they
// don't apply to footwear (see ProductSpecificationsSection.tsx).
// ---------------------------------------------------------------------------

export type UpperMaterial =
  | 'smooth_leather'
  | 'nappa_leather'
  | 'suede'
  | 'patent'
  | 'metallic'
  | 'printed'
  | 'mixed_leather'
  | 'textile'
  | 'mesh'
  | 'knit'
  | 'canvas'
  | 'denim'
  | 'velvet'
  | 'felt'
  | 'synthetic_material'
  | 'rubber'
  | 'pvc'
  | 'straw_raffia'
  | 'cork'
  | 'fur'
  | 'mixed_materials'

export const UPPER_MATERIAL_OPTIONS: EnumOption<UpperMaterial>[] = [
  { value: 'smooth_leather', label_en: 'Smooth Leather', label_he: 'עור חלק' },
  { value: 'nappa_leather', label_en: 'Nappa Leather', label_he: 'עור נאפה' },
  { value: 'suede', label_en: 'Suede Leather', label_he: 'עור זמש' },
  { value: 'patent', label_en: 'Patent Leather', label_he: 'עור פטנט' },
  { value: 'metallic', label_en: 'Metallic Leather', label_he: 'עור מטאלי' },
  { value: 'printed', label_en: 'Printed Leather', label_he: 'עור מודפס' },
  { value: 'mixed_leather', label_en: 'Mixed Leather', label_he: 'עור משולב' },
  { value: 'textile', label_en: 'Textile', label_he: 'טקסטיל' },
  { value: 'mesh', label_en: 'Mesh', label_he: 'רשת' },
  { value: 'knit', label_en: 'Knit', label_he: 'סריג' },
  { value: 'canvas', label_en: 'Canvas', label_he: 'קנבס' },
  { value: 'denim', label_en: 'Denim', label_he: 'דנים' },
  { value: 'velvet', label_en: 'Velvet', label_he: 'קטיפה' },
  { value: 'felt', label_en: 'Felt', label_he: 'לבד' },
  { value: 'synthetic_material', label_en: 'Synthetic Material', label_he: 'חומר סינתטי' },
  { value: 'rubber', label_en: 'Rubber', label_he: 'גומי' },
  { value: 'pvc', label_en: 'PVC', label_he: 'PVC' },
  { value: 'straw_raffia', label_en: 'Straw / Raffia', label_he: 'קש / רפיה' },
  { value: 'cork', label_en: 'Cork', label_he: 'שעם' },
  { value: 'fur', label_en: 'Fur', label_he: 'פרווה' },
  { value: 'mixed_materials', label_en: 'Mixed Materials', label_he: 'שילוב חומרים' },
]

export type Lining =
  | 'leather'
  | 'nappa_leather'
  | 'pig_leather'
  | 'textile'
  | 'microfiber'
  | 'mesh'
  | 'synthetic_material'
  | 'unlined'

export const LINING_OPTIONS: EnumOption<Lining>[] = [
  { value: 'leather', label_en: 'Leather', label_he: 'עור' },
  { value: 'nappa_leather', label_en: 'Nappa Leather', label_he: 'עור נאפה' },
  { value: 'pig_leather', label_en: 'Pig Leather', label_he: 'עור חזיר' },
  { value: 'textile', label_en: 'Textile', label_he: 'טקסטיל' },
  { value: 'microfiber', label_en: 'Microfiber', label_he: 'מיקרופייבר' },
  { value: 'mesh', label_en: 'Mesh', label_he: 'רשת' },
  { value: 'synthetic_material', label_en: 'Synthetic Material', label_he: 'חומר סינתטי' },
  { value: 'unlined', label_en: 'Unlined', label_he: 'ללא בטנה' },
]

export type Insole =
  | 'leather'
  | 'padded_leather'
  | 'microfiber'
  | 'textile'
  | 'memory_foam'
  | 'latex'
  | 'eva'
  | 'pu'
  | 'cork'
  | 'synthetic_material'

export const INSOLE_OPTIONS: EnumOption<Insole>[] = [
  { value: 'leather', label_en: 'Leather', label_he: 'עור' },
  { value: 'padded_leather', label_en: 'Padded Leather', label_he: 'עור מרופד' },
  { value: 'microfiber', label_en: 'Microfiber', label_he: 'מיקרופייבר' },
  { value: 'textile', label_en: 'Textile', label_he: 'טקסטיל' },
  { value: 'memory_foam', label_en: 'Memory Foam', label_he: 'Memory Foam' },
  { value: 'latex', label_en: 'Latex', label_he: 'לטקס' },
  { value: 'eva', label_en: 'EVA', label_he: 'EVA' },
  { value: 'pu', label_en: 'PU', label_he: 'PU' },
  { value: 'cork', label_en: 'Cork', label_he: 'שעם' },
  { value: 'synthetic_material', label_en: 'Synthetic Material', label_he: 'חומר סינתטי' },
]

export type Outsole =
  | 'rubber'
  | 'tr'
  | 'tpu'
  | 'eva'
  | 'pu'
  | 'leather'
  | 'crepe'
  | 'pvc'
  | 'cork'
  | 'mixed_materials'

export const OUTSOLE_OPTIONS: EnumOption<Outsole>[] = [
  { value: 'rubber', label_en: 'Rubber', label_he: 'גומי' },
  { value: 'tr', label_en: 'TR', label_he: 'TR' },
  { value: 'tpu', label_en: 'TPU', label_he: 'TPU' },
  { value: 'eva', label_en: 'EVA', label_he: 'EVA' },
  { value: 'pu', label_en: 'PU', label_he: 'PU' },
  { value: 'leather', label_en: 'Leather', label_he: 'עור' },
  { value: 'crepe', label_en: 'Crepe', label_he: 'קרפ' },
  { value: 'pvc', label_en: 'PVC', label_he: 'PVC' },
  { value: 'cork', label_en: 'Cork', label_he: 'שעם' },
  { value: 'mixed_materials', label_en: 'Mixed Materials', label_he: 'שילוב חומרים' },
]

export type ToeShape =
  | 'round'
  | 'pointed'
  | 'square'
  | 'oval'
  | 'sharp_pointed'
  | 'open_toe'
  | 'peep_toe'

export const TOE_SHAPE_OPTIONS: EnumOption<ToeShape>[] = [
  { value: 'round', label_en: 'Round', label_he: 'עגולה' },
  { value: 'pointed', label_en: 'Pointed', label_he: 'מחודדת' },
  { value: 'square', label_en: 'Square', label_he: 'מרובעת' },
  { value: 'oval', label_en: 'Oval', label_he: 'אליפטית' },
  { value: 'sharp_pointed', label_en: 'Sharp Pointed', label_he: 'שפיצית' },
  { value: 'open_toe', label_en: 'Open Toe', label_he: 'פתוחה' },
  { value: 'peep_toe', label_en: 'Peep Toe', label_he: 'פיפ טואו' },
]

export type HeelType =
  | 'flat'
  | 'block_heel'
  | 'stiletto_heel'
  | 'kitten_heel'
  | 'trapeze_heel'
  | 'cone_heel'
  | 'wedge_heel'
  | 'platform_heel'
  | 'geometric_heel'
  | 'wooden_heel'
  | 'transparent_heel'

export const HEEL_TYPE_OPTIONS: EnumOption<HeelType>[] = [
  { value: 'flat', label_en: 'Flat', label_he: 'שטוחה' },
  { value: 'block_heel', label_en: 'Block Heel', label_he: 'עקב בלוק' },
  { value: 'stiletto_heel', label_en: 'Stiletto Heel', label_he: 'עקב סטילטו' },
  { value: 'kitten_heel', label_en: 'Kitten Heel', label_he: 'עקב קיטן' },
  { value: 'trapeze_heel', label_en: 'Trapeze Heel', label_he: 'עקב טרפז' },
  { value: 'cone_heel', label_en: 'Cone Heel', label_he: 'עקב קוני' },
  { value: 'wedge_heel', label_en: 'Wedge Heel', label_he: 'עקב טריז' },
  { value: 'platform_heel', label_en: 'Platform Heel', label_he: 'עקב פלטפורמה' },
  { value: 'geometric_heel', label_en: 'Geometric Heel', label_he: 'עקב גיאומטרי' },
  { value: 'wooden_heel', label_en: 'Wooden Heel', label_he: 'עקב עץ' },
  { value: 'transparent_heel', label_en: 'Transparent Heel', label_he: 'עקב שקוף' },
]

export type ClosureType =
  | 'no_closure'
  | 'laces'
  | 'zipper'
  | 'buckle'
  | 'velcro'
  | 'elastic'
  | 'button'
  | 'ankle_strap'
  | 'slip_on'

export const CLOSURE_TYPE_OPTIONS: EnumOption<ClosureType>[] = [
  { value: 'no_closure', label_en: 'No Closure', label_he: 'ללא סגירה' },
  { value: 'laces', label_en: 'Laces', label_he: 'שרוכים' },
  { value: 'zipper', label_en: 'Zipper', label_he: 'רוכסן' },
  { value: 'buckle', label_en: 'Buckle', label_he: 'אבזם' },
  { value: 'velcro', label_en: "Velcro", label_he: 'סקוץ\'' },
  { value: 'elastic', label_en: 'Elastic', label_he: 'גומי אלסטי' },
  { value: 'button', label_en: 'Button', label_he: 'כפתור' },
  { value: 'ankle_strap', label_en: 'Ankle Strap', label_he: 'רצועת קרסול' },
  { value: 'slip_on', label_en: 'Slip-On', label_he: 'סליפ-און' },
]

export type SoleType =
  | 'flat'
  | 'platform'
  | 'wedge'
  | 'anatomical'
  | 'flexible'
  | 'thick'
  | 'lug_sole'
  | 'sport_sole'

export const SOLE_TYPE_OPTIONS: EnumOption<SoleType>[] = [
  { value: 'flat', label_en: 'Flat', label_he: 'שטוחה' },
  { value: 'platform', label_en: 'Platform', label_he: 'פלטפורמה' },
  { value: 'wedge', label_en: 'Wedge', label_he: 'טריז' },
  { value: 'anatomical', label_en: 'Anatomical', label_he: 'אנטומית' },
  { value: 'flexible', label_en: 'Flexible', label_he: 'גמישה' },
  { value: 'thick', label_en: 'Thick', label_he: 'עבה' },
  { value: 'lug_sole', label_en: 'Lug Sole', label_he: 'משוננת' },
  { value: 'sport_sole', label_en: 'Sport Sole', label_he: 'ספורטיבית' },
]

/** Heel height in whole centimeters, 0-12. Value is the plain numeric string
 * (e.g. '5') so numeric filtering/sorting stays trivial via Number(value). */
export type HeelHeightCm = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12'

export const HEEL_HEIGHT_CM_OPTIONS: EnumOption<HeelHeightCm>[] = Array.from({ length: 13 }, (_, cm) => ({
  value: String(cm) as HeelHeightCm,
  label_en: `${cm} cm`,
  label_he: `${cm} ס"מ`,
}))

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
