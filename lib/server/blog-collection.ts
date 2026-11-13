import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import { listCategoriesAdmin, type CategoryRecord } from '@/lib/server/category-seo-mutations'
import { categoryPublicUrl } from '@/lib/mcp/urls'
import type { RelatedProductsCarouselConfig } from '@/lib/firebase'

/**
 * Resolving the product collection attached to a blog article.
 *
 * The storefront renders that section from `relatedProductsCarousel.categoryIds`
 * (see lib/blog-related-products.ts), and that field is not a category id --
 * it is the whole ancestor chain, level 0 first. `getFilteredProducts` matches
 * it as a *prefix* of each product's `categories_path_id`, so
 * `[bootsId]` on its own selects nothing at all: the chain has to read
 * `[womenId, shoesId, bootsId]` or no product's path lines up with it.
 *
 * That is the one piece a caller cannot supply correctly on its own, and it is
 * why the MCP tools take a single `collectionId` and expand it here rather than
 * accepting a raw array. Everything else about the carousel -- how products are
 * chosen, how many, how they are rendered -- is the existing model, untouched.
 *
 * Nothing in this file writes. Categories and products are read; the only
 * document any caller of this module writes is the blog article itself.
 */

const PRODUCTS_COLLECTION = 'products'

/** Matches CANDIDATE_POOL_SIZE in lib/blog-related-products.ts. */
export const COLLECTION_PREVIEW_POOL = 50

/** Matches DEFAULT_MAX_PRODUCTS in lib/blog-related-products.ts. */
export const DEFAULT_MAX_PRODUCTS = 8

/** women / women-shoes / women-shoes-boots. Deeper than this does not exist. */
const MAX_DEPTH = 3

export interface ProductCollection {
  /** The category this article points at: the deepest link in the chain. */
  collectionId: string
  /**
   * The ancestor chain, level 0 first, exactly as it is stored in
   * `relatedProductsCarousel.categoryIds` and as the product query expects it.
   */
  categoryIds: string[]
  path: string
  level: number
  /** The collection's own name, per locale. */
  title: { he: string; en: string }
  /** The full chain as a reading line, per locale: "נשים / נעליים / מגפיים". */
  breadcrumb: { he: string; en: string }
  /** Where a visitor lands, per locale. The path segment is shared; only the prefix differs. */
  urls: { he: string; en: string }
}

export class CollectionResolutionError extends Error {
  constructor(
    readonly reason: 'not_found' | 'disabled' | 'broken_chain',
    message: string
  ) {
    super(message)
    this.name = 'CollectionResolutionError'
  }
}

function localized(value: unknown): { he: string; en: string } {
  const pair = (value ?? {}) as { he?: unknown; en?: unknown }
  return {
    he: typeof pair.he === 'string' ? pair.he : '',
    en: typeof pair.en === 'string' ? pair.en : '',
  }
}

/**
 * Build the view of one category, given the chain that leads to it.
 *
 * Both locales are filled on every result rather than one being selected here.
 * The association itself is language-neutral -- a single `categoryIds` array
 * serves both /he and /en, and the storefront resolves names and product copy
 * from the visitor's locale at render time -- so a tool that returned one
 * language would be inventing a choice the data model does not make.
 */
function toProductCollection(chain: CategoryRecord[]): ProductCollection {
  const leaf = chain[chain.length - 1]
  const path = String(leaf.path ?? '')
  const names = chain.map((c) => localized(c.name))

  return {
    collectionId: leaf.id,
    categoryIds: chain.map((c) => c.id),
    path,
    level: typeof leaf.level === 'number' ? leaf.level : chain.length - 1,
    title: localized(leaf.name),
    breadcrumb: {
      he: names.map((n) => n.he || n.en).join(' / '),
      en: names.map((n) => n.en || n.he).join(' / '),
    },
    urls: {
      he: categoryPublicUrl(path, 'he'),
      en: categoryPublicUrl(path, 'en'),
    },
  }
}

/**
 * Walk a category up to its level-0 ancestor.
 *
 * Returns the chain root-first. A category whose parent is missing or disabled
 * is refused rather than silently truncated: a short chain is still a *valid*
 * query, it just selects a wider set of products than the editor asked for, and
 * quietly widening a merchandising selection is worse than failing.
 */
function buildChain(
  leaf: CategoryRecord,
  byId: Map<string, CategoryRecord>
): CategoryRecord[] {
  const chain: CategoryRecord[] = [leaf]
  let cursor = leaf

  while (chain.length <= MAX_DEPTH) {
    const parentId = typeof cursor.parentId === 'string' ? cursor.parentId.trim() : ''
    if (!parentId) break

    const parent = byId.get(parentId)
    if (!parent) {
      throw new CollectionResolutionError(
        'broken_chain',
        `Collection "${leaf.path ?? leaf.id}" references a parent category (${parentId}) that ` +
          'does not exist, so the product query for it cannot be built. This is a data problem ' +
          'in the category tree, not something to work around — report it rather than picking ' +
          'a different collection.'
      )
    }
    if (parent.isEnabled === false) {
      throw new CollectionResolutionError(
        'disabled',
        `Collection "${leaf.path ?? leaf.id}" sits under "${parent.path ?? parent.id}", which is ` +
          'disabled. Products under a disabled branch are not shown on the site, so the article ' +
          'section would render empty.'
      )
    }

    chain.unshift(parent)
    cursor = parent
  }

  return chain
}

