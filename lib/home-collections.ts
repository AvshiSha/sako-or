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
}

export const HOME_COLLECTION_BANNERS: HomeCollectionBanner[] = [
  {
    id: 'outlet',
    title: { en: 'Outlet Collection', he: 'Outlet' },
    href: '/collection/women/outlet',
    image: getHomeCollectionOutletImageUrl(),
  },
  {
    id: 'accessories',
    title: { en: 'Accessories Collection', he: 'Accessories' },
    href: '/collection/women/accessories',
    image: getHomeCollectionAccessoriesImageUrl(),
  },
  {
    id: 'men',
    title: { en: 'Men Collection', he: 'Men' },
    href: '/collection/men',
    image: getHomeCollectionMenImageUrl(),
  },
]
