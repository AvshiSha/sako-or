import { getAllColorTranslations, normalizeColorSlug } from '@/lib/colors'
import { generateHebrewVariations, normalizeHebrewForSearch } from '@/lib/hebrew-normalize'
import { normalizeSizeKey } from '@/lib/product-size'

export type ChatbaseGender = 'women' | 'men'

export type CollectionCategory = {
  /** Canonical key the API accepts and echoes back. */
  key: string
  gender: ChatbaseGender
  /** Collection path of the regular category, or null when there is none. */
  regularPath: string | null
  /**
   * False when the category exists in Firestore but is disabled. Category
   * resolution does NOT check `isEnabled` (see categoryService.getCategoryIdsFromPath),
   * so a disabled category still renders a page - it is simply missing from the
   * nav. Linking to one would send a customer somewhere the site itself never
   * offers, so we skip straight to the outlet twin instead.
   */
  regularEnabled: boolean
  /** Collection path of the parallel outlet category, or null when there is none. */
  outletPath: string | null
  /** Extra tokens (Hebrew and English) that resolve to this category. */
  aliases: string[]
}

/**
 * Regular <-> outlet category pairing for the Chatbase availability check.
 *
 * Hand-maintained against the live Firestore `categories` tree rather than
 * derived from it, because the pairing is editorial and is not encoded in the
 * data anywhere. Three rows cannot be guessed from the slugs:
 *
 *  - `slippers` (כפכפים) pairs with `outlet-flip-flops`. There is no
 *    `outlet-slippers`, and no regular `flip-flops`.
 *  - `ballerina-&-flats` has a DISABLED regular category but a live outlet one,
 *    so it goes straight to outlet.
 *  - `platform-loafers`, bags and belts have no outlet twin at all.
 *
 * Men's categories have no outlet section, and no women's category is ever a
 * fallback for a men's request. When a category is added, renamed, disabled or
 * re-parented in the admin, update this table - collection-catalog.test.ts
 * checks its shape, not its truth.
 */
