'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { HomeShoeCategory } from '@/lib/home-categories'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/app/components/ui/carousel'

interface ShopByCategoryProps {
  categories: HomeShoeCategory[]
  lng: 'en' | 'he'
}

export default function ShopByCategory({ categories, lng }: ShopByCategoryProps) {
  const isRTL = lng === 'he'

  if (!categories.length) {
    return null
  }

  const sectionTitle = lng === 'he' ? 'SHOP BY CATEGORY' : 'SHOP BY CATEGORY'
  const sectionLabel = lng === 'he' ? 'Shop by category' : 'Shop by category'

  return (
    <section
      className="w-full bg-white"
      aria-label={sectionLabel}
    >
      <div className="max-w-[90rem] lg:max-w-[90%] xl:max-w-[90%] mx-auto px-2 sm:px-6 lg:px-4 pt-8 md:pt-12 pb-4 md:pb-6">
        <h2 className="text-xl md:text-2xl font-bold text-black mb-4 text-center uppercase tracking-wide">
          {sectionTitle}
        </h2>
        <div className="border-b border-gray-200 mb-6" />

        <div className="relative group px-4 sm:px-4 md:px-8">
          <Carousel
            opts={{
              align: 'start',
              loop: categories.length > 4,
              dragFree: false,
              containScroll: 'trimSnaps',
              duration: 25,
              direction: isRTL ? 'rtl' : 'ltr',
            }}
            direction={isRTL ? 'rtl' : 'ltr'}
            className="w-full"
          >
            <CarouselContent>
              {categories.map((category) => (
                <CarouselItem
                  key={category.id}
                  className={`basis-[62%] sm:basis-[40%] md:basis-[28%] lg:basis-[22%] xl:basis-[18%] ${
                    isRTL ? '!pr-1.5' : '!pl-1.5'
                  }`}
                >
                  <Link
                    href={`/${lng}${category.href}`}
                    className="block group/item"
                    aria-label={
                      lng === 'he'
                        ? `לקולקציית ${category.name}`
                        : `Shop ${category.name}`
                    }
                  >
                    <div className="relative w-full aspect-[9/16] bg-neutral-200 overflow-hidden">
                      <Image
                        src={category.image}
                        alt={category.name}
                        fill
                        sizes="(max-width: 640px) 35vw, (max-width: 1024px) 22vw, 18vw"
                        className="object-cover transition-transform duration-300 ease-out group-hover/item:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-2 text-center text-sm md:text-base font-medium text-black uppercase tracking-wide">
                      {category.name}
                    </p>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* {isRTL ? (
              <>
                <CarouselNext className="!left-0 !right-auto !top-[38%] !-translate-y-1/2 h-9 w-9 rounded-none border border-gray-300 bg-white shadow-sm hover:bg-gray-50 [&>svg]:rotate-180" />
                <CarouselPrevious className="!right-0 !left-auto !top-[38%] !-translate-y-1/2 h-9 w-9 rounded-none border border-gray-300 bg-white shadow-sm hover:bg-gray-50 [&>svg]:rotate-180" />
              </>
            ) : (
              <>
                <CarouselPrevious className="!left-0 !top-[38%] !-translate-y-1/2 h-9 w-9 rounded-none border border-gray-300 bg-white shadow-sm hover:bg-gray-50" />
                <CarouselNext className="!right-0 !top-[38%] !-translate-y-1/2 h-9 w-9 rounded-none border border-gray-300 bg-white shadow-sm hover:bg-gray-50" />
              </>
            )} */}
          </Carousel>
        </div>
      </div>
    </section>
  )
}
