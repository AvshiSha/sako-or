import { z } from 'zod'
import {
  SIZE_FIT_OPTIONS,
  FOOT_WIDTH_FIT_OPTIONS,
  ARCH_FIT_OPTIONS,
  ADJUSTABLE_FEATURE_OPTIONS,
  PRODUCT_IMAGE_TYPE_OPTIONS,
  UPPER_MATERIAL_OPTIONS,
  LINING_OPTIONS,
  INSOLE_OPTIONS,
  OUTSOLE_OPTIONS,
  TOE_SHAPE_OPTIONS,
  HEEL_TYPE_OPTIONS,
  CLOSURE_TYPE_OPTIONS,
  SOLE_TYPE_OPTIONS,
  HEEL_HEIGHT_CM_OPTIONS,
  BAG_TYPE_OPTIONS,
  BAG_INTENDED_USE_OPTIONS,
  CARRYING_OPTION_OPTIONS,
  BAG_STYLE_OPTIONS,
  BAG_STRUCTURE_OPTIONS,
  BAG_SIZE_CATEGORY_OPTIONS,
  STRAP_TYPE_OPTIONS,
  HARDWARE_COLOR_OPTIONS,
  FITS_LAPTOP_INCHES_VALUES,
} from '@/lib/product-enums'

/** Builds a z.enum() tuple from a central EnumOption list, so values stay in one place. */
function enumFromOptions<T extends string>(options: { value: T }[]) {
  const values = options.map((option) => option.value) as [T, ...T[]]
  return z.enum(values)
}

export const sizeFitSchema = enumFromOptions(SIZE_FIT_OPTIONS)
export const footWidthFitSchema = enumFromOptions(FOOT_WIDTH_FIT_OPTIONS)
export const archFitSchema = enumFromOptions(ARCH_FIT_OPTIONS)
export const adjustableFeatureSchema = enumFromOptions(ADJUSTABLE_FEATURE_OPTIONS)
export const productImageTypeSchema = enumFromOptions(PRODUCT_IMAGE_TYPE_OPTIONS)

export const upperMaterialSchema = enumFromOptions(UPPER_MATERIAL_OPTIONS)
export const liningSchema = enumFromOptions(LINING_OPTIONS)
export const insoleSchema = enumFromOptions(INSOLE_OPTIONS)
export const outsoleSchema = enumFromOptions(OUTSOLE_OPTIONS)
export const toeShapeSchema = enumFromOptions(TOE_SHAPE_OPTIONS)
export const heelTypeSchema = enumFromOptions(HEEL_TYPE_OPTIONS)
export const closureTypeSchema = enumFromOptions(CLOSURE_TYPE_OPTIONS)
export const soleTypeSchema = enumFromOptions(SOLE_TYPE_OPTIONS)
export const heelHeightCmSchema = enumFromOptions(HEEL_HEIGHT_CM_OPTIONS)

export const bagTypeSchema = enumFromOptions(BAG_TYPE_OPTIONS)
export const bagIntendedUseSchema = enumFromOptions(BAG_INTENDED_USE_OPTIONS)
export const carryingOptionSchema = enumFromOptions(CARRYING_OPTION_OPTIONS)
export const bagStyleSchema = enumFromOptions(BAG_STYLE_OPTIONS)
export const bagStructureSchema = enumFromOptions(BAG_STRUCTURE_OPTIONS)
export const bagSizeCategorySchema = enumFromOptions(BAG_SIZE_CATEGORY_OPTIONS)
export const strapTypeSchema = enumFromOptions(STRAP_TYPE_OPTIONS)
export const hardwareColorSchema = enumFromOptions(HARDWARE_COLOR_OPTIONS)

/**
 * A measurement that is either a real number or genuinely unknown. `null` is
 * accepted and preserved — an unset measurement must never collapse to 0,
 * which would read as a real value everywhere downstream.
 */
function measurementSchema(options: { max: number; int?: boolean }) {
  const base = options.int ? z.number().int() : z.number()
  return base.positive().max(options.max).nullable().optional()
}

/** Whole-number count that is allowed to be 0 (zero pockets is a real answer,
 * unlike a zero measurement), or null when nobody has checked. */
function countSchema(max: number) {
  return z.number().int().min(0).max(max).nullable().optional()
}

/** Non-empty, trimmed keyword list — used for secondary keywords in both languages. */
export const keywordListSchema = z
  .array(z.string().trim().min(1, 'Keyword cannot be empty'))
  .default([])

export const shoeFitSchema = z.object({
  sizeFit: sizeFitSchema.optional(),
  footWidthFit: footWidthFitSchema.optional(),
  archFit: archFitSchema.optional(),
  adjustableFeatures: z.array(adjustableFeatureSchema).default([]),
  recommendation_en: z.string().optional(),
  recommendation_he: z.string().optional(),
  notes_en: z.string().optional(),
  notes_he: z.string().optional(),
})

export type ShoeFitInput = z.infer<typeof shoeFitSchema>

export const seoLanguageSchema = z.object({
  focusKeyword: z.string().trim().optional(),
  secondaryKeywords: keywordListSchema,
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
})

export const seoSchema = z.object({
  he: seoLanguageSchema.optional(),
  en: seoLanguageSchema.optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/i, 'Slug may only contain letters, numbers and hyphens')
    .optional()
    .or(z.literal('')),
})

