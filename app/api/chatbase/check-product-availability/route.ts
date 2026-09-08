import { ChatbaseRequestError, withChatbaseRoute } from '@/lib/chatbase/api-response'
import {
  checkProductAvailability,
  validateCheckAvailabilityRequest,
} from '@/lib/chatbase/check-availability'

/**
 * POST /api/chatbase/check-product-availability
 *
 * Answers "is this exact product, in this colour and size, buyable right now"
 * from the same rules the checkout applies.
 *
 * Identification is exact: a partial or fuzzy SKU never resolves, because
 * answering a stock question about the wrong shoe is worse than saying we are
 * not sure. When a colour is missing the response asks for it rather than
 * guessing, and when the combination is unavailable it reports the sizes in
 * that colour and the colours in that size separately - never one as evidence
 * for the other.
 *
 * Stock quantities are never returned, and an unpublished product is reported
 * as not found rather than as hidden.
 *
 * Read-only. A 4xx or 5xx means "unknown", never "unavailable".
 */

// Firestore client SDK, node:crypto and raw Prisma - not edge-safe.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withChatbaseRoute('check_product_availability', async (body, context) => {
  const validation = validateCheckAvailabilityRequest(body)
  if (!validation.ok) {
    throw new ChatbaseRequestError('INVALID_REQUEST', validation.fields)
  }

  const result = await checkProductAvailability(validation.request)
  context.setResultCount(result.found ? 1 : 0)
  return result
})
