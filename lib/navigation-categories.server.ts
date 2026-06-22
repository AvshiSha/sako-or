import 'server-only'

import { categoryService, type Category } from '@/lib/firebase'
import type {
  NavSubCategory,
  NavCategory,
  NavigationCategoriesData,
} from '@/lib/navigation-categories'

export type { NavSubCategory, NavCategory, NavigationCategoriesData }

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
  const subs = await categoryService.getSubCategories(parentId)

  return Promise.all(
    subs.map(async (sub) => {
      const subChildren = await categoryService.getSubCategories(sub.id!)
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

export async function getServerNavigationCategories(
  lng: 'en' | 'he'
): Promise<NavigationCategoriesData> {
  const navCategories = await categoryService.getNavigationCategories()

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
