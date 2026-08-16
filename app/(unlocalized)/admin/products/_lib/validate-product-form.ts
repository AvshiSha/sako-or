import { productExtensionsSchema, zodErrorsToFieldMap } from '@/lib/schemas/product-schema'
import type { CategoryFieldGroup } from '@/lib/product-enums'
import type { ProductFormInput } from './product-form-types'

export interface ProductFormErrors {
  sku?: string
  title_en?: string
  title_he?: string
  description_en?: string
  description_he?: string
  price?: string
  brand?: string
  category?: string
  subCategory?: string
  subSubCategory?: string
  colorVariants?: string
  seoSlug?: string
  shoeFit?: string
  bagSpecs?: string
  bagType?: string
  intendedUse?: string
}

/**
 * Non-blocking prompts, shown as a banner rather than stopping a save. Used for
 * bag data on products that already exist: the fields matter, but a half-filled
 * bag still needs its price and stock editable today.
 */
export interface ProductFormWarnings {
  bagSpecs?: string
}

/**
 * The required-field checks shared by both the Add Product and Edit Product
 * pages' real submit buttons. Extracted so the Preview flow validates
 * against the exact same rules as a real save.
 *
 * `isCreate` gates the bag-data requirements: a new bag can't be saved without
 * a type and at least one intended use, but an existing one can — see
 * getBagSpecsWarning for the softer treatment on edit.
 */
export function validateProductFormBasics(
  formData: ProductFormInput,
  categoryFieldGroup: CategoryFieldGroup,
  isCreate = false
): ProductFormErrors {
  const errors: ProductFormErrors = {}

  if (!formData.sku.trim()) errors.sku = 'SKU is required'
  if (!formData.title_en.trim()) errors.title_en = 'English title is required'
  if (!formData.title_he.trim()) errors.title_he = 'Hebrew title is required'
  if (!formData.description_en.trim()) errors.description_en = 'English description is required'
  if (!formData.description_he.trim()) errors.description_he = 'Hebrew description is required'
  if (formData.price <= 0) errors.price = 'Price must be greater than 0'
  if (!formData.brand.trim()) errors.brand = 'Brand is required'
  if (!formData.category.trim()) errors.category = 'Main category is required'
  if (formData.colorVariants.length === 0) errors.colorVariants = 'At least one color variant is required'

  // Bag type and intended use are what the sales assistant filters on first, so
  // a bag without them can't be recommended at all. Enforced on create only —
  // blocking every edit would hold price and stock fixes hostage to a field
  // nobody may know the answer to yet.
  if (isCreate && categoryFieldGroup === 'bags') {
    if (!formData.bagSpecs?.bagType) errors.bagType = 'Bag type is required'
    if (!formData.bagSpecs?.intendedUse?.length) {
      errors.intendedUse = 'Select at least one intended use'
    }
  }

  const extensionsResult = productExtensionsSchema.safeParse({
    toeShape_en: formData.materialCare.toeShape_en,
    toeShape_he: formData.materialCare.toeShape_he,
    closureType_en: formData.materialCare.closureType_en,
    closureType_he: formData.materialCare.closureType_he,
    heelType_en: formData.materialCare.heelType_en,
    heelType_he: formData.materialCare.heelType_he,
    upperMaterial: formData.materialCare.upperMaterial,
    lining: formData.materialCare.lining,
    insole: formData.materialCare.insole,
    outsole: formData.materialCare.outsole,
    soleType: formData.materialCare.soleType,
    toeShape: formData.materialCare.toeShape,
    heelType: formData.materialCare.heelType,
    closureType: formData.materialCare.closureType,
    heelHeight: formData.materialCare.heelHeight,
    heightCm: formData.materialCare.heightCm,
    widthCm: formData.materialCare.widthCm,
    depthCm: formData.materialCare.depthCm,
    weightGrams: formData.materialCare.weightGrams,
    shoeFit: categoryFieldGroup === 'shoes' ? formData.shoeFit : undefined,
    bagSpecs: categoryFieldGroup === 'bags' ? formData.bagSpecs : undefined,
    seo: {
      slug: formData.seo.slug,
      he: { focusKeyword: formData.seo.focusKeyword_he, secondaryKeywords: formData.seo.secondaryKeywords_he },
      en: { focusKeyword: formData.seo.focusKeyword_en, secondaryKeywords: formData.seo.secondaryKeywords_en },
    },
  })
  if (!extensionsResult.success) {
    const fieldMap = zodErrorsToFieldMap(extensionsResult.error)
    if (fieldMap['seo.slug']) errors.seoSlug = fieldMap['seo.slug']
    const shoeFitIssue = Object.keys(fieldMap).find((key) => key.startsWith('shoeFit'))
    if (shoeFitIssue) errors.shoeFit = fieldMap[shoeFitIssue]
    const bagSpecsIssue = Object.keys(fieldMap).find((key) => key.startsWith('bagSpecs'))
    if (bagSpecsIssue) errors.bagSpecs = fieldMap[bagSpecsIssue]
  }

  return errors
}

/**
 * The nudge shown when editing a bag that's missing the two fields the
 * assistant needs. Returns undefined for anything that isn't an incomplete bag,
 * so callers can render it unconditionally.
 */
export function getBagSpecsWarning(
  formData: ProductFormInput,
  categoryFieldGroup: CategoryFieldGroup
): string | undefined {
  if (categoryFieldGroup !== 'bags') return undefined

  const missing: string[] = []
  if (!formData.bagSpecs?.bagType) missing.push('bag type')
  if (!formData.bagSpecs?.intendedUse?.length) missing.push('intended use')
  if (missing.length === 0) return undefined

  return `This bag is missing its ${missing.join(' and ')}. You can still save, but it won't be recommended by the sales assistant until they're set.`
}

export interface PreviewValidationResult {
  errors: ProductFormErrors
  /** Non-blocking, per-colorSlug warnings (e.g. "no images assigned") carried into the draft for display in Preview Mode rather than blocking the click. */
  warnings: Record<string, string>
}

/**
 * Preview-specific validation: reuses the same required-field rules as a
 * real save (blocking), plus image-readiness checks that a real save
 * doesn't need to care about synchronously (still-uploading images block
 * preview since we can't build a payload with a pending upload; a color
 * with zero images does NOT block preview — it's surfaced as a warning
 * inside Preview Mode instead, per spec).
 */
export function validateForPreview(
  formData: ProductFormInput,
  categoryFieldGroup: CategoryFieldGroup,
  isCreate = false
): PreviewValidationResult {
  const errors = validateProductFormBasics(formData, categoryFieldGroup, isCreate)
  const warnings: Record<string, string> = {}

  for (const variant of formData.colorVariants) {
    if (!variant.isActive) continue

    const stillUploading = variant.images.some((img) => img.uploading)
    if (stillUploading) {
      errors.colorVariants = `Wait for images to finish uploading for color "${variant.colorSlug}" before previewing.`
    }

    if (variant.images.length === 0) {
      warnings[variant.colorSlug] = 'No images assigned to this color.'
    }
  }

  return { errors, warnings }
}

export function isPreviewValidationBlocking(errors: ProductFormErrors): boolean {
  return Object.keys(errors).length > 0
}
