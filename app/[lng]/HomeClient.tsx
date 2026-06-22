'use client'



import React from 'react'

import dynamic from 'next/dynamic'

import { track } from '@vercel/analytics'

import Link from 'next/link'

import Image from 'next/image'

import { useParams, usePathname } from 'next/navigation'

import {

  getBagsHeroPosterUrl,

  getSakoOrMobileVideoUrl,

  getSakoOrDesktopVideoUrl,

} from '@/lib/image-urls'

import ProductCarousel from '@/app/components/ProductCarousel'

import { type Product } from '@/lib/firebase'

import CollectionTiles from '@/app/components/CollectionTiles'



const HeroVideoSection = dynamic(() => import('@/app/components/HeroVideoSection'), {

  ssr: true,

})



const ProductCarouselLazy = dynamic(() => import('@/app/components/ProductCarousel'), {

  ssr: true,

})



interface HomeClientProps {

  initialBestSellers?: Product[]

  initialSakoOrProducts?: Product[]

}



export default function HomeClient({

  initialBestSellers = [],

  initialSakoOrProducts = [],

}: HomeClientProps) {

  const params = useParams()

  const pathname = usePathname()

  const bestSellers = initialBestSellers

  const sakoOrProducts = initialSakoOrProducts



  const lng = React.useMemo((): 'en' | 'he' => {

    if (pathname) {

      const pathSegments = pathname.split('/').filter(Boolean)

      const langFromPath = pathSegments[0]

      if (langFromPath === 'he' || langFromPath === 'en') {

        return langFromPath

      }

    }

    if (params?.lng && (params.lng === 'he' || params.lng === 'en')) {

      return params.lng as 'en' | 'he'

    }

    return 'en'

  }, [pathname, params?.lng])



  const isRTL = lng === 'he'

  const bagsPosterSrc = getBagsHeroPosterUrl()

  const sakoOrMobileVideoSrc = getSakoOrMobileVideoUrl()

  const sakoOrDesktopVideoSrc = getSakoOrDesktopVideoUrl()



  return (

    <div className={isRTL ? 'text-right' : 'text-left'} style={{ backgroundColor: '#FFFFFF' }}>

      {bestSellers.length > 0 && (

        <ProductCarousel

          products={bestSellers}

          title="Summer Collection Essentials"

          language={lng}

          isAboveFold

        />

      )}



      <HeroVideoSection

        desktopSrc={sakoOrDesktopVideoSrc}

        mobileSrc={sakoOrMobileVideoSrc}

        posterSrc={bagsPosterSrc}

        overlayOpacity="bg-neutral-900/60"

      >

        <div className="relative h-full flex flex-col items-center text-center">

          <div className="absolute bottom-6 md:bottom-8 left-0 right-0 flex flex-row justify-center items-center px-4">

            <Link

              onClick={() => track('to_bags_collection')}

              href={`/${lng}/collection/women/accessories/bags`}

              className="text-white text-base md:text-xl font-light tracking-wide underline decoration-white underline-offset-4 hover:opacity-80 transition-opacity duration-300"

            >

              {lng === 'he' ? 'לקולקציית התיקים' : 'to the bags'}

            </Link>

          </div>

        </div>

      </HeroVideoSection>



      {sakoOrProducts.length > 0 && (

        <ProductCarouselLazy products={sakoOrProducts} title="SAKO OR BAGS" language={lng} />

      )}



      <div className="relative aspect-[3/4] md:aspect-[21/9] bg-black">

        <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 bg-white p-2 md:p-3">

          <Link

            href={`/${lng}/collection/campaign?slug=new-collection`}

            onClick={() => track('campaign_new_in')}

            className="group relative overflow-hidden"

            aria-label={lng === 'he' ? 'חדש באתר' : 'New in'}

          >

            <Image

              src="https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fnew_in.webp?alt=media&token=304d3a1d-97fe-4194-a77e-1ef83bc38aab"

              alt={lng === 'he' ? 'חדש באתר' : 'New in'}

              fill

              sizes="(max-width: 768px) 100vw, 50vw"

              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"

              loading="lazy"

            />

            <div className="absolute inset-0 bg-neutral-900/40 transition-colors duration-300 group-hover:bg-neutral-900/50" aria-hidden="true" />

            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">

              <div className="text-white text-3xl md:text-4xl font-semibold tracking-tight uppercase">

                {lng === 'he' ? 'חדש באתר' : 'New in'}

              </div>

              <div className="mt-2 text-white/90 text-base md:text-lg font-light tracking-wide underline decoration-white/80 underline-offset-4 group-hover:text-white">

                {lng === 'he' ? 'לצפייה' : 'Shop now'}

              </div>

            </div>

          </Link>



          <Link

            href={`/${lng}/collection/campaign?slug=limited-edition`}

            onClick={() => track('campaign_limited_edition')}

            className="group relative overflow-hidden"

            aria-label={lng === 'he' ? 'מהדורה מוגבלת' : 'Limited edition'}

          >

            <Image

              src="https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Flimited_editoin_v2.webp?alt=media&token=1e63ede2-4dc9-49e3-8aca-b2f59f2ac0b8"

              alt={lng === 'he' ? 'מהדורה מוגבלת' : 'Limited edition'}

              fill

              sizes="(max-width: 768px) 100vw, 50vw"

              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"

              loading="lazy"

            />

            <div className="absolute inset-0 bg-neutral-900/40 transition-colors duration-300 group-hover:bg-neutral-900/50" aria-hidden="true" />

            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">

              <div className="text-white text-3xl md:text-4xl font-semibold tracking-tight uppercase">

                {lng === 'he' ? 'מהדורה מוגבלת' : 'Limited edition'}

              </div>

              <div className="mt-2 text-white/90 text-base md:text-lg font-light tracking-wide underline decoration-white/80 underline-offset-4 group-hover:text-white">

                {lng === 'he' ? 'לצפייה' : 'Shop now'}

              </div>

            </div>

          </Link>

        </div>

      </div>



      <CollectionTiles lng={lng} />

    </div>

  )

}

