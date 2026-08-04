import 'server-only'

/**
 * Order-reference matching for inbound carrier webhooks.
 *
 * We deliberately never rely on the carrier's own shipment number to identify an
 * order — we send our internal order number as the shipment reference and match on
 * that coming back.
 *
 * Order numbers are treated as **opaque unique strings**, never parsed. Two formats
 * exist in production: `ORDER-<epoch-ms>` (generated client-side in the cart) and
 * `SAKO-<epoch-ms>-<random>` (the server fallback in `lib/orders.ts`). Matching on a
 * prefix or extracting a timestamp would break on one of them.
 */

/** Prefixes used by synthetic test orders, which must never trigger automations. */
const TEST_ORDER_PREFIXES = ['TEST-', 'ORDER-TEST-']

export function isTestOrderNumber(orderNumber: string): boolean {
  return TEST_ORDER_PREFIXES.some((prefix) => orderNumber.startsWith(prefix))
}

/**
 * Picks the reference candidates worth attempting an order lookup with, in priority
 * order, after trimming and dropping test-order references.
 *
 * Returns every plausible candidate rather than just the first: HFD's PUSH payload is
 * undocumented, so if our order number turns up in `ref1` instead of `ref2` the
 * lookup should still succeed rather than silently reporting an unknown order.
 */
export function resolveReferenceCandidates(candidates: string[]): string[] {
  const seen = new Set<string>()
  const resolved: string[] = []

  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    if (isTestOrderNumber(trimmed)) continue
    resolved.push(trimmed)
  }

  return resolved
}
