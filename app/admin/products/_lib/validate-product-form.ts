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
}

/**
 * The required-field checks shared by both the Add Product and Edit Product
 * pages' real submit buttons. Extracted so the Preview flow validates
 * against the exact same rules as a real save.
 */
export function validateProductFormBasics(
  formData: ProductFormInput,
  categoryFieldGroup: CategoryFieldGroup
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

  const extensionsResult = productExtensionsSchema.safeParse({
    toeShape_en: formData.materialCare.toeShape_en,
    toeShape_he: formData.materialCare.toeShape_he,
    closureType_en: formData.materialCare.closureType_en,
    closureType_he: formData.materialCare.closureType_he,
    heelType_en: formData.materialCare.heelType_en,
    heelType_he: formData.materialCare.heelType_he,
    shoeFit: categoryFieldGroup === 'shoes' ? formData.shoeFit : undefined,
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
  }

  return errors
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
  categoryFieldGroup: CategoryFieldGroup
): PreviewValidationResult {
  const errors = validateProductFormBasics(formData, categoryFieldGroup)
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
