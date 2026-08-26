/**
 * FAQ ordering: dense per-audience `order` values and reorder validation.
 *
 * The invariant is that every audience group holds a dense 0..n-1 sequence over
 * ALL of its items regardless of status. Ordering over published items only
 * would leave gaps the moment a question is hidden, and those gaps then decide
 * where a newly published question lands — which is the bug this file exists to
 * prevent. Mirrors the reasoning in lib/category-order.ts.
 */

import type { FaqAudience, FaqItem } from './faq-types';
import { FAQ_AUDIENCES } from './faq-types';

/** Minimum shape the ordering helpers need — keeps them usable from tests and seeds. */
export interface OrderableFaq {
  id: string;
  audience: FaqAudience;
  order?: number | null;
  slug?: string;
}

/**
 * Sort key for a single item. Missing / NaN sinks to the end rather than to 0,
 * so a record written before this field existed never jumps to the top.
 */
export function faqOrderKey(item: Pick<OrderableFaq, 'order'>): number {
  const value = item.order;
  if (typeof value !== 'number' || !Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return value;
}

/**
 * Total comparator within one audience group. Falls back to slug then id so two
 * items sharing an order value never compare equal — an unstable tie would let
 * Firestore's arbitrary document order leak into the rendered page.
 */
export function compareFaqs(a: OrderableFaq, b: OrderableFaq): number {
  // Compared, not subtracted: Infinity - Infinity is NaN, which sort() reads as
  // "equal" and would drop the tie-breakers below.
  const keyA = faqOrderKey(a);
  const keyB = faqOrderKey(b);
  if (keyA !== keyB) return keyA < keyB ? -1 : 1;

  const slugA = a.slug ?? '';
  const slugB = b.slug ?? '';
  if (slugA !== slugB) return slugA < slugB ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** Stable sort within a single group. Does not mutate the input. */
export function sortFaqs<T extends OrderableFaq>(items: readonly T[]): T[] {
  return [...items].sort(compareFaqs);
}

/**
 * Group items by audience, each group sorted, in the public section order.
 * Every audience key is present even when empty, so callers can decide whether
 * to render an empty section rather than having to guard for a missing key.
 */
export function groupFaqsByAudience<T extends OrderableFaq>(
  items: readonly T[]
): Record<FaqAudience, T[]> {
  const grouped = {} as Record<FaqAudience, T[]>;
  for (const audience of FAQ_AUDIENCES) grouped[audience] = [];
  for (const item of items) {
    // An unknown audience value (hand-edited doc) would otherwise throw on push.
    if (grouped[item.audience]) grouped[item.audience].push(item);
  }
  for (const audience of FAQ_AUDIENCES) grouped[audience] = sortFaqs(grouped[audience]);
  return grouped;
}

/** The order value a newly created question should take within its audience. */
export function nextOrderForAudience(
  items: readonly OrderableFaq[],
  audience: FaqAudience
): number {
  const inGroup = items.filter((item) => item.audience === audience);
  if (inGroup.length === 0) return 0;
  const maxOrder = inGroup.reduce((max, item) => {
    const key = faqOrderKey(item);
    return Number.isFinite(key) && key > max ? key : max;
  }, -1);
  // Length is the floor: it keeps the sequence dense even when every existing
  // item has a missing/infinite order.
  return Math.max(maxOrder + 1, inGroup.length);
}

/**
 * Re-number one audience group to a dense 0..n-1, preserving current relative
 * order. Returns only the items whose value actually changes, so the caller
 * writes the minimum number of documents.
 */
export function densifyFaqOrder(
  items: readonly OrderableFaq[],
  audience: FaqAudience
): Array<{ id: string; order: number }> {
  const sorted = sortFaqs(items.filter((item) => item.audience === audience));
  const updates: Array<{ id: string; order: number }> = [];
  sorted.forEach((item, index) => {
    if (item.order !== index) updates.push({ id: item.id, order: index });
  });
  return updates;
}

/** Dense 0..n-1 assignments for an explicit id sequence (the reorder payload). */
export function orderUpdatesFromSequence(orderedIds: readonly string[]): Array<{
  id: string;
  order: number;
}> {
  return orderedIds.map((id, order) => ({ id, order }));
}

export interface ReorderMembershipResult {
  valid: boolean;
  /** Ids that exist in the group but are absent from the submitted list. */
  missing: string[];
  /** Submitted ids that are not in the group. */
  unknown: string[];
  /** Ids submitted more than once. */
  duplicates: string[];
}

/**
 * Verify that a reorder payload is exactly the current membership of the group.
 *
 * Deliberately no reconciliation: a mismatch means the admin's list was built
 * from stale data (someone else added or deleted a question), and silently
 * merging would drop or resurrect an item. The route answers 409 and the UI
 * refetches — same contract as app/api/admin/categories/reorder.
 */
export function validateReorderMembership(
  currentIds: readonly string[],
  requestedIds: readonly string[]
): ReorderMembershipResult {
  const current = new Set(currentIds);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const unknown: string[] = [];

  for (const id of requestedIds) {
    if (seen.has(id)) {
      if (!duplicates.includes(id)) duplicates.push(id);
      continue;
    }
    seen.add(id);
    if (!current.has(id)) unknown.push(id);
  }

  const missing = currentIds.filter((id) => !seen.has(id));

  return {
    valid: missing.length === 0 && unknown.length === 0 && duplicates.length === 0,
    missing,
    unknown,
    duplicates,
  };
}

/**
 * Order updates required after removing an item from a group — used by DELETE
 * and by an audience change (call once per affected audience).
 */
export function reorderAfterRemoval(
  items: readonly OrderableFaq[],
  audience: FaqAudience,
  removedId: string
): Array<{ id: string; order: number }> {
  return densifyFaqOrder(
    items.filter((item) => item.id !== removedId),
    audience
  );
}

/** Convenience wrapper: the two densify passes an audience change requires. */
export function reorderAfterAudienceChange(
  items: readonly FaqItem[],
  movedId: string,
  fromAudience: FaqAudience,
  toAudience: FaqAudience
): Array<{ id: string; order: number }> {
  if (fromAudience === toAudience) return [];

  const withoutMoved = items.filter((item) => item.id !== movedId);
  const moved = items.find((item) => item.id === movedId);

  const updates = densifyFaqOrder(withoutMoved, fromAudience);

  // The moved item goes to the end of its new group.
  const targetOrder = nextOrderForAudience(withoutMoved, toAudience);
  if (moved) updates.push({ id: movedId, order: targetOrder });

  return updates;
}
