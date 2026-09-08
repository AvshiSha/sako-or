import { z } from 'zod'
import { zodErrorsToFieldMap } from '@/lib/schemas/product-schema'
import { getAllColorSlugs } from '@/lib/colors'
import { normalizeSizeKey } from '@/lib/product-size'
import { resolveColorSlug, resolveGender, type ChatbaseGender } from '@/lib/chatbase/collection-catalog'
import {
  allowedValuesFor,
  ARCH_HEIGHT_REQUEST_VALUES,
  expandArchHeight,
  expandFootWidth,
  FOOT_WIDTH_REQUEST_VALUES,
  isArchHeightRequest,
  isFootWidthRequest,
  SPEC_FILTER_KEYS,
  unknownValuesFor,
  type SpecFilterKey,
} from '@/lib/chatbase/product-api-enums'
import { footwearCategoryKeys, resolveCategoryScope } from '@/lib/chatbase/product-scope'

/**
 * Request validation for search_shoes.
 *
 * Two passes, because the valid vocabulary depends on the request itself: zod
 * checks shape, types and numeric ranges, then a second pass checks enum
 * membership - category keys against the requested gender, spec values against
 * the stored enums, colours against the colour table.
 *
 * Unknown values are always rejected, never dropped. Silently ignoring a filter
 * would widen the search past what the customer asked for and hand Chatbase a
 * product that does not meet their requirement.
 */

/** Guards against a request that would defeat the point of filtering. */
const MAX_VALUES_PER_FILTER = 20
export const DEFAULT_LIMIT = 5
export const MAX_LIMIT = 10

/** Whole centimetres, matching the stored HeelHeightCm enum ('0'..'12'). */
const MAX_HEEL_CM = 12

const stringList = z
  .array(z.string().trim().min(1))
  .max(MAX_VALUES_PER_FILTER, `At most ${MAX_VALUES_PER_FILTER} values.`)

/** Sizes arrive as numbers from Chatbase and as strings from humans. */
const sizeList = z
  .array(z.union([z.number(), z.string().trim().min(1)]))
  .max(MAX_VALUES_PER_FILTER, `At most ${MAX_VALUES_PER_FILTER} values.`)

const price = z
  .number()
  .nonnegative('Must be a non-negative number.')
  .finite('Must be a finite number.')

const heelCm = z
  .number()
  .nonnegative('Must be a non-negative number.')
  .max(MAX_HEEL_CM, `Must be at most ${MAX_HEEL_CM}.`)

const specFilterShape = Object.fromEntries(
  SPEC_FILTER_KEYS.map((key) => [key, stringList.optional()])
) as Record<SpecFilterKey, z.ZodOptional<typeof stringList>>

export const searchShoesSchema = z
  .object({
    locale: z.enum(['he', 'en']).optional(),
    gender: z.string().optional(),
    // Plain-language shortcuts for the two fit filters a customer describes in
    // words. Expanded server-side into the stored value sets, so the agent
    // sends one word instead of reproducing an enum list exactly.
    footWidth: z.string().optional(),
    archHeight: z.string().optional(),
    categories: stringList.optional(),
    sizes: sizeList.optional(),
    colors: stringList.optional(),
    minPrice: price.optional(),
    maxPrice: price.optional(),
    onSaleOnly: z.boolean().optional(),
    outletOnly: z.boolean().optional(),
    minHeelHeightCm: heelCm.optional(),
    maxHeelHeightCm: heelCm.optional(),
    inStockOnly: z.boolean().optional(),
    sortBy: z
      .enum(['relevance', 'price_asc', 'price_desc', 'newest', 'discount_desc'])
      .optional(),
    limit: z
      .number()
      .int('Must be a whole number.')
      .min(1, 'Must be at least 1.')
      .max(MAX_LIMIT, `Must be at most ${MAX_LIMIT}.`)
      .optional(),
    ...specFilterShape,
  })
  // Unknown keys are rejected rather than ignored, so a misspelled filter name
  // surfaces as an error instead of quietly widening the search.
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minPrice'],
        message: 'Must not be greater than maxPrice.',
      })
    }
    if (
      value.minHeelHeightCm !== undefined &&
      value.maxHeelHeightCm !== undefined &&
      value.minHeelHeightCm > value.maxHeelHeightCm
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minHeelHeightCm'],
        message: 'Must not be greater than maxHeelHeightCm.',
      })
    }
  })

