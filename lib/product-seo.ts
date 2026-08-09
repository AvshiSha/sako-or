import type { Product } from '@/lib/product-types'
import { getColorName } from '@/lib/colors'
import {
  getOptionLabel,
  UPPER_MATERIAL_OPTIONS,
  LINING_OPTIONS,
  INSOLE_OPTIONS,
  OUTSOLE_OPTIONS,
  SOLE_TYPE_OPTIONS,
  CLOSURE_TYPE_OPTIONS,
  HEEL_TYPE_OPTIONS,
  TOE_SHAPE_OPTIONS,
  HEEL_HEIGHT_CM_OPTIONS,
  type SizeFit,
  type FootWidthFit,
} from '@/lib/product-enums'

/** English label from the dropdown value when present, else the legacy free text. */
function resolveEnLabel(
  dropdownValue: string | undefined,
  options: { value: string; label_en: string; label_he: string }[],
  legacyEn: string | undefined
): string | undefined {
  if (dropdownValue) {
    const label = getOptionLabel(options, dropdownValue, 'en')
    if (label) return label
  }
  return legacyEn
}

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
    insoleMaterial?: string
    soleMaterial?: string
    soleType?: string
    closureType?: string
    heelType?: string
    toeShape?: string
    heelHeight?: string
  }
  shoeFit?: {
    sizeFit?: SizeFit
    footWidthFit?: FootWidthFit
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
      material: materialCare?.upperMaterial && materialCare.upperMaterial.length > 0
        ? materialCare.upperMaterial
            .map((value) => getOptionLabel(UPPER_MATERIAL_OPTIONS, value, 'en'))
            .filter((label): label is string => !!label)
            .join(', ')
        : firstDefined(materialCare?.upperMaterial_en),
      liningMaterial: firstDefined(resolveEnLabel(materialCare?.lining, LINING_OPTIONS, materialCare?.lining_en)),
      insoleMaterial: firstDefined(resolveEnLabel(materialCare?.insole, INSOLE_OPTIONS, undefined)),
      soleMaterial: firstDefined(resolveEnLabel(materialCare?.outsole, OUTSOLE_OPTIONS, materialCare?.sole_en)),
      soleType: materialCare?.soleType ? getOptionLabel(SOLE_TYPE_OPTIONS, materialCare.soleType, 'en') : undefined,
      closureType: firstDefined(resolveEnLabel(materialCare?.closureType, CLOSURE_TYPE_OPTIONS, materialCare?.closureType_en)),
      heelType: firstDefined(resolveEnLabel(materialCare?.heelType, HEEL_TYPE_OPTIONS, materialCare?.heelType_en)),
      toeShape: firstDefined(resolveEnLabel(materialCare?.toeShape, TOE_SHAPE_OPTIONS, materialCare?.toeShape_en)),
      heelHeight: materialCare?.heelHeight ? getOptionLabel(HEEL_HEIGHT_CM_OPTIONS, materialCare.heelHeight, 'en') : undefined,
    },
    shoeFit: shoeFit
      ? {
          sizeFit: shoeFit.sizeFit,
          footWidthFit: shoeFit.footWidthFit,
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