export const COLLECTION_CATEGORIES: CollectionCategory[] = [
  // --- Women / Shoes -------------------------------------------------------
  {
    key: 'pumps',
    gender: 'women',
    regularPath: 'women/shoes/pumps',
    regularEnabled: true,
    outletPath: 'women/outlet/outlet-pumps',
    aliases: ['נעלי סירה', 'נעל סירה', 'סירה', 'נעלי עקב', 'עקבים', 'court shoes', 'heels', 'outlet-pumps'],
  },
  {
    key: 'boots',
    gender: 'women',
    regularPath: 'women/shoes/boots',
    regularEnabled: true,
    outletPath: 'women/outlet/outlet-boots',
    aliases: ['מגפיים', 'מגף', 'outlet-boots'],
  },
  {
    key: 'low-boots',
    gender: 'women',
    regularPath: 'women/shoes/low-boots',
    regularEnabled: true,
    outletPath: 'women/outlet/outlet-low-boots',
    aliases: ['מגפונים', 'מגפון', 'ankle boots', 'booties', 'outlet-low-boots'],
  },
  {
    key: 'oxford',
    gender: 'women',
    regularPath: 'women/shoes/oxford',
    regularEnabled: true,
    outletPath: 'women/outlet/outlet-oxford',
    aliases: ['אוקספורד', 'oxfords', 'outlet-oxford'],
  },
  {
    key: 'moccasin',
    gender: 'women',
    regularPath: 'women/shoes/moccasin',
    regularEnabled: true,
    outletPath: 'women/outlet/outlet-moccasin',
    aliases: ['מוקסין', 'מוקסינים', 'moccasins', 'outlet-moccasin'],
  },
  {
    key: 'sneakers',
    gender: 'women',
    regularPath: 'women/shoes/sneakers',
    regularEnabled: true,
    outletPath: 'women/outlet/outlet-sneakers',
    aliases: ['סניקרס', 'סניקר', 'נעלי ספורט', 'trainers', 'outlet-sneakers'],
  },
  {
    key: 'sandals',
    gender: 'women',
    regularPath: 'women/shoes/sandals',
    regularEnabled: true,
    outletPath: 'women/outlet/outlet-sandals',
    aliases: ['סנדלים', 'סנדל', 'outlet-sandals'],
  },
  {
    // כפכפים on both sides: the outlet twin is `outlet-flip-flops`, and
    // `outlet-slippers` does not exist.
    key: 'slippers',
    gender: 'women',
    regularPath: 'women/shoes/slippers',
    regularEnabled: true,
    outletPath: 'women/outlet/outlet-flip-flops',
    aliases: ['כפכפים', 'כפכף', 'קבקבים', 'קבקב', 'flip flops', 'flip-flops', 'outlet-flip-flops'],
  },
  {
    key: 'platform-loafers',
    gender: 'women',
    regularPath: 'women/shoes/platform-loafers',
    regularEnabled: true,
    outletPath: null,
    aliases: ['לואפרים פלטפורמה', 'לואפרים', 'לואפר', 'loafers', 'platform loafers'],
  },
  {
    // Regular category is disabled in the admin; only the outlet twin is live.
    key: 'ballerina-&-flats',
    gender: 'women',
    regularPath: 'women/shoes/ballerina-&-flats',
    regularEnabled: false,
    outletPath: 'women/outlet/outlet-ballerina-&-flats',
    aliases: [
      'בלרינה וסירות שטוחות',
      'בלרינה',
      'בלרינות',
      'סירות שטוחות',
      'סירה שטוחה',
      'ballerina',
      'ballerina & flats',
      'flats',
      'outlet-ballerina-&-flats',
    ],
  },

  // --- Women / Accessories -------------------------------------------------
  {
    key: 'bags',
    gender: 'women',
    regularPath: 'women/accessories/bags',
    regularEnabled: true,
    outletPath: null,
    aliases: ['תיקים', 'תיק', 'bag', 'handbags'],
  },
  {
    key: 'belts',
    gender: 'women',
    regularPath: 'women/accessories/belts',
    regularEnabled: true,
    outletPath: null,
    aliases: ['חגורות', 'חגורה', 'belt'],
  },

  // --- Women / level-1 entry points ---------------------------------------
  // Whole-section checks. Never empty unfiltered, but a colour+size filter
  // across a whole section can be, which is exactly what the agent needs to
  // know before offering the link.
  {
    key: 'shoes',
    gender: 'women',
    regularPath: 'women/shoes',
    regularEnabled: true,
    outletPath: 'women/outlet',
    aliases: ['נעליים', 'נעל', 'footwear'],
  },
  {
    key: 'accessories',
    gender: 'women',
    regularPath: 'women/accessories',
    regularEnabled: true,
    outletPath: null,
    aliases: ['אקססוריז', 'אביזרים'],
  },
  {
    key: 'outlet',
    gender: 'women',
    regularPath: null,
    regularEnabled: false,
    outletPath: 'women/outlet',
    aliases: ['אאוטלט', 'sale', 'מבצעים'],
  },

  // --- Men -----------------------------------------------------------------
  // No outlet section exists for men.
  {
    key: 'moccasins',
    gender: 'men',
    regularPath: 'men/shoes/moccasins',
    regularEnabled: true,
    outletPath: null,
    aliases: ['מוקסינים', 'מוקסין', 'moccasin'],
  },
  {
    key: 'slides-&-sandals',
    gender: 'men',
    regularPath: 'men/shoes/slides-&-sandals',
    regularEnabled: true,
    outletPath: null,
    aliases: ['כפכפים וסנדלים', 'כפכפים', 'כפכף', 'סנדלים', 'סנדל', 'slides', 'sandals', 'flip flops'],
  },
  {
    key: 'belts',
    gender: 'men',
    regularPath: 'men/accessories/belts',
    regularEnabled: true,
    outletPath: null,
    aliases: ['חגורות', 'חגורה', 'belt'],
  },
  {
    key: 'shoes',
    gender: 'men',
    regularPath: 'men/shoes',
    regularEnabled: true,
    outletPath: null,
    aliases: ['נעליים', 'נעל', 'footwear'],
  },
  {
    key: 'accessories',
    gender: 'men',
    regularPath: 'men/accessories',
    regularEnabled: true,
    outletPath: null,
    aliases: ['אקססוריז', 'אביזרים'],
  },
]

export const DEFAULT_GENDER: ChatbaseGender = 'women'

/**
 * Shared token normalizer for category and colour lookup. Reuses the search
 * normalizer so Hebrew sofit letters, niqqud and quote marks fold the same way
 * they do in site search, and collapses hyphens to spaces so `low-boots`,
 * `low boots` and `Low Boots` are one token.
 */
function normalizeToken(value: string): string {
  return normalizeHebrewForSearch(value)
}

let categoryIndex: Map<string, CollectionCategory> | null = null

function getCategoryIndex(): Map<string, CollectionCategory> {
  if (categoryIndex) return categoryIndex
  const index = new Map<string, CollectionCategory>()
  for (const category of COLLECTION_CATEGORIES) {
    const tokens = [category.key, ...category.aliases]
    for (const token of tokens) {
      const normalized = normalizeToken(token)
      if (!normalized) continue
      const indexKey = `${category.gender}:${normalized}`
      // First declaration wins, so an alias can never shadow a canonical key
      // declared earlier in the table.
      if (!index.has(indexKey)) {
        index.set(indexKey, category)
      }
    }
  }
  categoryIndex = index
  return index
}

