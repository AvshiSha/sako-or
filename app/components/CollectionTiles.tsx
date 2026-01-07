import Image from 'next/image'
import Link from 'next/link'
import { getImageUrl } from '@/lib/image-urls'

interface CollectionTile {
  id: string
  image: string
  title?: string
  subtitle?: string
  href: string
}

interface CollectionTilesProps {
  lng: 'en' | 'he'
}

const tiles: CollectionTile[] = [
  {
    id: 'tile-1',
    image: getImageUrl('/images/collections/new-in-1.jpg'),
    title: 'SAKO MEN SHOES',
    subtitle: 'NEW IN',
    href: '/collection/women/accessories/sunglasses',
  },
  {
    id: 'tile-2',
    image: getImageUrl('/images/collections/new-in-2.jpg'),
    title: 'SAKO MEN JEWLS',
    subtitle: 'NEW IN',
    href: '/collection/women/shoes/sneakers',
  },
  {
    id: 'tile-3',
    image: getImageUrl('/images/collections/new-in-3.jpg'),
    title: 'SAKO WOMEN SHOES',
    subtitle: '50% OFF',
    href: '/collection/women/clothing/denim',
  },
  {
    id: 'tile-4',
    image: getImageUrl('/images/collections/new-in-4.jpg'),
    title: 'SAKO WOMEN BOOTS',
    subtitle: 'UP TO 50% OFF',
    href: '/collection/women/shoes/boots',
  },
  {
    id: 'tile-5',
    image: getImageUrl('/images/collections/new-in-5.jpg'),
    title: 'SAKO WOMEN BAGS',
    subtitle: 'UP TO 70% OFF',
    href: '/collection/women/clothing/coats',
  },
  {
    id: 'tile-6',
    image: getImageUrl('/images/collections/new-in-6.jpg'),
    title: 'SAKO WOMEN ACCESSORIES',
    subtitle: 'MIND & BODY',
    href: '/collection/women/accessories/wellness',
  },
  {
    id: 'tile-7',
    image: getImageUrl('/images/collections/new-in-7.jpg'),
    title: 'SAKO WOMEN BELTS',
    subtitle: 'UP TO 30% OFF',
    href: '/collection/women/shoes/sneakers',
  },
  {
    id: 'tile-8',
    image: getImageUrl('/images/collections/new-in-8.jpg'),
    title: 'SAKO WOMEN HIGH HEELS',
    subtitle: 'UP TO 70% OFF',
    href: '/collection/women/swimwear',
  },
  {
    id: 'tile-9',
    image: getImageUrl('/images/collections/new-in-9.jpg'),
    title: 'SAKO NEW IN',
    subtitle: 'NEW IN',
    href: '/collection/women/shoes/trainers',
  },
  {
    id: 'tile-10',
    image: getImageUrl('/images/collections/new-in-10.jpg'),
    title: 'SAKO WOMEN OXFORD',
    subtitle: 'WINTER',
    href: '/collection/women/clothing/jackets',
  },
]

export default function CollectionTiles({ lng }: CollectionTilesProps) {
  const isRTL = lng === 'he'

  return (
    <section
      className="w-full"
      aria-label={lng === 'he' ? 'אוספי קולקציות' : 'Collection tiles'}
    >
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          {tiles.map((tile) => (
            <Link
              key={tile.id}
              href={`/${lng}${tile.href}`}
              className="group relative block overflow-hidden rounded-none"
            >
              <div className="relative w-full aspect-[3/4] bg-neutral-200">
                <Image
                  src={tile.image}
                  alt={tile.title || ''}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-black/15 group-hover:bg-black/35 transition-colors duration-300" />

                {(tile.title || tile.subtitle) && (
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-4 px-3 sm:px-4 ${
                      isRTL ? 'text-right' : 'text-left'
                    }`}
                  >
                    {tile.title && (
                      <div className="text-xs sm:text-sm font-semibold tracking-wide text-white drop-shadow-md">
                        {tile.title}
                      </div>
                    )}
                    {tile.subtitle && (
                      <div className="text-xs sm:text-sm font-light text-white drop-shadow-md">
                        {tile.subtitle}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}


