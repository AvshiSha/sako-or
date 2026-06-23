import 'server-only'

import { unstable_cache } from 'next/cache'

import { categoryService, type Category } from '@/lib/firebase'
import { getImageUrl } from '@/lib/image-urls'

export const HOME_SHOE_CATEGORY_PATHS = [
  'women/shoes/sandals',
  'women/shoes/sneakers',
  'women/shoes/pumps',
  'women/shoes/low-boots',
  'women/shoes/slippers',
  'women/shoes/platform-loafers',
  'women/shoes/oxford',
  'women/shoes/moccasin',
] as const

export type HomeShoeCategoryPath = (typeof HOME_SHOE_CATEGORY_PATHS)[number]

export interface HomeShoeCategory {
  id: string
  name: string
  image: string
  href: string
  path: string
}

const CATEGORY_FALLBACK_IMAGES: Record<HomeShoeCategoryPath, string> = {
  'women/shoes/sandals': getImageUrl('sako-women-sandals.jpg'),
  'women/shoes/sneakers': getImageUrl('sako-women-sneakers.webp'),
  'women/shoes/pumps': getImageUrl('sako-women-high-heels.jpg'),
  'women/shoes/low-boots': getImageUrl('low-boots.jpg'),
  'women/shoes/slippers': getImageUrl('sako-women-slippers.jpg'),
  'women/shoes/platform-loafers': getImageUrl('sako-women-laofer.jpg'),
  'women/shoes/oxford': getImageUrl('/images/placeholder.svg'),
  'women/shoes/moccasin': getImageUrl('sako-women-moccasin.jpg'),
}

const HOME_CATEGORIES_REVALIDATE_SECONDS = 600

function categoryName(cat: Category, lng: 'en' | 'he'): string {
  if (typeof cat.name === 'string') return cat.name
  return (lng === 'he' ? cat.name?.he : cat.name?.en) || ''
}

function mapCategory(
  cat: Category,
  path: HomeShoeCategoryPath,
  lng: 'en' | 'he'
): HomeShoeCategory {
  return {
    id: cat.id!,
    name: categoryName(cat, lng),
    image: cat.image?.trim() || CATEGORY_FALLBACK_IMAGES[path],
    href: `/collection/${path}`,
    path,
  }
}

async function loadHomeShoeCategories(lng: 'en' | 'he'): Promise<HomeShoeCategory[]> {
  const results = await Promise.all(
    HOME_SHOE_CATEGORY_PATHS.map(async (path) => {
      const categories = await categoryService.getCategoriesByPath(path)
      const cat = categories.find((c) => c.isEnabled !== false)
      if (!cat?.id) return null
      return mapCategory(cat, path, lng)
    })
  )

  return results.filter((item): item is HomeShoeCategory => item !== null)
}

function createCachedHomeShoeCategories(lng: 'en' | 'he') {
  return unstable_cache(
    () => loadHomeShoeCategories(lng),
    ['home-shoe-categories', lng],
    { revalidate: HOME_CATEGORIES_REVALIDATE_SECONDS }
  )
}

const cachedHomeShoeCategoriesByLng = {
  en: createCachedHomeShoeCategories('en'),
  he: createCachedHomeShoeCategories('he'),
} as const

export async function fetchHomeShoeCategories(
  lng: 'en' | 'he'
): Promise<HomeShoeCategory[]> {
  return cachedHomeShoeCategoriesByLng[lng]()
}