export type SearchShoesInput = z.infer<typeof searchShoesSchema>

export type ValidatedSearchRequest = {
  locale: 'he' | 'en'
  gender: ChatbaseGender
  categoryKeys: string[]
  categoryPaths: string[]
  colors: string[]
  sizes: string[]
  specs: Partial<Record<SpecFilterKey, string[]>>
  minPrice?: number
  maxPrice?: number
  onSaleOnly: boolean
  outletOnly: boolean
  minHeelHeightCm?: number
  maxHeelHeightCm?: number
  inStockOnly: boolean
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'discount_desc'
  limit: number
  /** True when any fit filter was supplied, which makes fit quality worth scoring. */
  fitRequested: boolean
}

export type ValidationOutcome =
  | { ok: true; request: ValidatedSearchRequest }
  | { ok: false; fields: Record<string, string> }

function listMessage(unknown: string[], allowed: string[]): string {
  const shown = allowed.slice(0, 12).join(', ')
  const suffix = allowed.length > 12 ? ', …' : ''
  return `Unknown value(s): ${unknown.join(', ')}. Allowed: ${shown}${suffix}`
}

/** Numeric fields Chatbase may deliver as strings ("300" rather than 300). */
const NUMERIC_FIELDS = new Set([
  'minPrice',
  'maxPrice',
  'minHeelHeightCm',
  'maxHeelHeightCm',
  'limit',
])

const BOOLEAN_FIELDS = new Set(['onSaleOnly', 'outletOnly', 'inStockOnly'])

/**
 * Fields that take a list. The Chatbase action UI gives the agent one text box
 * per data input, so a multi-value filter arrives as "most_widths,wide" rather
 * than as two entries. No value in any of these vocabularies contains a comma -
 * category keys use `&` and `-`, colour slugs and sizes neither - so splitting
 * on it is unambiguous.
 */
const LIST_FIELDS = new Set<string>([
  'categories',
  'colors',
  'sizes',
  // find_similar_shoes takes its colours under a different name, and it is fed
  // by the same single-text-box action UI.
  'requestedColors',
  ...SPEC_FILTER_KEYS,
])

function toList(value: unknown): unknown[] {
  const entries = Array.isArray(value) ? value : [value]
  return entries.flatMap((entry) =>
    typeof entry === 'string' ? entry.split(',') : [entry]
  )
}

/** An unsubstituted Chatbase placeholder, e.g. `{{colors}}`. */
function isUnresolvedTemplate(value: string): boolean {
  return /^\{\{.*\}\}$/.test(value.trim())
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' || isUnresolvedTemplate(trimmed)
  }
  return false
}

/**
 * Normalise what Chatbase actually sends.
 *
 * Chatbase substitutes action-body placeholders textually, so a variable the
 * agent never collected arrives as `""` or as the literal `{{colors}}`, and
 * numbers arrive as strings often enough to matter. None of that is the
 * customer stating a requirement, so it is stripped to "absent" here rather
 * than failing validation - a 400 on an omitted optional filter would make the
 * agent give up on a search it should have run.
 *
 * This only ever REMOVES noise or fixes a type. It never invents a filter and
 * never widens one the customer did state: a genuinely unknown value still
 * reaches the enum check and still produces a 400.
 */
export function sanitizeRequestBody(body: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(body)) {
    if (isEmptyValue(value)) continue

    if (LIST_FIELDS.has(key)) {
      const kept = toList(value)
        .map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
        .filter((entry) => !isEmptyValue(entry))
      if (kept.length > 0) cleaned[key] = kept
      continue
    }

    if (Array.isArray(value)) {
      const kept = value.filter((entry) => !isEmptyValue(entry))
      if (kept.length > 0) cleaned[key] = kept
      continue
    }

    if (NUMERIC_FIELDS.has(key) && typeof value === 'string') {
      const parsed = Number(value.trim())
      if (Number.isFinite(parsed)) cleaned[key] = parsed
      // A non-numeric string for a numeric field is a real error: keep it so
      // validation reports it rather than silently dropping the constraint.
      else cleaned[key] = value
      continue
    }

    if (BOOLEAN_FIELDS.has(key) && typeof value === 'string') {
      const lowered = value.trim().toLowerCase()
      if (lowered === 'true') cleaned[key] = true
      else if (lowered === 'false') cleaned[key] = false
      else cleaned[key] = value
      continue
    }

    cleaned[key] = value
  }

  return cleaned
}

