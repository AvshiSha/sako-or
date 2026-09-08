import { ChatbaseRequestError, withChatbaseRoute } from '@/lib/chatbase/api-response'
import { validateSearchRequest } from '@/lib/chatbase/search-shoes-schema'
import { searchShoes } from '@/lib/chatbase/search-shoes'

/**
 * POST /api/chatbase/search-shoes
 *
 * Searches the footwear catalogue by structured requirements and returns only
 * products the customer can actually buy in the colour and size they asked for.
 *
 * Availability is checked at product + colour + size on one variant: a black
 * variant and a size-39 variant do not between them make "black in 39"
 * available. A missing specification never counts as a match, and unknown
 * filter values are rejected rather than dropped, because dropping one would
 * widen the search past what the customer asked for.
 *
 * Read-only. It writes nothing and touches no customer data.
 *
 * A 4xx or 5xx means "unknown", never "unavailable" - the agent must not
 * present products, or claim we have none, unless it got a 200.
 */

// Firestore client SDK, node:crypto and raw Prisma - not edge-safe.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withChatbaseRoute('search_shoes', async (body, context) => {
  const validation = validateSearchRequest(body)
  if (!validation.ok) {
    throw new ChatbaseRequestError('INVALID_REQUEST', validation.fields)
  }

  const result = await searchShoes(validation.request)
  context.setResultCount(result.totalMatches)
  return result
})