/** Normalized once, because the normalizer folds sofit letters (גברים -> גברימ). */
const MEN_TOKENS = new Set(['men', 'male', 'man', 'mens', 'גברים', 'גבר'].map(normalizeToken))

export function resolveGender(value: unknown): ChatbaseGender {
  if (typeof value !== 'string') return DEFAULT_GENDER
  return MEN_TOKENS.has(normalizeToken(value)) ? 'men' : DEFAULT_GENDER
}

/** Resolve a category token within one gender. Never crosses genders. */
export function resolveCategory(
  category: string,
  gender: ChatbaseGender
): CollectionCategory | null {
  const normalized = normalizeToken(category)
  if (!normalized) return null
  return getCategoryIndex().get(`${gender}:${normalized}`) ?? null
}

/** Canonical keys accepted for a gender, for error responses. */
export function categoryKeysForGender(gender: ChatbaseGender): string[] {
  return COLLECTION_CATEGORIES.filter((c) => c.gender === gender).map((c) => c.key)
}

/**
 * The other gender in which this token would resolve, if any. Returned as a
 * hint on an unknown-category error so the agent can retry with the right
 * gender instead of guessing a URL - we never switch gender on its behalf.
 */
export function otherGenderWithCategory(
  category: string,
  gender: ChatbaseGender
): ChatbaseGender | null {
  const other: ChatbaseGender = gender === 'women' ? 'men' : 'women'
  return resolveCategory(category, other) ? other : null
}

let colorAliasIndex: Map<string, string> | null = null

function getColorAliasIndex(): Map<string, string> {
  if (colorAliasIndex) return colorAliasIndex
  const index = new Map<string, string>()
  const add = (text: string | undefined, slug: string) => {
    if (!text) return
    const normalized = normalizeToken(text)
    // First declaration wins, so `gray`/`navy` beat the later `grey`/`dark-blue`
    // aliases that share a Hebrew name.
    if (normalized && !index.has(normalized)) index.set(normalized, slug)
  }
  for (const [slug, translation] of Object.entries(getAllColorTranslations())) {
    add(slug, slug)
    add(translation.en, slug)
    add(translation.he, slug)
    // Hebrew adjectives inflect for gender and number: a customer asking for
    // "נעלי סירה לבנות" yields "לבנות", not "לבן".
    for (const variation of generateHebrewVariations(translation.he)) {
      add(variation, slug)
    }
  }
  colorAliasIndex = index
  return index
}

/**
 * Resolve a colour the agent sent - slug, English name or Hebrew name in any
 * inflection - to the colour slug the `colors` query param expects.
 *
 * Falls back to the normalized input when nothing matches, rather than
 * rejecting: the colour table does not cover every slug that exists on a
 * product, and an unmatched colour simply yields a zero count, which is the
 * safe answer. `availableColors` in the response is what lets the agent
 * recover from a genuine typo.
 */
export function resolveColorSlug(color: string): string {
  const trimmed = color.trim()
  if (!trimmed) return ''
  const direct = normalizeColorSlug(trimmed)
  if (direct in getAllColorTranslations()) return direct
  return getColorAliasIndex().get(normalizeToken(trimmed)) ?? direct
}

export function resolveColorSlugs(colors: string[]): string[] {
  const resolved = colors.map(resolveColorSlug).filter(Boolean)
  return [...new Set(resolved)]
}

/** Normalize sizes to the keys `stockBySize` is looked up by ("40.0" -> "40"). */
export function resolveSizes(sizes: string[]): string[] {
  const resolved = sizes.map((size) => normalizeSizeKey(String(size))).filter(Boolean)
  return [...new Set(resolved)]
}

export type CollectionUrlFilters = {
  colors: string[]
  sizes: string[]
}

/**
 * Build the canonical collection URL. Path segments are the English slugs -
 * the storefront nav emits `slug.en` on both locales (navigation-categories.server.ts),
 * so `/he/collection/women/shoes/pumps` is the real Hebrew URL. Params match
 * what useCollectionFilterUrl writes: comma-joined `colors` then `sizes`.
 */
export function buildCollectionUrl(
  locale: string,
  categoryPath: string,
  filters: CollectionUrlFilters
): string {
  const params = new URLSearchParams()
  if (filters.colors.length > 0) params.set('colors', filters.colors.join(','))
  if (filters.sizes.length > 0) params.set('sizes', filters.sizes.join(','))
  // URLSearchParams escapes the separator to %2C. It round-trips either way,
  // but this URL gets pasted into a chat window for a customer to read, so
  // keep the literal comma the site's own address bar shows.
  const queryString = params.toString().replace(/%2C/g, ',')
  const base = `/${locale}/collection/${categoryPath}`
  return queryString ? `${base}?${queryString}` : base
}
