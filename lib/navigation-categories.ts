/**
 * Revalidation tag for the storefront navigation. Any mutation that can change
 * which categories appear in the nav, or in what order, must revalidate it -
 * see revalidateNavigationCategories() in lib/navigation-revalidate.ts.
 *
 * Lives in this dependency-free module so API routes can import it without
 * pulling in the Firebase client SDK.
 */
export const NAVIGATION_CATEGORIES_TAG = 'navigation-categories'

export type NavSubCategory = {
  id: string
  slug: string
  name: string
  subChildren?: Array<{ id: string; slug: string; name: string }>
}

export type NavCategory = {
  id: string
  slug: string
  name: string
  level: number
}

export type NavigationCategoriesData = {
  availableCategories: NavCategory[]
  womenSubcategories: NavSubCategory[]
  menSubcategories: NavSubCategory[]
}
