/**
 * Builds a clean JSON snapshot of an in-progress admin product form for the
 * `seo-suggest` Claude Code skill. Mirrors the field grouping in
 * lib/product-seo.ts (StructuredProductData) but reads from the admin form's
 * in-memory draft shape instead of a saved Product, so it also works for
 * products that haven't been created yet.
 */

interface SeoExportColorVariant {
  colorName?: string
  colorSlug?: string
  isActive?: boolean
}

export interface SeoExportInput {
  sku?: string
  title_en?: string
  title_he?: string
  shortTitle_en?: string
  shortTitle_he?: string
  description_en?: string
  description_he?: string
  shortDescription_en?: string
  shortDescription_he?: string
  category?: string
  subCategory?: string
  subSubCategory?: string
  categories_path?: string[]
  brand?: string
  materialCare?: {
    upperMaterial_en?: string
    lining_en?: string
    sole_en?: string
    closureType_en?: string
    heelType_en?: string
    toeShape_en?: string
  }
  shoeFit?: unknown
  colorVariants?: SeoExportColorVariant[]
  seo?: {
    title_en?: string
    title_he?: string
    description_en?: string
    description_he?: string
    slug?: string
    focusKeyword_en?: string
    focusKeyword_he?: string
    secondaryKeywords_en?: string[]
    secondaryKeywords_he?: string[]
  }
}

/** Strips undefined, empty-string, and empty-array values so the copied JSON stays readable. */
function removeEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    const cleaned = value.map(removeEmpty).filter((v) => v !== undefined)
    return (cleaned.length > 0 ? cleaned : undefined) as T
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const cleanedValue = removeEmpty(v)
      if (cleanedValue !== undefined) cleaned[key] = cleanedValue
    }
    return (Object.keys(cleaned).length > 0 ? cleaned : undefined) as T
  }
  if (typeof value === 'string' && value.trim().length === 0) return undefined as T
  return value
}

export function buildSeoExportPayload(formData: SeoExportInput): object {
  const activeColors = (formData.colorVariants ?? [])
    .filter((v) => v.isActive !== false)
    .map((v) => v.colorName)
    .filter((name): name is string => !!name)

  const payload = {
    title: { en: formData.title_en, he: formData.title_he },
    shortTitle: { en: formData.shortTitle_en, he: formData.shortTitle_he },
    description: {
      shortEn: formData.shortDescription_en,
      shortHe: formData.shortDescription_he,
      fullEn: formData.description_en,
      fullHe: formData.description_he,
    },
    classification: {
      category: formData.categories_path?.[0] ?? formData.category,
      subcategory: formData.categories_path?.[1] ?? formData.subCategory,
      productType: formData.categories_path?.[2] ?? formData.subSubCategory,
      brand: formData.brand,
      sku: formData.sku,
    },
    specifications: {
      colors: activeColors,
      material: formData.materialCare?.upperMaterial_en,
      liningMaterial: formData.materialCare?.lining_en,
      soleMaterial: formData.materialCare?.sole_en,
      closureType: formData.materialCare?.closureType_en,
      heelType: formData.materialCare?.heelType_en,
      toeShape: formData.materialCare?.toeShape_en,
    },
    shoeFit: formData.shoeFit,
    /** Whatever SEO fields the admin has already typed in — the skill should treat these as a starting draft, not overwrite blindly. */
    currentSeoDraft: formData.seo,
  }

  return removeEmpty(payload) ?? {}
}
