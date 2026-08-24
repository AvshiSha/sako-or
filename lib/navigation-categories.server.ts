import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'

import { categoryService, type Category } from '@/lib/firebase'
import { sortCategories } from '@/lib/category-order'
import { NAVIGATION_CATEGORIES_TAG } from '@/lib/navigation-categories'
import type {
  NavSubCategory,
  NavCategory,
  NavigationCategoriesData,
} from '@/lib/navigation-categories'

export type { NavSubCategory, NavCategory, NavigationCategoriesData }
export { NAVIGATION_CATEGORIES_TAG }

function categorySlug(cat: Category): string {
  return typeof cat.slug === 'string' ? cat.slug : cat.slug?.en || ''
}

function categoryName(cat: Category, lng: 'en' | 'he'): string {
  if (typeof cat.name === 'string') return cat.name
  return (lng === 'he' ? cat.name?.he : cat.name?.en) || ''
}

async function buildGenderSubcategories(
  parentId: string,
  lng: 'en' | 'he'
): Promise<NavSubCategory[]> {
  // sortCategories, not the Firestore orderBy alone, decides the final order -
  // see lib/category-order.ts. It is locale-independent, so `he` and `en`
  // produce the same sequence and the RTL nav is a mirror of the LTR one.
  const subs = sortCategories(await categoryService.getEnabledSubCategories(parentId))

  return Promise.all(
    subs.map(async (sub) => {
      const subChildren = sortCategories(
        await categoryService.getEnabledSubCategories(sub.id!)
      )
      return {
        id: sub.id!,
        slug: categorySlug(sub),
        name: categoryName(sub, lng),
        subChildren: subChildren.map((child) => ({
          id: child.id!,
          slug: categorySlug(child),
          name: categoryName(child, lng),
        })),
      }
    })
  )
}

async function loadNavigationCategories(
  lng: 'en' | 'he'
): Promise<NavigationCategoriesData> {
  const navCategories = sortCategories(await categoryService.getNavigationCategories())

  const availableCategories: NavCategory[] = navCategories.map((cat) => ({
    id: cat.id!,
    slug: categorySlug(cat),
    name: categoryName(cat, lng),
    level: cat.level,
  }))

  const womenCategory = navCategories.find(
    (cat) => cat.level === 0 && categorySlug(cat).toLowerCase() === 'women'
  )
  const menCategory = navCategories.find(
    (cat) => cat.level === 0 && categorySlug(cat).toLowerCase() === 'men'
  )

  const [womenSubcategories, menSubcategories] = await Promise.all([
    womenCategory?.id ? buildGenderSubcategories(womenCategory.id, lng) : [],
    menCategory?.id ? buildGenderSubcategories(menCategory.id, lng) : [],
  ])

  return {
    availableCategories,
    womenSubcategories,
    menSubcategories,
  }
}

function createCachedNav(lng: 'en' | 'he') {
  return unstable_cache(() => loadNavigationCategories(lng), ['navigation-categories', 'v1', lng], {
    tags: [NAVIGATION_CATEGORIES_TAG],
    revalidate: 3600,
  })
}

// Built once per locale at module scope so the cache key is stable across
// requests rather than re-created on every call.
const cachedNavByLng = {
  en: createCachedNav('en'),
  he: createCachedNav('he'),
} as const

/**
 * The single source of navigation categories for the storefront.
 *
 * `unstable_cache` keeps this off Firestore on most requests and makes the tag
 * above the only freshness knob; `cache` dedupes it within a single render.
 * The nav is rendered from this data alone - there is deliberately no
 * client-side refetch, because a second snapshot taken at a different moment
 * is what used to make the category order change on tab focus.
 */
export const getServerNavigationCategories = cache(
  async (lng: 'en' | 'he'): Promise<NavigationCategoriesData> => cachedNavByLng[lng]()
)