export type SeoInput = z.infer<typeof seoSchema>

export const specificationsAdditionsSchema = z.object({
  toeShape_en: z.string().optional(),
  toeShape_he: z.string().optional(),
  closureType_en: z.string().optional(),
  closureType_he: z.string().optional(),
  heelType_en: z.string().optional(),
  heelType_he: z.string().optional(),
  careInstructions_en: z.string().optional(),
  careInstructions_he: z.string().optional(),
  // Dropdown-backed attribute fields (single stable value; labels resolved via
  // getOptionLabel, never persisted). These are separate keys from the legacy
  // _en/_he pairs above, which stay as historical/reconciliation-hint data.
  upperMaterial: z.array(upperMaterialSchema).default([]),
  lining: liningSchema.optional(),
  insole: insoleSchema.optional(),
  outsole: outsoleSchema.optional(),
  soleType: soleTypeSchema.optional(),
  toeShape: toeShapeSchema.optional(),
  heelType: heelTypeSchema.optional(),
  closureType: closureTypeSchema.optional(),
  heelHeight: heelHeightCmSchema.optional(),
  // Structured dimensions in centimetres and weight in grams, replacing the
  // free-text height_en/_he, width_en/_he, depth_en/_he pairs above (which stay
  // as historical/reconciliation-hint data). Shown for every non-shoe group.
  heightCm: measurementSchema({ max: 200 }),
  widthCm: measurementSchema({ max: 200 }),
  depthCm: measurementSchema({ max: 200 }),
  weightGrams: measurementSchema({ max: 20000, int: true }),
})

export type SpecificationsAdditionsInput = z.infer<typeof specificationsAdditionsSchema>

/**
 * Bag-only attributes. Every field is optional and nullable: a bag whose strap
 * nobody has measured must stay unknown rather than claim a value. `bagType`
 * and `intendedUse` are enforced as required on *create* in the admin form
 * (validate-product-form.ts), not here, so existing bags stay editable.
 */
export const bagSpecsSchema = z.object({
  bagType: bagTypeSchema.optional(),
  intendedUse: z.array(bagIntendedUseSchema).default([]),
  carryingOptions: z.array(carryingOptionSchema).default([]),
  bagStyle: z.array(bagStyleSchema).default([]),
  bagStructure: bagStructureSchema.optional(),
  strapType: strapTypeSchema.optional(),
  strapDropCm: measurementSchema({ max: 150 }),
  adjustableStrap: z.boolean().nullable().optional(),
  removableStrap: z.boolean().nullable().optional(),
  mainCompartments: countSchema(5),
  internalPockets: countSchema(10),
  externalPockets: countSchema(10),
  hardwareColor: hardwareColorSchema.optional(),
  baseFeet: z.boolean().nullable().optional(),
  // Derived by lib/bag-derived.ts. Stored here only when an admin overrides the
  // computed value; otherwise left unset and computed at sync time.
  bagSizeCategory: bagSizeCategorySchema.optional(),
  fitsA4: z.boolean().nullable().optional(),
  fitsTablet: z.boolean().nullable().optional(),
  fitsLaptopInches: z
    .number()
    .int()
    .refine((value) => (FITS_LAPTOP_INCHES_VALUES as readonly number[]).includes(value), {
      message: `Laptop size must be one of: ${FITS_LAPTOP_INCHES_VALUES.join(', ')} inches`,
    })
    .nullable()
    .optional(),
})

export type BagSpecsInput = z.infer<typeof bagSpecsSchema>

/** Keys an admin can override, i.e. the derived fields. Used by the sync route
 * to decide whether to keep a stored value or recompute it. */
export const BAG_DERIVED_OVERRIDE_KEYS = [
  'bagSizeCategory',
  'fitsA4',
  'fitsTablet',
  'fitsLaptopInches',
] as const satisfies readonly (keyof BagSpecsInput)[]

export const basicInfoAdditionsSchema = z.object({
  shortTitle_en: z.string().optional(),
  shortTitle_he: z.string().optional(),
  shortDescription_en: z.string().optional(),
  shortDescription_he: z.string().optional(),
})

export type BasicInfoAdditionsInput = z.infer<typeof basicInfoAdditionsSchema>

export const productImageSchema = z.object({
  url: z.string().min(1),
  altEn: z.string().optional(),
  altHe: z.string().optional(),
  type: productImageTypeSchema.optional(),
  order: z.number().int().nonnegative().optional(),
})

export type ProductImageInput = z.infer<typeof productImageSchema>

/**
 * Composed schema for the new field groups added on top of a product. All top-level
 * keys are optional so existing products missing these fields remain valid, and
 * nothing here becomes a newly-required field.
 */
export const productExtensionsSchema = z.object({
  ...basicInfoAdditionsSchema.shape,
  ...specificationsAdditionsSchema.shape,
  shoeFit: shoeFitSchema.optional(),
  bagSpecs: bagSpecsSchema.optional(),
  seo: seoSchema.optional(),
})

export type ProductExtensionsInput = z.infer<typeof productExtensionsSchema>

/** Maps a Zod safeParse failure into a flat field->message record, matching the
 * hand-rolled FormErrors convention already used by the admin product forms. */
export function zodErrorsToFieldMap(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'root'
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}
