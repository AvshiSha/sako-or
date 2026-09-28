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
  /**
   * Small Latin label opposite the title (438:2953, "YOU MAY ALSO LIKE"). Opt-in per
   * call site: the three carousels head different sections and the frame only supplies
   * copy for one, so nothing is invented here. Omitted, the header is the title alone.
   */
  eyebrow?: string
  language?: 'en' | 'he'
  isAboveFold?: boolean
}

export default function ProductCarousel({
  products,
  title,
  eyebrow,
  language = 'en',
  isAboveFold = false,
}: ProductCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const isRTL = language === 'he'

  if (!products || products.length === 0) {
    return null
  }

  return (
    // Full-bleed: the frame runs the section edge to edge, so the old max-width
    // container and its gutters are gone along with the white ground.
    <section className="w-full overflow-clip">
      {/* Header band (438:2951) — rules above and below, 30/33 padding. The title is
          first in the DOM so RTL lands it on the right with the Latin eyebrow
          opposite, which is how the frame reads. items-end sits both on one baseline. */}
      <div className="flex items-end justify-between border-y border-sako-black px-[30px] py-[33px]">
        <h2 className="font-ploni text-[32px] font-black leading-[32px] text-text-primary lg:text-[48px] lg:leading-[34.56px]">
          {title}
        </h2>
        {eyebrow && (
          <p className="pb-[15px] font-ploni text-[9px] tracking-[0.72px] text-text-primary">
            {eyebrow}
          </p>
        )}
      </div>

      {/* The track sits on surface-dark (438:2955). Cards are flush - they carry their
          own hairline divider - so the carousel's default gutter is removed rather
          than left to open gaps the design does not have. */}
      {/* group/carousel, not a bare `group`. ProductCard marks itself `group` and
          scopes its hover affordances - the "בחרי מידה" overlay among them - with
          group-hover:. An unnamed group here would sit above every card and match
          those selectors, so hovering anywhere in the track revealed the button on
          all cards at once. Naming this one keeps the two from colliding. */}
      <div className="group/carousel relative bg-surface-dark">
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
            // The frame butts the cards together, divided by their own hairline. The
            // carousel's gutter is direction-aware (-mr-4 / pr-3 under RTL, not the
            // ml/pl pair), so cancelling it with utilities silently missed in Hebrew
            // and the dark track showed through as a black band between cards. This
            // variant is the component's own supported way to remove it.
            itemVariant="flush"
            className="w-full"
          >
            <CarouselContent>
              {products.map((product, index) => (
                <CarouselItem
                  key={product.id || product.sku}
                  // 418px from lg is the frame's card width; the gutter is handled by
                  // itemVariant="flush" above rather than by cancelling padding here.
                  className="basis-[55%] sm:basis-[40%] lg:basis-[418px]"
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
                  <CarouselNext className="!left-1 !right-auto !top-1/3 !-translate-y-0 h-8 w-8 rounded-none border border-sako-black bg-surface-secondary text-text-primary opacity-0 transition-opacity duration-200 hover:bg-surface-primary group-hover/carousel:opacity-100 [&>svg]:rotate-180" />
                  <CarouselPrevious className="!right-1 !left-auto !top-1/3 !-translate-y-0 h-8 w-8 rounded-none border border-sako-black bg-surface-secondary text-text-primary opacity-0 transition-opacity duration-200 hover:bg-surface-primary group-hover/carousel:opacity-100 [&>svg]:rotate-180" />
                </>
              ) : (
                <>
                  <CarouselPrevious className="left-2 !top-1/4 !-translate-y-0 h-8 w-8 rounded-none border border-sako-black bg-surface-secondary text-text-primary opacity-0 transition-opacity duration-200 hover:bg-surface-primary group-hover/carousel:opacity-100" />
                  <CarouselNext className="right-2 !top-1/4 !-translate-y-0 h-8 w-8 rounded-none border border-sako-black bg-surface-secondary text-text-primary opacity-0 transition-opacity duration-200 hover:bg-surface-primary group-hover/carousel:opacity-100" />
                </>
              )}
            </div>
          </Carousel>
      </div>
    </section>
  )
}