export function validateSearchRequest(body: unknown): ValidationOutcome {
  const normalized =
    body && typeof body === 'object' && !Array.isArray(body)
      ? sanitizeRequestBody(body as Record<string, unknown>)
      : body

  const parsed = searchShoesSchema.safeParse(normalized)
  if (!parsed.success) {
    return { ok: false, fields: zodErrorsToFieldMap(parsed.error) }
  }

  const input = parsed.data
  const fields: Record<string, string> = {}

  const gender = resolveGender(input.gender)
  const locale = input.locale ?? 'he'

  // Categories are validated against the requested gender: men have no pumps,
  // and a women's category is never a silent fallback for a men's request.
  const categoryKeys = input.categories ?? []
  const scope = resolveCategoryScope(categoryKeys, gender)
  if (scope.unknown.length > 0) {
    fields.categories = listMessage(scope.unknown, footwearCategoryKeys(gender))
  }

  const specs: Partial<Record<SpecFilterKey, string[]>> = {}
  let fitRequested = false

  // Expanded first so an explicit footWidthFits list below can override the
  // shortcut rather than silently merging with it.
  if (input.footWidth !== undefined) {
    if (!isFootWidthRequest(input.footWidth)) {
      fields.footWidth = listMessage([input.footWidth], [...FOOT_WIDTH_REQUEST_VALUES])
    } else {
      specs.footWidthFits = expandFootWidth(input.footWidth)
      fitRequested = true
    }
  }
  if (input.archHeight !== undefined) {
    if (!isArchHeightRequest(input.archHeight)) {
      fields.archHeight = listMessage([input.archHeight], [...ARCH_HEIGHT_REQUEST_VALUES])
    } else {
      specs.archFits = expandArchHeight(input.archHeight)
      fitRequested = true
    }
  }

  for (const key of SPEC_FILTER_KEYS) {
    const values = input[key]
    if (!values?.length) continue
    const unknown = unknownValuesFor(key, values)
    if (unknown.length > 0) {
      fields[key] = listMessage(unknown, allowedValuesFor(key))
      continue
    }
    specs[key] = [...new Set(values)]
    if (key === 'sizeFits' || key === 'footWidthFits' || key === 'archFits') {
      fitRequested = true
    }
  }

  // Colours accept a slug, an English name or Hebrew in any inflection, but the
  // resolved slug must be one the catalogue actually uses - an unrecognised
  // colour returns a 400 with the vocabulary rather than an empty result set
  // that looks like "we have none".
  const knownColorSlugs = new Set(getAllColorSlugs())
  const colors: string[] = []
  const unknownColors: string[] = []
  for (const raw of input.colors ?? []) {
    const slug = resolveColorSlug(raw)
    if (!slug || !knownColorSlugs.has(slug)) {
      unknownColors.push(raw)
      continue
    }
    colors.push(slug)
  }
  if (unknownColors.length > 0) {
    fields.colors = listMessage(unknownColors, [...knownColorSlugs].sort())
  }

  const sizes = [
    ...new Set((input.sizes ?? []).map((size) => normalizeSizeKey(String(size))).filter(Boolean)),
  ]

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields }
  }

  return {
    ok: true,
    request: {
      locale,
      gender,
      categoryKeys,
      categoryPaths: scope.paths,
      colors: [...new Set(colors)],
      sizes,
      specs,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      onSaleOnly: input.onSaleOnly ?? false,
      outletOnly: input.outletOnly ?? false,
      minHeelHeightCm: input.minHeelHeightCm,
      maxHeelHeightCm: input.maxHeelHeightCm,
      // Defaults to true: the whole point is not to recommend what cannot be bought.
      inStockOnly: input.inStockOnly ?? true,
      sortBy: input.sortBy ?? 'relevance',
      limit: input.limit ?? DEFAULT_LIMIT,
      fitRequested,
    },
  }
}
