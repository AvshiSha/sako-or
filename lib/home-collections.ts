import {
  getHomeBannerBagsImageUrl,
  getHomeBannerLowBootsImageUrl,
  getHomeBannerPlatformLoafersImageUrl,
} from '@/lib/image-urls'

export interface HomeCollectionBanner {
  id: string
  title: { en: string; he: string }
  href: string
  image: string
  /**
   * The small link label over the banner (438:3257, "SHOP BAGS"). Not localised:
   * the Hebrew frame sets these in Latin too, alongside Latin headings. Deriving
   * it from `href` would be guesswork, so it is stated per banner.
   */
  cta: string
}

export const HOME_COLLECTION_BANNERS: HomeCollectionBanner[] = [
  // Order matters: the first entry fills the frame's tall slot (438:3271, index
  // 01) and the next two stack beside it. Hebrew names are the collection
  // catalogue's own (lib/chatbase/collection-catalog.ts) rather than fresh
  // translations, so the banner and the search aliases agree.
  {
    id: 'platform-loafers',
    title: { en: 'Platform Loafers', he: 'לואפרים פלטפורמה' },
    href: '/collection/women/shoes/platform-loafers',
    image: getHomeBannerPlatformLoafersImageUrl(),
    cta: 'SHOP LOAFERS',
  },
  {
    id: 'bags',
    title: { en: 'Bags', he: 'תיקים' },
    href: '/collection/women/accessories/bags',
    image: getHomeBannerBagsImageUrl(),
    cta: 'SHOP BAGS',
  },
  {
    id: 'low-boots',
    title: { en: 'Low Boots', he: 'מגפונים' },
    href: '/collection/women/shoes/low-boots',
    image: getHomeBannerLowBootsImageUrl(),
    cta: 'SHOP BOOTS',
  },
]
