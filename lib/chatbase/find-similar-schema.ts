import { z } from 'zod'
import { zodErrorsToFieldMap } from '@/lib/schemas/product-schema'
import { getAllColorSlugs } from '@/lib/colors'
import { normalizeSizeKey } from '@/lib/product-size'
import { resolveColorSlug } from '@/lib/chatbase/collection-catalog'
import {
  allowedValuesFor,
  ARCH_HEIGHT_REQUEST_VALUES,
  expandArchHeight,
  expandFootWidth,
  FOOT_WIDTH_REQUEST_VALUES,
  isArchHeightRequest,
  isFootWidthRequest,
  unknownValuesFor,
  type SpecFilterKey,
} from '@/lib/chatbase/product-api-enums'
import type { PublicProduct } from '@/lib/chatbase/product-presenter'
import { sanitizeRequestBody } from '@/lib/chatbase/search-shoes-schema'

/**
 * find_similar_shoes: alternatives to a product the customer already has in mind.
 *
 * The source product establishes what "similar" means; the customer's reason for
 * asking establishes what is non-negotiable. Requirements are applied as hard
 * filters BEFORE anything is scored, so visual similarity can never override a
 * stated need - a closer lookalike that does not come in size 39 is not an
 * answer to "do you have this in 39".
 */

const REASONS = [
  'size_unavailable',
  'color_unavailable',
  'width_mismatch',
  'arch_mismatch',
  'lower_heel',
  'more_stable_heel',
  'lower_price',
  'general_similarity',
] as const

export type SimilarReason = (typeof REASONS)[number]

/** Heel types a customer means by "something more stable". */
export const STABLE_HEEL_TYPES = ['flat', 'block_heel', 'wedge_heel', 'platform_heel']

const stringList = z.array(z.string().trim().min(1)).max(20)

export const findSimilarSchema = z
  .object({
    locale: z.enum(['he', 'en']).optional(),
    sourceProductId: z.string().trim().min(1).optional(),
    sourceSku: z.string().trim().min(1).optional(),
    sourceProductUrl: z.string().trim().min(1).optional(),
    requestedSize: z.union([z.number(), z.string().trim().min(1)]).optional(),
    requestedColors: stringList.optional(),
    minPrice: z.number().nonnegative().finite().optional(),
    maxPrice: z.number().nonnegative().finite().optional(),
    reason: z.enum(REASONS).optional(),
    footWidth: z.string().trim().min(1).optional(),
    archHeight: z.string().trim().min(1).optional(),
    maxHeelHeightCm: z.number().nonnegative().max(12).optional(),
    heelTypes: stringList.optional(),
    categories: stringList.optional(),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.sourceProductId && !value.sourceSku && !value.sourceProductUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceSku'],
        message: 'Provide one of sourceProductId, sourceSku or sourceProductUrl.',
      })
    }
  })

export type FindSimilarRequest = {
  locale: 'he' | 'en'
  sourceProductId?: string
  sourceSku?: string
  sourceProductUrl?: string
  requestedSize?: string
  requestedColors: string[]
  minPrice?: number
  maxPrice?: number
  reason: SimilarReason
  specs: Partial<Record<SpecFilterKey, string[]>>
  maxHeelHeightCm?: number
  categories: string[]
  limit: number
}

export type FindSimilarResult = {
  sourceProduct: { sku: string; title: string; found: boolean } | null
  totalMatches: number
  products: PublicProduct[]
  relaxationSuggestions?: Array<{ filter: string; message: string }>
  message?: string
}

export type ValidationOutcome =
  | { ok: true; request: FindSimilarRequest }
  | { ok: false; fields: Record<string, string> }

export function validateFindSimilarRequest(body: unknown): ValidationOutcome {
  const normalized =
    body && typeof body === 'object' && !Array.isArray(body)
      ? sanitizeRequestBody(body as Record<string, unknown>)
      : body

  const parsed = findSimilarSchema.safeParse(normalized)
  if (!parsed.success) {
    return { ok: false, fields: zodErrorsToFieldMap(parsed.error) }
  }

  const input = parsed.data
  const fields: Record<string, string> = {}
  const specs: Partial<Record<SpecFilterKey, string[]>> = {}

  if (input.footWidth !== undefined) {
    if (!isFootWidthRequest(input.footWidth)) {
      fields.footWidth = `Unknown value: ${input.footWidth}. Allowed: ${FOOT_WIDTH_REQUEST_VALUES.join(', ')}`
    } else {
      specs.footWidthFits = expandFootWidth(input.footWidth)
    }
  }

  if (input.archHeight !== undefined) {
    if (!isArchHeightRequest(input.archHeight)) {
      fields.archHeight = `Unknown value: ${input.archHeight}. Allowed: ${ARCH_HEIGHT_REQUEST_VALUES.join(', ')}`
    } else {
      specs.archFits = expandArchHeight(input.archHeight)
    }
  }

  if (input.heelTypes?.length) {
    const unknown = unknownValuesFor('heelTypes', input.heelTypes)
    if (unknown.length > 0) {
      fields.heelTypes = `Unknown value(s): ${unknown.join(', ')}. Allowed: ${allowedValuesFor('heelTypes').join(', ')}`
    } else {
      specs.heelTypes = input.heelTypes
    }
  }

  const knownColors = new Set(getAllColorSlugs())
  const requestedColors: string[] = []
  const unknownColors: string[] = []
  for (const raw of input.requestedColors ?? []) {
    const slug = resolveColorSlug(raw)
    if (!slug || !knownColors.has(slug)) unknownColors.push(raw)
    else requestedColors.push(slug)
  }
  if (unknownColors.length > 0) {
    fields.requestedColors = `Unknown colour(s): ${unknownColors.join(', ')}.`
  }

  const requestedSize =
    input.requestedSize === undefined ? undefined : normalizeSizeKey(String(input.requestedSize))
  if (input.requestedSize !== undefined && !requestedSize) {
    fields.requestedSize = 'Must be a shoe size, for example 39.'
  }

  if (input.minPrice !== undefined && input.maxPrice !== undefined && input.minPrice > input.maxPrice) {
    fields.minPrice = 'Must not be greater than maxPrice.'
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields }

  return {
    ok: true,
    request: {
      locale: input.locale ?? 'he',
      sourceProductId: input.sourceProductId,
      sourceSku: input.sourceSku,
      sourceProductUrl: input.sourceProductUrl,
      requestedSize,
      requestedColors: [...new Set(requestedColors)],
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      reason: input.reason ?? 'general_similarity',
      specs,
      maxHeelHeightCm: input.maxHeelHeightCm,
      categories: input.categories ?? [],
      limit: input.limit ?? 5,
    },
  }
}

