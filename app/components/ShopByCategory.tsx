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

  const sectionTitle = lng === 'he' ? 'קנו לפי קטגוריה' : 'SHOP BY CATEGORY'
  const sectionLabel = lng === 'he' ? 'קנו לפי קטגוריה' : 'Shop by category'

  return (
    <section
      className="w-full bg-white"
      aria-label={sectionLabel}
    >
      <div className="max-w-[90rem] lg:max-w-[90%] xl:max-w-[90%] mx-auto px-2 sm:px-6 lg:px-4 pt-12 md:pt-16 pb-4 md:pb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-black mb-6 text-center uppercase tracking-wide">
          {sectionTitle}
        </h2>
        <div className="border-b border-gray-200 mb-6" />

        <div className="relative group">
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
                  className="basis-[75%] sm:basis-[45%] lg:basis-[30%] xl:basis-[22%]"
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
                    <div className="relative w-full aspect-[3/4] bg-neutral-200 overflow-hidden">
                      <Image
                        src={category.image}
                        alt={category.name}
                        fill
                        sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 20vw"
                        className="object-cover transition-transform duration-300 ease-out group-hover/item:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-3 text-center text-sm md:text-base font-medium text-black uppercase tracking-wide">
                      {category.name}
                    </p>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>

            <div className="hidden md:block">
              {isRTL ? (
                <>
                  <CarouselNext className="!left-1 !right-auto !top-1/3 !-translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 border border-gray-300 bg-white/90 hover:bg-white [&>svg]:rotate-180" />
                  <CarouselPrevious className="!right-1 !left-auto !top-1/3 !-translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 border border-gray-300 bg-white/90 hover:bg-white [&>svg]:rotate-180" />
                </>
              ) : (
                <>
                  <CarouselPrevious className="left-2 !top-1/3 !-translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 border border-gray-300 bg-white/90 hover:bg-white" />
                  <CarouselNext className="right-2 !top-1/3 !-translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 border border-gray-300 bg-white/90 hover:bg-white" />
                </>
              )}
            </div>
          </Carousel>
        </div>
      </div>
    </section>
  )
}
