import type { Product } from '@/lib/product-types'
import { getColorName } from '@/lib/colors'
import type { SizeFit, FootWidthFit } from '@/lib/product-enums'

/**
 * Clean, structured JSON projection of a product, intended as the single entry
 * point a future AI SEO assistant (or any other SEO tooling) would read from.
 * Adapted to the current data model rather than a new/parallel schema — see
 * lib/product-types.ts for the underlying stored shape.
 */
export interface StructuredProductData {
  title: { he: string; en: string }
  shortTitle: { he?: string; en?: string }
  description: { shortHe?: string; shortEn?: string; fullHe: string; fullEn: string }
  classification: {
    category?: string
    subcategory?: string
    productType?: string
    brand?: string
    sku?: string
  }
  specifications: {
    mainColor?: string
    additionalColors?: string[]
    material?: string
    liningMaterial?: string
    soleMaterial?: string
    closureType?: string
    heelType?: string
    toeShape?: string
    pattern?: string
    finish?: string
  }
  shoeFit?: {
    sizeFit?: SizeFit
    footWidthFit?: FootWidthFit
    toeBoxFit?: string
    instepFit?: string
    archFit?: string
    adjustableFeatures?: string[]
    recommendationHe?: string
    recommendationEn?: string
    notesHe?: string
    notesEn?: string
  }
  seo: {
    he: { focusKeyword?: string; secondaryKeywords?: string[]; metaTitle?: string; metaDescription?: string }
    en: { focusKeyword?: string; secondaryKeywords?: string[]; metaTitle?: string; metaDescription?: string }
    slug?: string
  }
}

function firstDefined(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => !!value && value.trim().length > 0)
}

/** Derives main/additional colors from the product's color variants rather than storing duplicate data. */
function deriveColors(product: Product): { mainColor?: string; additionalColors?: string[] } {
  const slugs = Object.values(product.colorVariants ?? {})
    .filter((variant) => variant.isActive !== false)
    .map((variant) => variant.colorSlug)
    .filter(Boolean)

  if (slugs.length === 0) return {}

  const names = slugs.map((slug) => getColorName(slug, 'en')).filter(Boolean)
  const [mainColor, ...rest] = names

  return {
    mainColor,
    additionalColors: rest.length > 0 ? rest : undefined,
  }
}

export function getStructuredProductData(product: Product): StructuredProductData {
  const { mainColor, additionalColors } = deriveColors(product)
  const materialCare = product.materialCare
  const shoeFit = product.shoeFit
  const seo = product.seo

  return {
    title: { he: product.title_he, en: product.title_en },
    shortTitle: { he: product.shortTitle_he, en: product.shortTitle_en },
    description: {
      shortHe: product.shortDescription_he,
      shortEn: product.shortDescription_en,
      fullHe: product.description_he,
      fullEn: product.description_en,
    },
    classification: {
      category: firstDefined(product.category),
      subcategory: firstDefined(product.subCategory),
      productType: firstDefined(product.subSubCategory),
      brand: firstDefined(product.brand),
      sku: firstDefined(product.sku),
    },
    specifications: {
      mainColor,
      additionalColors,
      material: firstDefined(materialCare?.upperMaterial_en),
      liningMaterial: firstDefined(materialCare?.lining_en),
      soleMaterial: firstDefined(materialCare?.sole_en),
      closureType: firstDefined(materialCare?.closureType_en),
      heelType: firstDefined(materialCare?.heelType_en),
      toeShape: firstDefined(materialCare?.toeShape_en),
      pattern: firstDefined(materialCare?.pattern_en),
      finish: firstDefined(materialCare?.finish_en),
    },
    shoeFit: shoeFit
      ? {
          sizeFit: shoeFit.sizeFit,
          footWidthFit: shoeFit.footWidthFit,
          toeBoxFit: shoeFit.toeBoxFit,
          instepFit: shoeFit.instepFit,
          archFit: shoeFit.archFit,
          adjustableFeatures: shoeFit.adjustableFeatures,
          recommendationHe: shoeFit.recommendation_he,
          recommendationEn: shoeFit.recommendation_en,
          notesHe: shoeFit.notes_he,
          notesEn: shoeFit.notes_en,
        }
      : undefined,
    seo: {
      he: {
        focusKeyword: seo?.focusKeyword_he,
        secondaryKeywords: seo?.secondaryKeywords_he,
        metaTitle: seo?.title_he,
        metaDescription: seo?.description_he,
      },
      en: {
        focusKeyword: seo?.focusKeyword_en,
        secondaryKeywords: seo?.secondaryKeywords_en,
        metaTitle: seo?.title_en,
        metaDescription: seo?.description_en,
      },
      slug: seo?.slug,
    },
  }
}
