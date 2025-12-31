'use client'

import { useState, useEffect } from 'react'
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
import AddToCartModal from '@/app/components/AddToCartModal'
import QuickBuyDrawer from '@/app/components/QuickBuyDrawer'
import { useFavorites } from '@/app/hooks/useFavorites'
import { parseFavoriteKey } from '@/lib/favorites'

interface FavoriteProduct extends Product {
  isUnavailable?: boolean
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
  const [selectedProduct, setSelectedProduct] = useState<FavoriteProduct | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false)
  
  // Toast hook
  const { toast, hideToast } = useToast()

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

        // #region agent log
        // #endregion

        if (!favoriteKeys || favoriteKeys.length === 0) {
          setFavorites([])
          return
        }

        // Cache by baseSku to avoid refetching the same product for multiple colors
        const productCache = new Map<string, FavoriteProduct | null>()
        const favoriteItems: FavoriteItem[] = []

        for (const favoriteKey of favoriteKeys) {
          const { baseSku, colorSlug } = parseFavoriteKey(favoriteKey)
          // #region agent log
          // #endregion
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
            // #region agent log
            // #endregion
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


  if (!isClient) {
    return <div className="min-h-screen bg-gray-50"></div>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="h-48 bg-gray-200 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-15" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 mt-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center text-center">
            <HeartSolidIcon className="h-8 w-8 text-red-500 mr-3" />
            {t.title}
          </h1>
          {favorites.length > 0 && (
            <p className="text-gray-600 mt-2">
              {favorites.length} {t.totalItems}
            </p>
          )}
        </div>

        {/* Favorites List */}
        {favorites.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <HeartIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t.emptyTitle}
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {t.emptyDescription}
            </p>
            <Link
              href={`/${lng}`}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {t.emptyButton}
            </Link>
          </div>
        ) : (
          /* Favorites Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favorites.map((product) => {
              const activeVariants = product.colorVariants
                ? Object.values(product.colorVariants).filter((v: any) => v?.isActive !== false)
                : []

              const preferredVariant = product.favoriteColorSlug
                ? activeVariants.find((v: any) => v?.colorSlug === product.favoriteColorSlug) || null
                : null

              const firstVariant = preferredVariant || activeVariants[0] || null
              const chosenColorSlug = firstVariant?.colorSlug || product.favoriteColorSlug || 'default'
              const imageSrc =
                firstVariant?.primaryImage ||
                firstVariant?.images?.[0] ||
                (product as any).primaryImage ||
                (product as any).images?.[0] ||
                '/images/placeholder.svg'
              
              // Check if this is a product with no images (needs color variants)
              const hasNoImages = !firstVariant?.primaryImage && !firstVariant?.images?.length && !(product as any).primaryImage && !(product as any).images?.length
              
              
              return (
              <div key={product.favoriteKey} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Product Image */}
                <div className="relative aspect-square">
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
                  ) : (
                    <Link href={`/${lng}/product/${product.favoriteBaseSku}/${chosenColorSlug}`}>
                      <Image
                        src={imageSrc}
                        alt={chosenColorSlug}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-200"
                      />
                    </Link>
                  )}
                  
                  {/* Favorite Button */}
                  <button
                    onClick={() => void toggleFavorite(product.favoriteKey)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow"
                  >
                    <HeartSolidIcon className="h-5 w-5 text-red-500" />
                  </button>
                </div>

                {/* Product Info */}
                <div className="p-4">
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
                      <Link href={`/${lng}/product/${product.favoriteBaseSku}/${chosenColorSlug}`}>
                        <h3 className="font-medium text-gray-900 mb-2 hover:text-indigo-600 line-clamp-2">
                          {lng === 'he' ? product.title_he : product.title_en}
                        </h3>
                      </Link>
                      
                      <div className="mb-3">
                        {product.salePrice && product.salePrice < product.price ? (
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm line-through" style={{ color: '#888888' }}>
                              ₪{product.price.toFixed(2)}
                            </span>
                            <span className="text-lg font-bold" style={{ color: '#d32f2f' }}>
                              ₪{product.salePrice.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-lg font-bold text-black">
                            ₪{product.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {(!product.colorVariants || Object.keys(product.colorVariants).length === 0 || Object.values(product.colorVariants).every(v => {
                          // Check if this color variant has any stock across all sizes
                          if (!v.stockBySize) return true;
                          const totalStock = Object.values(v.stockBySize).reduce((total, stock) => total + stock, 0);
                          return totalStock <= 0;
                        })) && (
                          <span className="text-sm text-red-600 font-medium">
                            {t.outOfStock}
                          </span>
                        )}
                      <button
                        onClick={() => {
                          setSelectedProduct(product)
                          setIsQuickBuyOpen(true)
                        }}
                        disabled={!product.colorVariants || Object.keys(product.colorVariants).length === 0 || Object.values(product.colorVariants).every(v => {
                          // Check if this color variant has any stock across all sizes
                          if (!v.stockBySize) return true;
                          const totalStock = Object.values(v.stockBySize).reduce((total, stock) => total + stock, 0);
                          return totalStock <= 0;
                        })}
                        className={`w-full py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center ${
                          (!product.colorVariants || Object.keys(product.colorVariants).length === 0 || Object.values(product.colorVariants).every(v => {
                            // Check if this color variant has any stock across all sizes
                            if (!v.stockBySize) return true;
                            const totalStock = Object.values(v.stockBySize).reduce((total, stock) => total + stock, 0);
                            return totalStock <= 0;
                          }))
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <ShoppingBagIcon className="h-4 w-4 mr-2" />
                        {t.addToCart}
                      </button>
                    </>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>
      
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        type={toast.type}
      />

      {/* Add to Cart Modal */}
      <AddToCartModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedProduct(null)
        }}
        product={selectedProduct}
        lng={lng}
      />

      {/* Quick Buy Drawer */}
      {selectedProduct && (
        <QuickBuyDrawer
          isOpen={isQuickBuyOpen}
          onClose={() => {
            setIsQuickBuyOpen(false)
            setSelectedProduct(null)
          }}
          product={selectedProduct}
          language={lng as 'en' | 'he'}
          returnUrl={`/${lng}/favorites`}
        />
      )}
    </div>
  )
}
