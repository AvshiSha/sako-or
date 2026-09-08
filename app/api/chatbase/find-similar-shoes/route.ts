import { ChatbaseRequestError, withChatbaseRoute } from '@/lib/chatbase/api-response'
import { findSimilarShoes, validateFindSimilarRequest } from '@/lib/chatbase/find-similar'

/**
 * POST /api/chatbase/find-similar-shoes
 *
 * Finds purchasable alternatives to a product the customer already has in mind.
 *
 * The source product establishes what "similar" means; `reason` establishes what
 * is non-negotiable. Requirements are applied as hard filters before anything is
 * scored, so a closer lookalike can never outrank a shoe that actually meets the
 * need - a prettier match that does not come in size 39 is not an answer to "do
 * you have this in 39".
 *
 * The source product is never returned as its own alternative, and each product
 * appears once rather than once per colour.
 *
 * Read-only. A 4xx or 5xx means "unknown", never "no alternatives".
 */

// Firestore client SDK, node:crypto and raw Prisma - not edge-safe.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withChatbaseRoute('find_similar_shoes', async (body, context) => {
  const validation = validateFindSimilarRequest(body)
  if (!validation.ok) {
    throw new ChatbaseRequestError('INVALID_REQUEST', validation.fields)
  }

  const result = await findSimilarShoes(validation.request)
  context.setResultCount(result.totalMatches)
  return result
})
