import 'server-only'
import { adminDb } from '@/lib/firebase-admin'
import type { Product } from '@/lib/product-types'

const COLLECTION = 'productDrafts'

export interface ProductDraft {
  draftId: string
  payload: Product
  sourceProductId: string | null
  createdBy: string
  updatedAt: number
}

export interface UpsertProductDraftInput {
  draftId?: string | null
  sourceProductId?: string | null
  payload: Record<string, unknown>
  createdBy: string
}

/**
 * Drafts live in their own, isolated Firestore collection — never queried by
 * any storefront/public code path (collections, search, sitemap, feeds), so
 * a draft can never leak regardless of its `isEnabled`/`isDeleted` flags.
 * Only touched here, server-side, via the Admin SDK (bypasses firestore.rules).
 */
export async function upsertProductDraft(input: UpsertProductDraftInput): Promise<string> {
  const draftId = input.draftId || input.sourceProductId || adminDb.collection(COLLECTION).doc().id

  await adminDb
    .collection(COLLECTION)
    .doc(draftId)
    .set(
      {
        payload: input.payload,
        sourceProductId: input.sourceProductId ?? null,
        createdBy: input.createdBy,
        updatedAt: Date.now(),
      },
      { merge: false }
    )

  return draftId
}

export async function getProductDraft(draftId: string): Promise<ProductDraft | null> {
  const snap = await adminDb.collection(COLLECTION).doc(draftId).get()
  if (!snap.exists) return null

  const data = snap.data() as { payload: Product; sourceProductId: string | null; createdBy: string; updatedAt: number }
  return {
    draftId,
    payload: data.payload,
    sourceProductId: data.sourceProductId ?? null,
    createdBy: data.createdBy,
    updatedAt: data.updatedAt,
  }
}
