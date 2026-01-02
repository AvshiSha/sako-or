'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  HeartIcon, 
  TrashIcon,
  ShoppingBagIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { productService, Product } from '@/lib/firebase'
import Toast, { useToast } from '@/app/components/Toast'
import QuickBuyDrawer from '@/app/components/QuickBuyDrawer'
import FavoriteMobileCard from '@/app/components/FavoriteMobileCard'
import { getColorName } from '@/lib/colors'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/app/components/ui/carousel'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useFavorites } from '@/app/hooks/useFavorites'
import { parseFavoriteKey } from '@/lib/favorites'

interface FavoriteProduct extends Product {
  isUnavailable?: boolean
  favoriteColorSlug?: string // The specific color variant that was favorited
}

interface FavoriteItem extends FavoriteProduct {
  favoriteKey: string
  favoriteBaseSku: string
  favoriteColorSlug?: string
}

export default function FavoritesPage() {
  const params = useParams()
  const lng = params?.lng as string || 'en'
  const isRTL = lng === 'he'
  
  
  const { favorites: favoriteKeys, toggleFavorite, loading: favoritesLoading } = useFavorites()
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false)
  const [drawerProduct, setDrawerProduct] = useState<FavoriteProduct | null>(null)
  
  // Track desktop status for drawer animation timeout
  // Use ref to avoid re-renders and ensure consistent value during close callback
  const isDesktopRef = useRef(false)
  
  // Carousel state per product (using Map for efficient lookups)
  const [carouselApis, setCarouselApis] = useState<Map<string, CarouselApi>>(new Map())
  const [selectedImageIndices, setSelectedImageIndices] = useState<Map<string, number>>(new Map())
  const carouselApisRef = useRef<Map<string, CarouselApi>>(new Map())
  
  // Toast hook
  const { toast, showToast, hideToast } = useToast()
  
  // Track desktop status for drawer close animation timeout
  useEffect(() => {
    const updateDesktopStatus = () => {
      isDesktopRef.current = window.matchMedia('(min-width: 640px)').matches
    }
    
    // Set initial value
    updateDesktopStatus()
    
    // Update on resize
    const mediaQuery = window.matchMedia('(min-width: 640px)')
    const handleChange = () => updateDesktopStatus()
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [])

  // Localized content
  const content = {
    en: {
      title: 'My Favorites',
      emptyTitle: 'No favorites yet',
      emptyDescription: 'Start adding products to your favorites to see them here.',
      emptyButton: 'Browse Products',
      removeFromFavorites: 'Remove from favorites',
      addToCart: 'Add to Cart',
      outOfStock: 'Out of Stock',
      productUnavailable: 'This product is no longer available',
      removeUnavailable: 'Remove',
      totalItems: 'items'
    },
    he: {
      title: 'המועדפים שלי',
      emptyTitle: 'אין מועדפים עדיין',
      emptyDescription: 'התחל להוסיף מוצרים למועדפים שלך כדי לראות אותם כאן.',
      emptyButton: 'עיין במוצרים',
      removeFromFavorites: 'הסר מהמועדפים',
      addToCart: 'הוסף לעגלה',
      outOfStock: 'אזל מהמלאי',
      productUnavailable: 'המוצר הזה כבר לא זמין',
      removeUnavailable: 'הסר',
      totalItems: 'פריטים'
    }
  }

  const t = content[lng as keyof typeof content]

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return
    if (favoritesLoading) {
      setLoading(true)
      return
    }

    const loadFavorites = async () => {
      try {
        setLoading(true)

        if (!favoriteKeys || favoriteKeys.length === 0) {
          setFavorites([])
          return
        }

        // Cache by baseSku to avoid refetching the same product for multiple colors
        const productCache = new Map<string, FavoriteProduct | null>()
        const favoriteItems: FavoriteItem[] = []

        for (const favoriteKey of favoriteKeys) {
          const { baseSku, colorSlug } = parseFavoriteKey(favoriteKey)
          if (!baseSku) continue

          let product = productCache.get(baseSku)
          if (product === undefined) {
            try {
              // Get product directly (color variants are already in the document)
              product = await productService.getProductByBaseSku(baseSku)

              // If not found, try legacy method (using sku field)
              if (!product) {
                product = await productService.getProductBySku(baseSku)
              }

              // If still not found, try searching by baseSku in legacy products
              if (!product) {
                const allProducts = await productService.getAllProducts()
                product = allProducts.find((p) => p.baseSku === baseSku) || null
              }
            } catch (error) {
              console.error(`Error fetching product ${baseSku}:`, error)
              product = null
            }

            productCache.set(baseSku, product)
          }

          if (product) {
            favoriteItems.push({
              ...(product as FavoriteProduct),
              favoriteKey,
              favoriteBaseSku: baseSku,
              favoriteColorSlug: colorSlug || undefined
            })
          } else {
            favoriteItems.push({
              sku: baseSku,
              title_en: 'Unavailable Product',
              title_he: 'מוצר לא זמין',
              description_en: 'This product is no longer available',
              description_he: 'המוצר הזה כבר לא זמין',
              category: '',
              subCategory: '',
              subSubCategory: '',
              categories_path: [],
              categories_path_id: [],
              brand: '',
              price: 0,
              salePrice: 0,
              currency: 'USD',
              colorVariants: {},
              isEnabled: false,
              isDeleted: true,
              newProduct: false,
              featuredProduct: false,
              materialCare: {},
              seo: {},
              searchKeywords: [],
              tags: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              isUnavailable: true,
              favoriteKey,
              favoriteBaseSku: baseSku,
              favoriteColorSlug: colorSlug || undefined
            } as FavoriteItem)
          }
        }

        setFavorites(favoriteItems)
      } catch (error) {
        console.error('❌ Error loading favorites:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadFavorites()
  }, [isClient, favoritesLoading, favoriteKeys])

  // Update selected image index when carousel changes for each product
  useEffect(() => {
    const unsubscribes: (() => void)[] = []
    
    carouselApisRef.current.forEach((api, productKey) => {
      if (!api) return
      
      const onSelect = () => {
        const selected = api.selectedScrollSnap()
        setSelectedImageIndices((prev: Map<string, number>) => {
          const currentIndex = prev.get(productKey)
          if (currentIndex === selected) {
            return prev // No change, return same Map
          }
          const newMap = new Map(prev)
          newMap.set(productKey, selected)
          return newMap
        })
      }
      
      api.on('select', onSelect)
      onSelect() // Set initial index
      
      unsubscribes.push(() => {
        api.off('select', onSelect)
      })
    })
    
    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [carouselApis])


  // Show loading state
  if (!isClient || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
          <p className="mt-4 text-gray-600">{lng === 'he' ? 'טוען...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E1DBD7] pt-16" dir={isRTL ? 'rtl' : 'ltr'} style={{ backgroundColor: '#E1DBD7' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-4 mt-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center font-assistant gap-4">
            <HeartSolidIcon className="h-8 w-8 text-red-500" />
            {t.title}
          </h1>
          {favorites.length > 0 && (
            <p className="text-gray-600 mt-2 font-assistant">
              {favorites.length} {t.totalItems}
            </p>
          )}
        </div>

        {/* Favorites List */}
        {favorites.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <HeartIcon className="h-16 w-16 text-[#856D55] mx-auto mb-4 font-assistant " />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t.emptyTitle}
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {t.emptyDescription}
            </p>
            <Link
              href={`/${lng}`}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#856D55] hover:bg-[#856D55]/90"
            >
              {t.emptyButton}
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile View - Horizontal Cards */}
            <div className="sm:hidden space-y-4">
              {favorites.map((product) => {
                if (!product.isEnabled) {
                  // Unavailable product - show simple card
                  return (
                    <div key={product.favoriteKey} className="bg-white rounded-lg shadow-sm overflow-hidden p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-red-600 flex-1">
                          <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                          <span className="text-sm font-medium">{t.productUnavailable}</span>
                        </div>
                        <button
                          onClick={() => void toggleFavorite(product.favoriteKey)}
                          className="text-sm text-gray-500 hover:text-red-600 flex items-center ml-4"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          {t.removeUnavailable}
                        </button>
                      </div>
                    </div>
                  )
                }
                return (
                  <FavoriteMobileCard
                    key={product.favoriteKey}
                    product={product}
                    language={lng as 'en' | 'he'}
                    onRemove={(baseSku: string) => {
                      const item = favorites.find(f => (f.baseSku || f.sku) === baseSku)
                      if (item?.favoriteKey) {
                        void toggleFavorite(item.favoriteKey)
                      }
                    }}
                    onAddToCartSuccess={() => {
                      showToast(
                        lng === 'he' ? 'הוסף לעגלה בהצלחה' : 'Added to cart successfully',
                        'success'
                      )
                    }}
                  />
                )
              })}
            </div>

            {/* Desktop View - Grid */}
            <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {favorites.map((product) => {
                // Get the specific color variant that was favorited, or fallback to first active
                const favoriteColorSlug = product.favoriteColorSlug
                let selectedVariant = null
                
                if (favoriteColorSlug && product.colorVariants && product.colorVariants[favoriteColorSlug]) {
                  selectedVariant = product.colorVariants[favoriteColorSlug]
                } else if (product.colorVariants && Object.keys(product.colorVariants).length > 0) {
                  // Fallback to first active variant
                  const activeVariants = Object.values(product.colorVariants).filter((v: any) => v.isActive !== false)
                  selectedVariant = activeVariants[0] || null
                }
                
                // Get all images from the selected variant
                const variantImages = selectedVariant?.images || []
                const totalImages = variantImages.length
                const primaryImage = selectedVariant?.primaryImage || variantImages[0]
                const imageSrc = primaryImage || (product as any).primaryImage || (product as any).images?.[0] || '/images/placeholder.svg'
                
                // Check if this is a product with no images (needs color variants)
                const hasNoImages = !primaryImage && !variantImages.length && !(product as any).primaryImage && !(product as any).images?.length
                
                // Get carousel API and selected index for this product
                const productKey = product.favoriteKey || product.sku || product.baseSku || ''
                const carouselApi = carouselApisRef.current.get(productKey)
                const selectedImageIndex = selectedImageIndices.get(productKey) || 0
                
                // Find primary image index
                const primaryImageIndex = primaryImage && variantImages.length > 0
                  ? variantImages.findIndex((img: any) => img === primaryImage || (typeof img === 'string' ? img : img?.url) === primaryImage)
                  : 0
                
                return (
                <div key={product.favoriteKey} className="group relative bg-gray-100">
                {/* Product Image */}
                <Link 
                  href={`/${lng}/product/${product.baseSku || product.sku}/${selectedVariant?.colorSlug || favoriteColorSlug || 'default'}`}
                  className="relative aspect-square overflow-hidden bg-gray-50 block"
                >
                  {!product.isEnabled ? (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <ExclamationTriangleIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  ) : hasNoImages ? (
                    <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-500">
                      <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-center px-2">
                        {lng === 'he' ? 'אין תמונות זמינות' : 'No images available'}
                      </span>
                      <span className="text-xs text-center px-2 mt-1 text-gray-400">
                        {lng === 'he' ? 'צור קשר עם מנהל המערכת' : 'Contact admin to add images'}
                      </span>
                    </div>
                  ) : totalImages > 1 ? (
                    <>
                      {/* Image Carousel */}
                      <Carousel
                        setApi={(api) => {
                          if (api && carouselApisRef.current.get(productKey) !== api) {
                            carouselApisRef.current.set(productKey, api)
                            setCarouselApis(new Map(carouselApisRef.current))
                          }
                        }}
                        direction={isRTL ? 'rtl' : 'ltr'}
                        opts={{
                          align: 'start',
                          loop: true,
                        }}
                        className="w-full h-full"
                      >
                        <CarouselContent className={`h-full ${isRTL ? '-mr-0' : '-ml-0'}`}>
                          {variantImages.map((image: any, index: number) => {
                            const imageUrl = typeof image === 'string' ? image : image?.url || ''
                            const shouldPreload = Math.abs(selectedImageIndex - index) <= 1
                            const isPrimary = index === (primaryImageIndex >= 0 ? primaryImageIndex : 0)
                            
                            return (
                              <CarouselItem key={`image-${index}`} className={`h-full basis-full ${isRTL ? 'pr-0' : 'pl-0'}`}>
                                <div className="w-full h-full relative">
                                  <Image
                                    src={imageUrl}
                                    alt={`${lng === 'he' ? product.title_he : product.title_en} - ${selectedVariant?.colorSlug || favoriteColorSlug || 'default'} - ${index + 1}`}
                                    width={500}
                                    height={500}
                                    className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105 md:group-hover:scale-100"
                                    priority={isPrimary}
                                    unoptimized={true}
                                    {...(isPrimary ? {} : { loading: shouldPreload ? undefined : 'lazy' })}
                                    draggable={false}
                                  />
                                </div>
                              </CarouselItem>
                            )
                          })}
                        </CarouselContent>
                      </Carousel>
                      
                      {/* Image indicator dots */}
                      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 flex space-x-1">
                        {Array.from({ length: totalImages }).map((_, index) => (
                          <div
                            key={index}
                            className={`w-1 h-1 rounded-full transition-all duration-200 ${
                              selectedImageIndex === index ? 'bg-[#E1DBD7]' : 'bg-[#E1DBD7]/50'
                            }`}
                          />
                        ))}
                      </div>
                      
                      {/* Desktop Arrow Navigation */}
                      {totalImages > 1 && (
                        <>
                          {/* Left Arrow (Previous) */}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              carouselApi?.scrollPrev()
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 hidden md:flex items-center justify-center"
                            aria-label={lng === 'he' ? 'תמונה קודמת' : 'Previous image'}
                          >
                            <ChevronLeftIcon className="h-5 w-5 text-gray-800" />
                          </button>
                          
                          {/* Right Arrow (Next) */}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              carouselApi?.scrollNext()
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 hidden md:flex items-center justify-center"
                            aria-label={lng === 'he' ? 'תמונה הבאה' : 'Next image'}
                          >
                            <ChevronRightIcon className="h-5 w-5 text-gray-800" />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <Image
                      src={imageSrc}
                      alt={selectedVariant?.colorSlug || favoriteColorSlug || 'default'}
                      fill
                      className="object-cover object-center transition-transform duration-300 group-hover:scale-105 md:group-hover:scale-100"
                    />
                  )}
                  
                  {/* Favorite Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void toggleFavorite(product.favoriteKey)
                    }}
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
                  >
                    <HeartSolidIcon className="h-4 w-4 text-red-500" />
                  </button>

                  {/* Desktop Quick Buy Button - Overlay at bottom of image */}
                  {product.isEnabled && !hasNoImages && (
                    <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 hidden md:block">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDrawerProduct(product)
                          // Add delay before opening to slow down the animation
                          setTimeout(() => {
                            setIsQuickBuyOpen(true)
                          }, 200)
                        }}
                        className="w-full border border-[#856D55]/90 bg-white text-black font-medium py-2 px-4 hover:bg-[#856D55]/90 hover:text-white transition-colors duration-200"
                      >
                        {lng === 'he' ? 'קניה מהירה' : 'Quick buy'}
                      </button>
                    </div>
                  )}
                </Link>

                {/* Product Information Section */}
                <div className="mt-0 bg-[#E1DBD7]/60 p-3 pb-1">
                  {!product.isEnabled ? (
                    /* Unavailable Product */
                    <div>
                      <div className="flex items-center text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                        <span className="text-sm font-medium">{t.productUnavailable}</span>
                      </div>
                      <button
                        onClick={() => void toggleFavorite(product.favoriteKey)}
                        className="text-sm text-gray-500 hover:text-red-600 flex items-center"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        {t.removeUnavailable}
                      </button>
                    </div>
                  ) : (
                    /* Available Product */
                    <>
                      <div className={`flex items-center justify-between mb-1 ${isRTL ? 'flex-row' : 'flex-row-reverse'}`}>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                          {lng === 'he' ? product.title_he : product.title_en}
                        </h3>
                      </div>

                      <div className="text-sm font-medium text-gray-900">{product.sku}</div>
                      
                      <div className="text-sm font-medium text-gray-900">
                        {product.salePrice && product.salePrice < product.price ? (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 line-through">
                              ₪{product.price.toFixed(2)}
                            </span>
                            <span className="text-red-600 font-bold">
                              ₪{product.salePrice.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span>₪{product.price.toFixed(2)}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Color Variants Section */}
                {product.colorVariants && Object.keys(product.colorVariants).length >= 1 && product.isEnabled && (
                  <div className="mt-0 bg-[#E1DBD7]/60 p-3 pt-1">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {Object.values(product.colorVariants)
                        .filter((v: any) => v.isActive !== false)
                        .map((variant: any) => {
                          const variantImage = variant.primaryImage || variant.images?.[0]
                          const isSelected = variant.colorSlug === (selectedVariant?.colorSlug || favoriteColorSlug)
                          
                          return (
                            <Link
                              key={variant.colorSlug}
                              href={`/${lng}/product/${product.baseSku || product.sku}/${variant.colorSlug}`}
                              className="flex-shrink-0 relative group"
                              title={getColorName(variant.colorSlug, lng as 'en' | 'he')}
                            >
                              {/* Product image */}
                              {variantImage && (
                                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent">
                                  <Image
                                    src={variantImage}
                                    alt={variant.colorSlug}
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              
                              {/* Selection line indicator */}
                              <div 
                                className={`absolute -bottom-1 left-0 w-8 h-0.5 transition-all duration-200 ${
                                  isSelected 
                                    ? 'bg-[#856D55]/90' 
                                    : 'bg-transparent group-hover:bg-gray-400'
                                }`}
                              />
                            </Link>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
              )
            })}
            </div>
          </>
        )}
      </div>
      
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        type={toast.type}
      />

      {/* Quick Buy Drawer */}
      {drawerProduct && (
        <QuickBuyDrawer
          isOpen={isQuickBuyOpen && !!drawerProduct}
          onClose={() => {
            // Start the close animation
            setIsQuickBuyOpen(false)
            // Delay clearing drawerProduct to allow close animation to complete
            // Use responsive timeout: 700ms for mobile, 2000ms for desktop (sm:duration-2000)
            // This matches the animation durations in QuickBuyDrawer
            // Use ref to get consistent desktop status (avoids SSR/hydration issues)
            const timeoutDuration = isDesktopRef.current ? 1000 : 700
            setTimeout(() => {
              setDrawerProduct(null)
            }, timeoutDuration)
          }}
          product={drawerProduct}
          language={lng as 'en' | 'he'}
          returnUrl={`/${lng}/favorites`}
        />
      )}
    </div>
  )
}
