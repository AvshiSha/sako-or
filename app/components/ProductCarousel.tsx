'use client'

import { useState } from 'react'
import ProductCard from './ProductCard'
import type { Product } from '@/lib/product-types'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/app/components/ui/carousel'

interface ProductCarouselProps {
  products: Product[]
  title: string
  language?: 'en' | 'he'
  isAboveFold?: boolean
}

export default function ProductCarousel({
  products,
  title,
  language = 'en',
  isAboveFold = false,
}: ProductCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const isRTL = language === 'he'

  if (!products || products.length === 0) {
    return null
  }

  return (
    <div className="w-full py-12 min-h-[420px] md:min-h-[480px]" style={{ backgroundColor: '#E1DBD7' }}>
      <div className="max-w-[90rem] lg:max-w-[90%] xl:max-w-[90%] mx-auto px-2 sm:px-6 lg:px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-black mb-6 text-center">
          {title}
        </h2>
        <div className="border-b border-gray-200 mb-6"></div>

        <div className="relative group">
          <Carousel
            setApi={setApi}
            opts={{
              align: 'start',
              loop: true,
              dragFree: false,
              containScroll: 'trimSnaps',
              duration: 25,
              direction: isRTL ? 'rtl' : 'ltr',
            }}
            direction={isRTL ? 'rtl' : 'ltr'}
            className="w-full"
          >
            <CarouselContent>
              {products.map((product, index) => (
                <CarouselItem
                  key={product.id || product.sku}
                  className="basis-[85%] sm:basis-[45%] lg:basis-[30%]"
                >
                  <ProductCard
                    product={product}
                    language={language}
                    disableImageCarousel={true}
                    isAboveFold={isAboveFold && index < 3}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>

            <div className="hidden md:block">
              {isRTL ? (
                <>
                  <CarouselNext className="!left-1 !right-auto !top-1/3 !-translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 border border-[#856D55]/80 bg-[#856D55]/80 hover:bg-[#856D55] [&>svg]:rotate-180" />
                  <CarouselPrevious className="!right-1 !left-auto !top-1/3 !-translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 border border-[#856D55]/80 bg-[#856D55]/80 hover:bg-[#856D55] [&>svg]:rotate-180" />
                </>
              ) : (
                <>
                  <CarouselPrevious className="left-2 !top-1/4 !-translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 border border-gray-300 bg-white/90 hover:bg-white" />
                  <CarouselNext className="right-2 !top-1/4 !-translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 border border-gray-300 bg-white/90 hover:bg-white" />
                </>
              )}
            </div>
          </Carousel>
        </div>
      </div>
    </div>
  )
}
