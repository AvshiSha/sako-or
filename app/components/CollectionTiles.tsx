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
    image: getImageUrl('sako-men-shoes.webp'),
    title: 'SAKO MEN SHOES',
    subtitle: 'NEW IN',
    href: '/collection/men',
  },
  {
    id: 'tile-2',
    image: getImageUrl('sako-women-shoes.jpg'),
    title: 'SAKO BOOTS',
    subtitle: 'UP TP 50% OFF',
    href: '/collection/women/shoes/boots',
  },
  {
    id: 'tile-3',
    image: getImageUrl('sako-women-oxford.jpg'),
    title: 'SAKO WOMEN OXFORD SHOES',
    subtitle: 'UP TO 50% OFF',
    href: '/collection/women/shoes/oxford',
  },
  {
    id: 'tile-4',
    image: getImageUrl('low-boots.jpg'),
    title: 'SAKO WOMEN LOW BOOTS',
    subtitle: 'UP TO 50% OFF',
    href: '/collection/women/shoes/low-boots',
  },
  {
    id: 'tile-5',
    image: getImageUrl('women-bags.jpg'),
    title: 'SAKO WOMEN BAGS',
    subtitle: 'UP TO 30% OFF',
    href: '/collection/women/accessories/bags',
  },
  {
    id: 'tile-6',
    image: getImageUrl('sako-accs.jpg'),
    title: 'SAKO WOMEN ACCESSORIES',
    subtitle: 'UP TO 30% OFF',
    href: '/collection/women/accessories',
  },
  {
    id: 'tile-7',
    image: getImageUrl('sako-women-belts.jpg'),
    title: 'SAKO WOMEN BELTS',
    subtitle: 'UP TO 30% OFF',
    href: '/collection/women/accessories/belts',
  },
  {
    id: 'tile-8',
    image: getImageUrl('high-heels.jpg'),
    title: 'SAKO WOMEN HIGH HEELS',
    subtitle: 'UP TO 50% OFF',
    href: '/collection/women/shoes/high-heels',
  },
  {
    id: 'tile-9',
    image: getImageUrl('sako-outlet.jpg'),
    title: 'SAKO OUTLET',
    subtitle: 'UP TO 80% OFF',
    href: '/collection/women/outlet',
  },
  {
    id: 'tile-10',
    image: getImageUrl('sako-women-sneakers.jpg'),
    title: 'SAKO WOMEN SNEAKERS',
    subtitle: 'UP TO 30% OFF',
    href: '/collection/women/shoes/sneakers',
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


