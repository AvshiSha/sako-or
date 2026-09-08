import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Product } from '@/lib/product-types'
import { isProductPurchasable } from '@/lib/chatbase/product-availability'
import { parseIdentifier, type IdentifyResult, type ProductIdentifier } from '@/lib/chatbase/product-identify'

/**
 * Firestore reads for the Chatbase product API.
 *
 * Kept apart from product-availability.ts on purpose: importing `db` from
 * lib/firebase initialises the Firebase client SDK at module load and throws
 * when NEXT_PUBLIC_FIREBASE_API_KEY is absent. Keeping the availability *rules*
 * free of that import is what lets them be unit-tested against fixtures with no
 * network and no credentials.
 */

/** Firestore caps an `in` filter at 30 values. */
const SKU_CHUNK_SIZE = 30

/**
 * Load candidate products from Firestore by SKU, in batches.
 *
 * Deleted and unpublished products are dropped here rather than returned and
 * filtered later, so no caller can accidentally surface one. A SKU that no
 * longer exists is simply absent from the map.
 */
export async function loadProductsBySkus(skus: string[]): Promise<Map<string, Product>> {
  const unique = [...new Set(skus.filter(Boolean))]
  const found: Map<string, Product> = new Map()
  if (unique.length === 0) return found

  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += SKU_CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + SKU_CHUNK_SIZE))
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) => getDocs(query(collection(db, 'products'), where('sku', 'in', chunk))))
  )

  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      const data = document.data()
      const product = {
        id: document.id,
        ...data,
        colorVariants: data.colorVariants || {},
      } as Product
      if (!isProductPurchasable(product)) continue
      if (product.sku) found.set(product.sku, product)
    }
  }

  return found
}

/**
 * Look a product up by exact SKU.
 *
 * Unpublished and deleted products resolve to `not_found`, never to "exists but
 * hidden": whether a hidden product exists is not something a customer-facing
 * bot should be able to probe.
 */
export async function identifyProduct(
  identifier: ProductIdentifier
): Promise<IdentifyResult> {
  const parsed = parseIdentifier(identifier)
  if (!parsed?.sku) return { status: 'not_found' }

  const snapshot = await getDocs(
    query(collection(db, 'products'), where('sku', '==', parsed.sku))
  )

  const products = snapshot.docs
    .map((document) => {
      const data = document.data()
      return { id: document.id, ...data, colorVariants: data.colorVariants || {} } as Product
    })
    .filter(isProductPurchasable)

  if (products.length === 0) return { status: 'not_found' }

  if (products.length > 1) {
    // Two live products on one SKU is a data fault, not a customer question to
    // answer by picking one.
    return {
      status: 'ambiguous',
      candidates: products.map((product) => ({
        sku: product.sku,
        title: product.shortTitle_he || product.shortTitle_en || product.sku,
      })),
    }
  }

  return { status: 'found', product: products[0], colorSlug: parsed.colorSlug }
}
