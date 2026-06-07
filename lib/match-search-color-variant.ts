import { generateHebrewVariations } from '@/lib/hebrew-normalize'
import { getColorName, normalizeColorSlug } from '@/lib/colors'

export const HEBREW_TO_ENGLISH_COLORS: Record<string, string> = {
  שחור: 'black',
  לבן: 'white',
  אדום: 'red',
  כחול: 'blue',
  ירוק: 'green',
  צהוב: 'yellow',
  חום: 'brown',
  אפור: 'gray',
  ורוד: 'pink',
  סגול: 'purple',
  כתום: 'orange',
  ניוד: 'nude',
  בורדו: 'bordeaux',
  'שחור ואדום': 'black-red',
  'שחור ולבן': 'black-white',
  שקוף: 'transparent',
  כאמל: 'camel',
  'ורוד בהיר': 'light-pink',
  קרמל: 'caramel',
  ארד: 'bronze',
  'חום בהיר': 'light-brown',
  'חום כהה': 'dark-brown',
  'כחול כהה': 'dark-blue',
  בז: 'beige',
  זהב: 'gold',
  כסף: 'silver',
  'אוף וויט': 'off-white',
  תכלת: 'light-blue',
}

export const BASE_COLOR_KEYWORDS = [
  'black',
  'white',
  'red',
  'blue',
  'green',
  'yellow',
  'brown',
  'gray',
  'grey',
  'pink',
  'purple',
  'orange',
  'nude',
  'beige',
  'bordeaux',
  'camel',
  'gold',
  'silver',
  'navy',
  'olive',
  'transparent',
  'שחור',
  'לבן',
  'אדום',
  'כחול',
  'ירוק',
  'צהוב',
  'חום',
  'אפור',
  'ורוד',
  'סגול',
  'כתום',
]

function addColorTerm(colorKeywords: Set<string>, color: string): void {
  const trimmedColor = color.trim()
  if (!trimmedColor) return

  const isHebrew = /[\u0590-\u05FF]/.test(trimmedColor)
  if (isHebrew) {
    colorKeywords.add(trimmedColor)
    generateHebrewVariations(trimmedColor).forEach((v) => {
      if (v?.trim()) colorKeywords.add(v.trim())
    })
    const englishTranslation = HEBREW_TO_ENGLISH_COLORS[trimmedColor]
    if (englishTranslation) {
      colorKeywords.add(englishTranslation.toLowerCase())
    }
    generateHebrewVariations(trimmedColor).forEach((v) => {
      const eng = HEBREW_TO_ENGLISH_COLORS[v.trim()]
      if (eng) colorKeywords.add(eng.toLowerCase())
    })
  } else {
    colorKeywords.add(trimmedColor.toLowerCase())
    colorKeywords.add(normalizeColorSlug(trimmedColor))
  }
}

/** Extract color terms from a search query (Hebrew + English, incl. multi-word phrases). */
export function extractSearchColorTerms(searchQuery: string): string[] {
  const colorKeywords = new Set<string>()
  let remaining = searchQuery.trim()

  const hebrewPhrases = Object.keys(HEBREW_TO_ENGLISH_COLORS)
    .filter((phrase) => phrase.includes(' ') || phrase.length > 2)
    .sort((a, b) => b.length - a.length)

  for (const phrase of hebrewPhrases) {
    if (remaining.includes(phrase)) {
      addColorTerm(colorKeywords, phrase)
      remaining = remaining.replace(phrase, ' ')
    }
  }

  const lowerRemaining = remaining.toLowerCase()
  for (const [hebrew, english] of Object.entries(HEBREW_TO_ENGLISH_COLORS)) {
    if (hebrew.includes(' ')) continue
    if (lowerRemaining.includes(english)) {
      addColorTerm(colorKeywords, english)
    }
  }

  for (const slug of Object.keys(HEBREW_TO_ENGLISH_COLORS)) {
    const english = HEBREW_TO_ENGLISH_COLORS[slug]
    if (!english.includes('-')) continue
    const spaced = english.replace(/-/g, ' ')
    if (lowerRemaining.includes(spaced)) {
      addColorTerm(colorKeywords, english)
    }
  }

  remaining
    .split(/\s+/)
    .filter((word) => {
      const trimmedWord = word.trim()
      if (trimmedWord.length <= 2) return false
      const lowerWord = trimmedWord.toLowerCase()
      return (
        BASE_COLOR_KEYWORDS.includes(trimmedWord) ||
        BASE_COLOR_KEYWORDS.includes(lowerWord)
      )
    })
    .forEach((color) => addColorTerm(colorKeywords, color))

  return Array.from(colorKeywords)
}