/**
 * Resolve one collection id into everything the association needs.
 *
 * Throws CollectionResolutionError for an id that is unusable, so the MCP layer
 * can report *why* rather than returning an empty selection the editor would
 * have to diagnose from a blank section on the page.
 */
export async function resolveProductCollection(
  collectionId: string,
  categories?: CategoryRecord[]
): Promise<ProductCollection> {
  const all = categories ?? (await listCategoriesAdmin())
  const byId = new Map(all.map((c) => [c.id, c]))

  const leaf = byId.get(collectionId)
  if (!leaf) {
    throw new CollectionResolutionError(
      'not_found',
      `No product collection with id "${collectionId}". Use list_product_collections to find ` +
        'the right id — collection ids are not guessable and are not the slug from the URL.'
    )
  }
  if (leaf.isEnabled === false) {
    throw new CollectionResolutionError(
      'disabled',
      `The collection "${leaf.path ?? collectionId}" is disabled, so it has no live page and no ` +
        'products to show. Pick an enabled collection.'
    )
  }

  return toProductCollection(buildChain(leaf, byId))
}

/**
 * Every collection an article may be pointed at, newest naming first.
 *
 * Disabled categories and categories under a disabled branch are left out: they
 * are not eligible, and listing them would only produce a refusal one call
 * later. Matching is a case-insensitive substring over both names and the path,
 * the same rule search_content uses, because the editor works in Hebrew and the
 * paths are latin.
 */
export async function listProductCollections(options: {
  query?: string
  limit?: number
}): Promise<ProductCollection[]> {
  const all = await listCategoriesAdmin()
  const byId = new Map(all.map((c) => [c.id, c]))
  const needle = (options.query ?? '').trim().toLowerCase()
  const limit = options.limit ?? 100

  const results: ProductCollection[] = []

  for (const category of all) {
    if (category.isEnabled === false) continue

    const name = localized(category.name)
    const path = String(category.path ?? '')
    if (
      needle &&
      ![name.he, name.en, path].some((value) => value.toLowerCase().includes(needle))
    ) {
      continue
    }

    try {
      results.push(toProductCollection(buildChain(category, byId)))
    } catch {
      // A category whose ancestry is disabled or broken is not eligible. It is
      // skipped here rather than surfaced, because this is a browse list -- the
      // explanatory error belongs to resolveProductCollection, where somebody
      // actually asked for that specific id.
      continue
    }

    if (results.length >= limit) break
  }

  return results.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * How many live products the article's section would actually draw from.
 *
 * Deliberately mirrors lib/blog-related-products.ts rather than counting with
 * an aggregation query: the storefront narrows by `array-contains` on the
 * deepest id and *then* verifies the whole chain is a prefix of each product's
 * path, so a count that skipped the second half would promise cards that never
 * render. Capped at the same candidate pool the storefront reads, which is why
 * `capped` is reported alongside.
 *
 * Only a count comes back. No product id, name, price or stock level crosses
 * this boundary -- this answers "will the section be empty?" and nothing else.
 */
export async function countCollectionProducts(
  categoryIds: string[]
): Promise<{ count: number; capped: boolean }> {
  if (categoryIds.length === 0) return { count: 0, capped: false }

  const leafId = categoryIds[categoryIds.length - 1]
  const snapshot = await adminDb
    .collection(PRODUCTS_COLLECTION)
    .where('isEnabled', '==', true)
    .where('isDeleted', '==', false)
    .where('categories_path_id', 'array-contains', leafId)
    .limit(COLLECTION_PREVIEW_POOL)
    .get()

  let count = 0
  for (const doc of snapshot.docs) {
    const productPath = doc.data().categories_path_id
    if (!Array.isArray(productPath) || productPath.length < categoryIds.length) continue
    if (categoryIds.every((id, index) => productPath[index] === id)) count++
  }

  return { count, capped: snapshot.size >= COLLECTION_PREVIEW_POOL }
}

/**
 * The stored carousel config as the MCP tools describe it.
 *
 * Returns null when there is no usable selection -- absent, toggled off, or
 * pointing nowhere. All three mean the same thing on the page (no section), so
 * collapsing them into one value is what lets a caller round-trip the field:
 * read null, write null, read null.
 */
export async function describeStoredCollection(
  config: RelatedProductsCarouselConfig | undefined
): Promise<(ProductCollection & { maxProducts: number }) | null> {
  if (!config?.enabled) return null
  if (!Array.isArray(config.categoryIds) || config.categoryIds.length === 0) return null

  const leafId = config.categoryIds[config.categoryIds.length - 1]

  try {
    const resolved = await resolveProductCollection(leafId)
    return {
      ...resolved,
      maxProducts: config.maxProducts > 0 ? config.maxProducts : DEFAULT_MAX_PRODUCTS,
    }
  } catch {
    // The association points at a category that has since been deleted or
    // disabled. The article still stores it, and the page still renders nothing,
    // so the honest answer to "what is selected?" is null -- not an error that
    // would block an unrelated edit to the same article.
    return null
  }
}
