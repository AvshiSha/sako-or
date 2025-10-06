'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ShoppingBagIcon,
  TrashIcon,
  MinusIcon,
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { useCart } from '@/app/hooks/useCart'
import CheckoutModal from '@/app/components/CheckoutModal'

interface ProductFromUrl {
  sku: string
  quantity: number
}

interface CouponValidation {
  isValid: boolean
  discount?: number
  message?: string
}

export default function CheckoutPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const lng = params?.lng as string || 'en'
  const isRTL = lng === 'he'
  
  const { 
    items, 
    addToCart, 
    removeFromCart, 
    updateQuantity, 
    getTotalPrice, 
    getTotalItems,
    getDeliveryFee,
    getTotalWithDelivery,
    clearCart,
    loading 
  } = useCart()

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [urlProducts, setUrlProducts] = useState<ProductFromUrl[]>([])
  const [coupon, setCoupon] = useState<string>('')
  const [couponValidation, setCouponValidation] = useState<CouponValidation>({ isValid: false })
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [error, setError] = useState<string>('')

  // Parse URL parameters
  useEffect(() => {
    if (!isClient) return

    const productsParam = searchParams.get('products')
    const couponParam = searchParams.get('coupon')

    if (productsParam) {
      try {
        // Decode URL-encoded parameters
        const decodedProducts = decodeURIComponent(productsParam)
        const productPairs = decodedProducts.split(',')
        
        const parsedProducts: ProductFromUrl[] = productPairs.map(pair => {
          const [sku, quantity] = pair.split(':')
          return {
            sku: sku.trim(),
            quantity: parseInt(quantity.trim()) || 1
          }
        }).filter(p => p.sku && p.quantity > 0)

        setUrlProducts(parsedProducts)
        setError('')
      } catch (err) {
        setError('Invalid products parameter format')
        console.error('Error parsing products parameter:', err)
      }
    }

    if (couponParam) {
      setCoupon(couponParam)
    }
  }, [isClient, searchParams])

  // Load products and populate cart
  useEffect(() => {
    if (urlProducts.length === 0 || !isClient) return

    const loadProductsAndPopulateCart = async () => {
      setIsLoadingProducts(true)
      setError('')

      try {
        // Clear existing cart first
        clearCart()

        // Fetch product details for each SKU
        const productPromises = urlProducts.map(async (urlProduct) => {
          try {
            const response = await fetch(`/api/products?sku=${urlProduct.sku}`)
            if (!response.ok) {
              throw new Error(`Product ${urlProduct.sku} not found`)
            }
            const product = await response.json()
            return { product, quantity: urlProduct.quantity }
          } catch (err) {
            console.error(`Error fetching product ${urlProduct.sku}:`, err)
            throw err
          }
        })

        const productsWithQuantities = await Promise.all(productPromises)
        
        // Add products to cart
        productsWithQuantities.forEach(({ product, quantity }) => {
          if (product && product.isEnabled && !product.isDeleted) {
            // Add the product to cart with the specified quantity
            for (let i = 0; i < quantity; i++) {
              addToCart({
                sku: product.sku,
                name: {
                  en: product.title_en,
                  he: product.title_he
                },
                price: product.price,
                salePrice: product.salePrice,
                currency: product.currency || 'ILS',
                image: product.image || '/images/placeholder.svg',
                maxStock: 999 // Set a high limit for URL-based orders
              })
            }
          }
        })

        // Validate coupon if provided
        if (coupon) {
          await validateCoupon(coupon)
        }

      } catch (err) {
        setError(`Failed to load products: ${err instanceof Error ? err.message : 'Unknown error'}`)
        console.error('Error loading products:', err)
      } finally {
        setIsLoadingProducts(false)
      }
    }

    loadProductsAndPopulateCart()
  }, [urlProducts, isClient, addToCart, clearCart, coupon])

  const validateCoupon = async (couponCode: string) => {
    try {
      const response = await fetch(`/api/coupons/validate?code=${couponCode}&amount=${totalPrice}`)
      
      if (response.ok) {
        const result = await response.json()
        setCouponValidation({
          isValid: result.valid,
          discount: result.discount,
          message: result.message
        })
      } else {
        const errorResult = await response.json()
        setCouponValidation({
          isValid: false,
          message: errorResult.message || 'Invalid coupon code'
        })
      }
    } catch (err) {
      setCouponValidation({
        isValid: false,
        message: 'Failed to validate coupon. Please try again.'
      })
    }
  }

  const handleCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (coupon.trim()) {
      await validateCoupon(coupon.trim())
    }
  }

  // Generate product name from cart items
  const getProductName = () => {
    if (items.length === 0) return 'Sako Order'
    
    if (items.length === 1) {
      const item = items[0]
      return `${item.name[lng as 'en' | 'he']}${item.color ? ` - ${item.color}` : ''}`
    }
    
    if (items.length === 2) {
      const item1 = items[0]
      const item2 = items[1]
      return `${item1.name[lng as 'en' | 'he']}${item1.color ? ` - ${item1.color}` : ''} + ${item2.name[lng as 'en' | 'he']}${item2.color ? ` - ${item2.color}` : ''}`
    }
    
    // For 3+ items, show first item + count
    const firstItem = items[0]
    const remainingCount = items.length - 1
    return `${firstItem.name[lng as 'en' | 'he']}${firstItem.color ? ` - ${firstItem.color}` : ''} + ${remainingCount} ${isRTL ? 'עוד פריטים' : 'more items'}`
  }

  // Localized content
  const content = {
    en: {
      title: 'Checkout',
      subtitle: 'Complete your purchase',
      fromInstagram: 'Order from Instagram Shop',
      products: 'Products',
      quantity: 'Quantity',
      remove: 'Remove',
      subtotal: 'Subtotal',
      delivery: 'Delivery Fee',
      total: 'Total',
      checkout: 'Proceed to Checkout',
      clearCart: 'Clear Cart',
      items: 'items',
      item: 'item',
      freeDelivery: 'Free delivery on orders over ₪300',
      couponLabel: 'Coupon Code',
      couponPlaceholder: 'Enter coupon code',
      applyCoupon: 'Apply Coupon',
      couponApplied: 'Coupon Applied',
      invalidCoupon: 'Invalid Coupon',
      loadingProducts: 'Loading products...',
      errorLoading: 'Error loading products',
      noProducts: 'No products found',
      continueShopping: 'Continue Shopping'
    },
    he: {
      title: 'תשלום',
      subtitle: 'השלם את הרכישה',
      fromInstagram: 'הזמנה מחנות אינסטגרם',
      products: 'מוצרים',
      quantity: 'כמות',
      remove: 'הסר',
      subtotal: 'סכום ביניים',
      delivery: 'דמי משלוח',
      total: 'סה"כ',
      checkout: 'המשך לתשלום',
      clearCart: 'נקה עגלה',
      items: 'פריטים',
      item: 'פריט',
      freeDelivery: 'משלוח חינם בהזמנות מעל ₪300',
      couponLabel: 'קוד קופון',
      couponPlaceholder: 'הכנס קוד קופון',
      applyCoupon: 'החל קופון',
      couponApplied: 'קופון הוחל',
      invalidCoupon: 'קופון לא תקין',
      loadingProducts: 'טוען מוצרים...',
      errorLoading: 'שגיאה בטעינת מוצרים',
      noProducts: 'לא נמצאו מוצרים',
      continueShopping: 'המשך לקנות'
    }
  }

  const t = content[lng as keyof typeof content]

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient || loading) {
    return (
      <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-20 w-20 bg-gray-200 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalItems = getTotalItems()
  const totalPrice = getTotalPrice()
  const deliveryFee = getDeliveryFee()
  const totalWithDelivery = getTotalWithDelivery()

  return (
    <div className="min-h-screen bg-gray-50 pt-16" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center pt-1 pb-1">
                <ShoppingBagIcon className="h-8 w-8 text-indigo-600 mr-3 pt-1" />
                {t.title}
              </h1>
            </div>
          </div>
          <p className="text-gray-600 mt-2">{t.subtitle}</p>
          {urlProducts.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-blue-800 font-medium">{t.fromInstagram}</span>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoadingProducts && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-blue-800">{t.loadingProducts}</span>
            </div>
          </div>
        )}

        {/* Cart Content */}
        {items.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <ShoppingBagIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t.noProducts}
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {error || 'No products were found or loaded.'}
            </p>
            <Link
              href={`/${lng}`}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {t.continueShopping}
            </Link>
          </div>
        ) : (
          /* Cart Items */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items List */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={`${item.sku}-${item.size}-${item.color}-${index}`} className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center space-x-4">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        <Link href={`/${lng}/product/${item.sku}`}>
                          <div className="relative h-20 w-20 rounded-md overflow-hidden">
                            <Image
                              src={item.image || '/images/placeholder.svg'}
                              alt={item.name[lng as 'en' | 'he']}
                              fill
                              className="object-cover hover:scale-105 transition-transform duration-200"
                            />
                          </div>
                        </Link>
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/${lng}/product/${item.sku}`}>
                          <h3 className="text-lg font-medium text-gray-900 hover:text-indigo-600 line-clamp-2">
                            {item.name[lng as 'en' | 'he']}
                          </h3>
                        </Link>
                        
                        <div className="mt-1 text-sm text-gray-500">
                          {item.size && (
                            <span>{lng === 'he' ? 'מידה' : 'Size'}: {item.size}</span>
                          )}
                          {item.size && item.color && <span> • </span>}
                          {item.color && (
                            <span>{lng === 'he' ? 'צבע' : 'Color'}: {item.color}</span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg font-bold text-gray-900">
                            ₪{(item.salePrice || item.price).toFixed(2)}
                            </span>
                            {item.salePrice && item.salePrice < item.price && (
                              <span className="text-sm text-gray-500 line-through">
                                ₪{item.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex-shrink-0">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center border border-gray-600 rounded-md">
                            <button
                              onClick={() => updateQuantity(item.sku, item.quantity - 1, item.size, item.color)}
                              className="p-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
                              disabled={item.quantity <= 1}
                            >
                              <MinusIcon className="h-4 w-4" />
                            </button>
                            <span className="px-3 py-2 text-sm font-medium min-w-[3rem] text-center text-gray-700">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.sku, item.quantity + 1, item.size, item.color)}
                              className="p-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
                              disabled={item.quantity >= item.maxStock}
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          </div>
                          
                          {/* Remove Button */}
                          <button
                            onClick={() => removeFromCart(item.sku, item.size, item.color)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title={t.remove}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  {t.subtotal}
                </h2>
                
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={`${item.sku}-${item.size}-${item.color}-${index}`} className="flex justify-between text-sm">
                      <div className="text-gray-600">
                        <div className="font-medium">{item.name[lng as 'en' | 'he']}</div>
                        <div className="text-xs text-gray-500">
                          {item.size && (
                            <span>{lng === 'he' ? 'מידה' : 'Size'}: {item.size}</span>
                          )}
                          {item.size && item.color && <span> • </span>}
                          {item.color && (
                            <span>{lng === 'he' ? 'צבע' : 'Color'}: {item.color}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {lng === 'he' ? 'כמות' : 'Qty'}: {item.quantity}
                        </div>
                      </div>
                      <span className="font-medium text-gray-700">
                      ₪{((item.salePrice || item.price) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Coupon Section */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <form onSubmit={handleCouponSubmit} className="space-y-3">
                    <div>
                      <label htmlFor="coupon" className="block text-sm font-medium text-gray-700 mb-1">
                        {t.couponLabel}
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          id="coupon"
                          value={coupon}
                          onChange={(e) => setCoupon(e.target.value)}
                          placeholder={t.couponPlaceholder}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {t.applyCoupon}
                        </button>
                      </div>
                    </div>
                    {couponValidation.message && (
                      <div className={`text-sm ${couponValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                        {couponValidation.message}
                      </div>
                    )}
                  </form>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t.subtotal}</span>
                    <span>₪{totalPrice.toFixed(2)}</span>
                  </div>
                  
                  {couponValidation.isValid && couponValidation.discount && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-₪{(totalPrice * couponValidation.discount / 100).toFixed(2)}</span>
                    </div>
                  )}
                  
                  {deliveryFee > 0 ? (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{t.delivery}</span>
                      <span>₪{deliveryFee.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-green-600 font-medium">
                      {t.freeDelivery}
                    </div>
                  )}
                  
                  <div className="flex justify-between text-lg font-bold text-gray-700 border-t border-gray-200 pt-2">
                    <span>{t.total}</span>
                    <span>₪{totalWithDelivery.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="w-full mt-6 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {t.checkout}
                </button>

                <Link
                  href={`/${lng}`}
                  className="block w-full mt-3 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-center"
                >
                  {t.continueShopping}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        orderId={`ORDER-${Date.now()}`}
        amount={totalWithDelivery}
        currency="ILS"
        productName={getProductName()}
        productSku={items.length > 0 ? items[0].sku : 'UNKNOWN'}
        quantity={totalItems}
        language={lng as 'he' | 'en'}
      />
    </div>
  )
}