type ColorVariantLike = {
  colorSlug?: string
  colorName?: string
  isActive?: boolean
}

function variantMatchValues(
  variantKey: string,
  variant: ColorVariantLike
): Set<string> {
  const values = new Set<string>()
  const slug = variant.colorSlug || variantKey

  for (const raw of [slug, variant.colorName, variantKey]) {
    if (!raw) continue
    values.add(raw)
    values.add(raw.toLowerCase())
    values.add(normalizeColorSlug(raw))
  }

  const localizedEn = getColorName(slug, 'en')
  const localizedHe = getColorName(slug, 'he')
  if (localizedEn) {
    values.add(localizedEn)
    values.add(localizedEn.toLowerCase())
    values.add(normalizeColorSlug(localizedEn))
  }
  if (localizedHe) {
    values.add(localizedHe)
    values.add(normalizeColorSlug(localizedHe))
  }

  return values
}

function termMatchesVariant(term: string, matchValues: Set<string>): boolean {
  const lowerTerm = term.toLowerCase()
  const normalizedTerm = normalizeColorSlug(lowerTerm)

  for (const value of matchValues) {
    const lowerValue = value.toLowerCase()
    if (
      value === term ||
      lowerValue === lowerTerm ||
      normalizeColorSlug(value) === normalizedTerm
    ) {
      return true
    }
  }

  return false
}

/**
 * Pick the color variant slug that best matches color terms in the search query.
 * Returns undefined when no color is mentioned or no variant matches.
 */
export function matchSearchColorSlug(
  searchQuery: string,
  colorVariants: Record<string, ColorVariantLike> | null | undefined
): string | undefined {
  if (!colorVariants || typeof colorVariants !== 'object') return undefined

  const terms = extractSearchColorTerms(searchQuery)
  if (terms.length === 0) return undefined

  const activeVariants = Object.entries(colorVariants).filter(
    ([, variant]) => variant?.isActive !== false
  )
  if (activeVariants.length === 0) return undefined

  const englishSlugs = terms
    .map((t) => t.toLowerCase())
    .filter((t) => /^[a-z-]+$/.test(t))

  if (englishSlugs.length >= 2) {
    for (const compound of [
      `${englishSlugs[0]}-${englishSlugs[1]}`,
      `${englishSlugs[0]}-and-${englishSlugs[1]}`,
    ]) {
      for (const [key, variant] of activeVariants) {
        const slug = normalizeColorSlug(variant.colorSlug || key)
        if (slug === compound) {
          return variant.colorSlug || key
        }
      }
    }
  }

  for (const [key, variant] of activeVariants) {
    const matchValues = variantMatchValues(key, variant)
    if (terms.some((term) => termMatchesVariant(term, matchValues))) {
      return variant.colorSlug || key
    }
  }

  return undefined
}

export function enrichSearchItemWithMatchedColor<T extends { colorVariants?: unknown }>(
  item: T,
  searchQuery: string
): T & { matchedColorSlug?: string } {
  const matchedColorSlug = matchSearchColorSlug(
    searchQuery,
    item.colorVariants as Record<string, ColorVariantLike> | null | undefined
  )
  return matchedColorSlug ? { ...item, matchedColorSlug } : { ...item }
}
