/**
 * The single authoritative ordering rule for categories.
 *
 * Every surface that renders categories - storefront navigation, the admin
 * category tree, the reorder and normalize endpoints - must run its sibling
 * lists through `sortCategories` so that admin order and storefront order can
 * never drift apart.
 *
 * Why sort in application code when the Firestore queries already carry
 * `orderBy('sortOrder', 'asc')`:
 *
 *  - Firestore cannot express the `sortOrder -> name -> id` tiebreak chain
 *    without adding `name.en` to every composite index.
 *  - An `orderBy` on a field silently EXCLUDES documents that lack it, so
 *    pushing more of the ordering into Firestore makes a missing field worse,
 *    not better. Sorting here keeps every document visible.
 *  - The admin tree reads the whole collection at once and has no per-parent
 *    query to hang an `orderBy` on, so it needs an in-memory comparator anyway.
 *
 * The Firestore `orderBy` stays as a cheap pre-sort that the existing indexes
 * already serve; this comparator is what is authoritative.
 */

export type OrderableCategory = {
  id?: string
  sortOrder?: number | null
  name?: { en?: string; he?: string } | string | null
}

/**
 * Missing or non-finite `sortOrder` sinks to the end deterministically rather
 * than colliding at 0 with everything else, so a category that never had the
 * field set cannot displace ones that did.
 */
export function categorySortKey(cat: OrderableCategory): number {
  const raw = cat?.sortOrder
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : Number.POSITIVE_INFINITY
}

/**
 * The English name is the tiebreak, not the localized one: order must be
 * byte-identical for `he` and `en` so the RTL nav is a mirror of the LTR nav
 * rather than a differently-ordered list.
 */
function categoryTiebreakName(cat: OrderableCategory): string {
  const name = cat?.name
  if (typeof name === 'string') return name
  return name?.en ?? ''
}

/**
 * Deliberately NOT `String.prototype.localeCompare`. Its result depends on the
 * ICU data and default locale of the runtime, so Node on the server and a
 * user's browser can legitimately disagree - which would reintroduce the exact
 * server/client ordering divergence this module exists to remove. Plain code
 * unit comparison is the same everywhere.
 */
function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function compareCategories(a: OrderableCategory, b: OrderableCategory): number {
  // Compared rather than subtracted: two missing sortOrders are both
  // +Infinity, and Infinity - Infinity is NaN, which would corrupt the sort.
  const keyA = categorySortKey(a)
  const keyB = categorySortKey(b)
  if (keyA !== keyB) return keyA < keyB ? -1 : 1

  const nameDelta = compareCodeUnits(categoryTiebreakName(a), categoryTiebreakName(b))
  if (nameDelta !== 0) return nameDelta

  // Document ids are unique, so this makes the comparator total - no pair can
  // ever tie. It also matches Firestore's own implicit `__name__` tiebreak, so
  // the in-memory order agrees with the order the documents arrived in.
  return compareCodeUnits(a?.id ?? '', b?.id ?? '')
}

/** Returns a new array; never mutates the input. */
export function sortCategories<T extends OrderableCategory>(cats: readonly T[]): T[] {
  return [...cats].sort(compareCategories)
}
