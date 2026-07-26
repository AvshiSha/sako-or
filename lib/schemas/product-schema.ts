import { z } from 'zod'
import {
  SIZE_FIT_OPTIONS,
  FOOT_WIDTH_FIT_OPTIONS,
  ARCH_FIT_OPTIONS,
  ADJUSTABLE_FEATURE_OPTIONS,
  PRODUCT_IMAGE_TYPE_OPTIONS,
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
})

export type SpecificationsAdditionsInput = z.infer<typeof specificationsAdditionsSchema>

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
