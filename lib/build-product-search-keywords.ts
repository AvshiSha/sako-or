import { getColorName, normalizeColorSlug } from '@/lib/colors'
import { expandHebrewQuery, extractColorsSearchNorm, generateHebrewVariations } from '@/lib/hebrew-normalize'

const MAX_GENERATED_KEYWORDS = 40
const MAX_SIZE_KEYWORDS = 12

export interface ProductSearchKeywordInput {
  title_he?: string
  title_en?: string
  category?: string | null
  subCategory?: string | null
  subSubCategory?: string | null
  category_he?: string | null
  subCategory_he?: string | null
  subSubCategory_he?: string | null
  brand?: string
  tags?: string[]
  upperMaterial_he?: string | null
  lining_he?: string | null
  sole_he?: string | null
  colorVariants?: unknown
}

type ColorVariantRecord = {
  colorSlug?: string
  colorName?: string
  isActive?: boolean
  stockBySize?: Record<string, number>
}

function addKeyword(keywords: Set<string>, value: string | null | undefined) {
  if (!value || typeof value !== 'string') return
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    keywords.add(trimmed)
  }
}

function addHebrewExpansions(keywords: Set<string>, phrase: string) {
  addKeyword(keywords, phrase)
  expandHebrewQuery(phrase).slice(0, 6).forEach((term) => addKeyword(keywords, term))
}

function addColorKeywords(keywords: Set<string>, slugOrName: string) {
  if (!slugOrName?.trim()) return

  addKeyword(keywords, slugOrName)
  const normalized = normalizeColorSlug(slugOrName)
  addKeyword(keywords, getColorName(normalized, 'en'))
  addKeyword(keywords, getColorName(normalized, 'he'))

  if (/[\u0590-\u05FF]/.test(slugOrName)) {
    generateHebrewVariations(slugOrName).slice(0, 4).forEach((v) => addKeyword(keywords, v))
  }
}

function isVariantActive(variant: ColorVariantRecord): boolean {
  return variant.isActive !== false
}

function getInStockSizes(variant: ColorVariantRecord): string[] {
  if (!variant.stockBySize || typeof variant.stockBySize !== 'object') {
    return []
  }

  return Object.entries(variant.stockBySize)
    .filter(([, stock]) => Number(stock) > 0)
    .map(([size]) => size.trim())
    .filter((size) => size.length > 0)
}

/**
 * Build auto-generated search keywords from product metadata and all active variants.
 * Manual admin keywords stay in searchKeywords; this array is stored separately in Neon.
 */
export function buildGeneratedSearchKeywords(input: ProductSearchKeywordInput): string[] {
  const keywords = new Set<string>()

  const categoryPhrases = [
    input.category_he,
    input.subCategory_he,
    input.subSubCategory_he,
    input.category,
    input.subCategory,
    input.subSubCategory,
  ].filter(Boolean) as string[]

  categoryPhrases.forEach((phrase) => addHebrewExpansions(keywords, phrase))

  addKeyword(keywords, input.brand)

  ;[input.upperMaterial_he, input.lining_he, input.sole_he].forEach((material) => {
    if (material?.trim()) {
      material
        .split(/\s+/)
        .filter((word) => word.length >= 3)
        .slice(0, 4)
        .forEach((word) => {
          addKeyword(keywords, word)
          if (/[\u0590-\u05FF]/.test(word)) {
            generateHebrewVariations(word).slice(0, 2).forEach((v) => addKeyword(keywords, v))
          }
        })
    }
  })

  if (input.colorVariants && typeof input.colorVariants === 'object') {
    const sizeKeywords = new Set<string>()

    for (const [jsonKey, data] of Object.entries(
      input.colorVariants as Record<string, ColorVariantRecord>
    )) {
      if (!isVariantActive(data)) continue

      addColorKeywords(keywords, jsonKey)
      if (data.colorSlug) addColorKeywords(keywords, data.colorSlug)
      if (data.colorName) addColorKeywords(keywords, data.colorName)

      for (const size of getInStockSizes(data)) {
        if (/^\d{2,3}$/.test(size)) {
          sizeKeywords.add(size)
          sizeKeywords.add(`מידה ${size}`)
        }
      }
    }

    Array.from(sizeKeywords).slice(0, MAX_SIZE_KEYWORDS).forEach((sizeKw) => addKeyword(keywords, sizeKw))
  }

  return Array.from(keywords)
    .filter((kw) => kw.length >= 2)
    .slice(0, MAX_GENERATED_KEYWORDS)
}

export function buildProductSearchDerivedFields(input: ProductSearchKeywordInput) {
  return {
    colors_search_norm: extractColorsSearchNorm(input.colorVariants),
    generated_search_keywords: buildGeneratedSearchKeywords(input),
  }
}
