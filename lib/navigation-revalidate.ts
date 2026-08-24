import 'server-only'

import { revalidateTag, revalidatePath } from 'next/cache'

import { NAVIGATION_CATEGORIES_TAG } from '@/lib/navigation-categories'

/**
 * Flush the storefront navigation after a category mutation.
 *
 * Both calls are required and do different jobs:
 *
 *  - `revalidateTag` drops the cached Firestore read in
 *    lib/navigation-categories.server.ts.
 *  - `revalidatePath` evicts the prerendered HTML. The storefront layout is a
 *    root layout with generateStaticParams, so the nav markup is baked into the
 *    Full Route Cache; without this, visitors keep the old order until the
 *    route happens to be regenerated. `'/[lng]'` is the literal
 *    dynamic-segment form, and `'layout'` extends it to every route beneath.
 */
export function revalidateNavigationCategories(): void {
  // Next 16 requires a cache-life profile. 'max' purges outright rather than
  // letting a stale nav linger - category order is exactly the thing that must
  // not differ between two visitors.
  revalidateTag(NAVIGATION_CATEGORIES_TAG, 'max')
  revalidatePath('/[lng]', 'layout')
}
