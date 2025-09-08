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
import { useCart } from '@/app/hooks/useCart'
import Toast, { useToast } from '@/app/components/Toast'
import AddToCartModal from '@/app/components/AddToCartModal'

interface FavoriteProduct extends Product {
  isUnavailable?: boolean
}

export default function FavoritesPage() {
  const params = useParams()
  const lng = params?.lng as string || 'en'
  const isRTL = lng === 'he'
  
  console.log('🚀 Favorites page: Component loaded, language:', lng)
  
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<FavoriteProduct | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
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
    console.log('🔄 Favorites page: isClient changed to:', isClient)
    if (isClient) {
      const loadFavorites = async () => {
        if (!isClient) return
        
        try {
          setLoading(true)
          
          // Get favorite SKUs from localStorage
          const favoriteSkus = JSON.parse(localStorage.getItem('favorites') || '[]')
          console.log('🔍 Favorites page: Found SKUs in localStorage:', favoriteSkus)
          
          if (favoriteSkus.length === 0) {
            setFavorites([])
            setLoading(false)
            return
          }

          // Fetch product data for each favorite SKU
          const favoriteProducts: FavoriteProduct[] = []
          
          for (const sku of favoriteSkus) {
            try {
              console.log('🔍 Favorites page: Fetching product for SKU:', sku)
              const product = await productService.getProductBySku(sku)
              console.log('📦 Favorites page: Product found:', product ? 'YES' : 'NO')
              if (product) {
                favoriteProducts.push(product)
              } else {
                // Product not found - mark as unavailable
                favoriteProducts.push({
                  sku,
                  slug: { en: 'unavailable', he: 'לא-זמין' },
                  name: { en: 'Unavailable Product', he: 'מוצר לא זמין' },
                  description: { en: 'This product is no longer available', he: 'המוצר הזה כבר לא זמין' },
                  price: 0,
                  stock: 0,
                  featured: false,
                  isNew: false,
                  isActive: false,
                  categoryId: '',
                  images: [],
                  variants: [],
                  tags: [],
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  isUnavailable: true
                } as FavoriteProduct)
              }
            } catch (error) {
              console.error(`Error fetching product ${sku}:`, error)
            }
          }
          
          console.log('✅ Favorites page: Final products loaded:', favoriteProducts.length)
          setFavorites(favoriteProducts)
        } catch (error) {
          console.error('❌ Error loading favorites:', error)
        } finally {
          setLoading(false)
        }
      }
      
      loadFavorites()
    }
  }, [isClient])

  const removeFromFavorites = (sku: string) => {
    if (!isClient) return
    
    try {
      // Remove from localStorage
      const favoriteSkus = JSON.parse(localStorage.getItem('favorites') || '[]')
      const updatedFavorites = favoriteSkus.filter((favSku: string) => favSku !== sku)
      localStorage.setItem('favorites', JSON.stringify(updatedFavorites))
      
      // Update state
      setFavorites(prev => prev.filter(product => product.sku !== sku))
    } catch (error) {
      console.error('Error removing from favorites:', error)
    }
  }

  const toggleFavorite = (sku: string) => {
    if (!isClient) return
    
    try {
      const favoriteSkus = JSON.parse(localStorage.getItem('favorites') || '[]')
      const isFavorite = favoriteSkus.includes(sku)
      
      if (isFavorite) {
        // Remove from favorites
        const updatedFavorites = favoriteSkus.filter((favSku: string) => favSku !== sku)
        localStorage.setItem('favorites', JSON.stringify(updatedFavorites))
        setFavorites(prev => prev.filter(product => product.sku !== sku))
      } else {
        // Add to favorites
        const updatedFavorites = [...favoriteSkus, sku]
        localStorage.setItem('favorites', JSON.stringify(updatedFavorites))
        // Note: We don't add to state here since we don't have the full product data
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }


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
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
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
            {favorites.map((product) => (
              <div key={product.sku} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Product Image */}
                <div className="relative aspect-square">
                  {product.isUnavailable ? (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <ExclamationTriangleIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  ) : (
                    <Link href={`/${lng}/product/${product.sku}`}>
                      <Image
                        src={product.images?.[0]?.url || '/images/placeholder.svg'}
                        alt={product.name?.[lng as 'en' | 'he'] || 'Product'}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-200"
                      />
                    </Link>
                  )}
                  
                  {/* Favorite Button */}
                  <button
                    onClick={() => toggleFavorite(product.sku!)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow"
                  >
                    <HeartSolidIcon className="h-5 w-5 text-red-500" />
                  </button>
                </div>

                {/* Product Info */}
                <div className="p-4">
                  {product.isUnavailable ? (
                    /* Unavailable Product */
                    <div>
                      <div className="flex items-center text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                        <span className="text-sm font-medium">{t.productUnavailable}</span>
                      </div>
                      <button
                        onClick={() => removeFromFavorites(product.sku!)}
                        className="text-sm text-gray-500 hover:text-red-600 flex items-center"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        {t.removeUnavailable}
                      </button>
                    </div>
                  ) : (
                    /* Available Product */
                    <>
                      <Link href={`/${lng}/product/${product.sku}`}>
                        <h3 className="font-medium text-gray-900 mb-2 hover:text-indigo-600 line-clamp-2">
                          {product.name?.[lng as 'en' | 'he']}
                        </h3>
                      </Link>
                      
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-gray-900">
                        ₪{product.price.toFixed(2)}
                        </span>
                        {product.stock <= 0 && (
                          <span className="text-sm text-red-600 font-medium">
                            {t.outOfStock}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedProduct(product)
                          setIsModalOpen(true)
                        }}
                        disabled={product.stock <= 0}
                        className={`w-full py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center ${
                          product.stock <= 0
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
            ))}
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
    </div>
  )
}
