import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import type { Category } from '@/lib/firebase'

/**
 * Server-side writes to the editorial/SEO fields of an existing category.
 *
 * Narrow on purpose. The admin category editor writes the whole document from
 * the browser (app/(unlocalized)/admin/categories/page.tsx), including
 * structure, visibility and ordering. This path can only ever touch the six
 * editorial fields, and it cannot create or delete a category at all -- a
 * category that does not exist is an error, not something to create.
 *
 * The update is a field-level merge, so the Neon mirror, the merchandising
 * document and the banners document are all untouched. That matters: the mirror
 * is matched by `name_en` (see lib/category-mutations.ts), so a write that
 * could change `name` would silently break the join. `name` is not writable
 * here, and `slug`, `path`, `parentId`, `level`, `isEnabled` and `sortOrder`
 * are not either.
 */

const CATEGORIES_COLLECTION = 'categories'

export interface CategoryRecord extends Category {
  id: string
}

export async function getCategoryAdmin(id: string): Promise<CategoryRecord | null> {
  const snap = await adminDb.collection(CATEGORIES_COLLECTION).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() } as CategoryRecord
}

export async function getCategoryRawAdmin(id: string): Promise<Record<string, unknown> | null> {
  const snap = await adminDb.collection(CATEGORIES_COLLECTION).doc(id).get()
  if (!snap.exists) return null
  return snap.data() ?? null
}

/**
 * Every category, for search.
 *
 * Reads the whole collection rather than paging it. There are on the order of a
 * hundred categories across three levels and the existing navigation loader
 * already does the same, so the cost is a known quantity -- and search needs to
 * match on Hebrew and English names, which Firestore cannot do server-side
 * anyway.
 */
export async function listCategoriesAdmin(): Promise<CategoryRecord[]> {
  const snapshot = await adminDb.collection(CATEGORIES_COLLECTION).get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CategoryRecord)
}

export type CategoryUpdateOutcome =
  | { ok: true; updatedAt: string }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'conflict'; currentUpdatedAt: string }

/**
 * Merge editorial fields into an existing category.
 *
 * `updatedAt` on a category is a Firestore Date rather than the ISO string the
 * blog model uses, so the conflict token is normalized to an ISO string on both
 * sides of the comparison instead of assuming one representation.
 *
 * Unlike the blog path, `expectedUpdatedAt` is optional here. A category's
 * editorial block is a single field a specialist owns end to end, not a
 * document two people edit in the same hour, and requiring a token for a
 * one-field meta-description fix would mean a mandatory extra round trip for
 * every call. When a token is supplied it is enforced exactly as strictly.
 */
export async function updateCategorySeoAdmin(
  id: string,
  fields: Record<string, unknown>,
  options: { expectedUpdatedAt?: string; actor: string }
): Promise<CategoryUpdateOutcome> {
  const ref = adminDb.collection(CATEGORIES_COLLECTION).doc(id)

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { ok: false as const, reason: 'not_found' as const }

    const current = snap.data() ?? {}
    const currentUpdatedAt = toIsoString(current.updatedAt)

    if (options.expectedUpdatedAt && currentUpdatedAt !== options.expectedUpdatedAt) {
      return { ok: false as const, reason: 'conflict' as const, currentUpdatedAt }
    }

    const updatedAt = new Date()
    tx.update(ref, {
      ...fields,
      updatedAt,
      // Separate from the blog model's `updatedBy`: the Category interface has
      // no such field, so naming it distinctly keeps it obvious that this is
      // provenance added by the MCP path and not part of the original model.
      seoUpdatedBy: options.actor,
      seoUpdatedVia: 'mcp',
    })
    return { ok: true as const, updatedAt: updatedAt.toISOString() }
  })
}

/**
 * Normalize whatever Firestore handed back for a timestamp.
 *
 * Categories are written from two places with two representations -- the admin
 * form sends a JS Date through the client SDK, and `serverTimestamp` would come
 * back as a Firestore Timestamp. Comparing those as-is would report a false
 * conflict on every call, so both collapse to an ISO string here.
 */
export function toIsoString(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = (value as { toDate: () => Date }).toDate
    if (typeof maybe === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString()
      } catch {
        return ''
      }
    }
  }
  return ''
}
