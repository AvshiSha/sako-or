import { z } from 'zod'
import { zodErrorsToFieldMap } from '@/lib/schemas/product-schema'
import { getAllColorSlugs } from '@/lib/colors'
import { normalizeSizeKey } from '@/lib/product-size'
import { resolveColorSlug } from '@/lib/chatbase/collection-catalog'
import type { PublicColor } from '@/lib/chatbase/product-presenter'
import { sanitizeRequestBody } from '@/lib/chatbase/search-shoes-schema'

/**
 * check_product_availability: can the customer buy this exact product, in this
 * exact colour, in this exact size, right now.
 *
 * Every answer comes from product-availability.ts, the same rules the checkout
 * applies. Quantities never leave the building - only which sizes and colours
 * exist, which is all a customer needs and all a bot should be able to enumerate.
 */

export const checkAvailabilitySchema = z
  .object({
    locale: z.enum(['he', 'en']).optional(),
    productId: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(1).optional(),
    productUrl: z.string().trim().min(1).optional(),
    color: z.string().trim().min(1).optional(),
    size: z.union([z.number(), z.string().trim().min(1)]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.productId && !value.sku && !value.productUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sku'],
        message: 'Provide one of productId, sku or productUrl.',
      })
    }
  })

export type CheckAvailabilityRequest = {
  locale: 'he' | 'en'
  productId?: string
  sku?: string
  productUrl?: string
  color?: string
  size?: string
}

export type CheckAvailabilityResult =
  | {
      found: false
      available: false
      message: string
    }
  | {
      found: true
      ambiguous: true
      candidates: Array<{ sku: string; title: string }>
      message: string
    }
  | {
      found: true
      requiresClarification: true
      missingParameters: string[]
      sku: string
      title: string
      availableColors: PublicColor[]
      availableSizes: string[]
      url: string
    }
  | {
      found: true
      available: boolean
      sku: string
      title: string
      color: PublicColor
      size: string | null
      price: number
      originalPrice: number | null
      currency: string
      url: string
      /** Present only when the exact combination is unavailable. */
      availableSizesInRequestedColor?: string[]
      availableColorsInRequestedSize?: PublicColor[]
      canSearchForAlternatives?: boolean
    }

export type ValidationOutcome =
  | { ok: true; request: CheckAvailabilityRequest }
  | { ok: false; fields: Record<string, string> }

export function validateCheckAvailabilityRequest(body: unknown): ValidationOutcome {
  const normalized =
    body && typeof body === 'object' && !Array.isArray(body)
      ? sanitizeRequestBody(body as Record<string, unknown>)
      : body

  const parsed = checkAvailabilitySchema.safeParse(normalized)
  if (!parsed.success) {
    return { ok: false, fields: zodErrorsToFieldMap(parsed.error) }
  }

  const input = parsed.data
  const fields: Record<string, string> = {}

  let color: string | undefined
  if (input.color !== undefined) {
    const slug = resolveColorSlug(input.color)
    if (!slug || !getAllColorSlugs().includes(slug)) {
      fields.color = `Unknown colour: ${input.color}.`
    } else {
      color = slug
    }
  }

  const size = input.size === undefined ? undefined : normalizeSizeKey(String(input.size))
  if (input.size !== undefined && !size) {
    fields.size = 'Must be a shoe size, for example 39.'
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields }

  return {
    ok: true,
    request: {
      locale: input.locale ?? 'he',
      productId: input.productId,
      sku: input.sku,
      productUrl: input.productUrl,
      color,
      size,
    },
  }
}

