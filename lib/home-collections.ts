import {
  getHomeCollectionAccessoriesImageUrl,
  getHomeCollectionMenImageUrl,
  getHomeCollectionOutletImageUrl,
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
  {
    id: 'outlet',
    title: { en: 'Outlet Collection', he: 'Outlet' },
    href: '/collection/women/outlet',
    image: getHomeCollectionOutletImageUrl(),
    cta: 'SHOP OUTLET',
  },
  {
    id: 'accessories',
    title: { en: 'Accessories Collection', he: 'Accessories' },
    href: '/collection/women/accessories',
    image: getHomeCollectionAccessoriesImageUrl(),
    cta: 'SHOP ACCESSORIES',
  },
  {
    id: 'men',
    title: { en: 'Men Collection', he: 'Men' },
    href: '/collection/men',
    image: getHomeCollectionMenImageUrl(),
    cta: 'SHOP MEN',
  },
]
