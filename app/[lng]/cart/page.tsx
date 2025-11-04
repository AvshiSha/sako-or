'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ShoppingBagIcon,
  TrashIcon,
  MinusIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { useCart } from '@/app/hooks/useCart'
import CheckoutModal from '@/app/components/CheckoutModal'
import { trackViewCart } from '@/lib/dataLayer'

export default function CartPage() {
  const params = useParams()
  const lng = params?.lng as string || 'en'
  const isRTL = lng === 'he'
  
  const { 
    items, 
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
      title: 'Shopping Cart',
      emptyTitle: 'Your cart is empty',
      emptyDescription: 'Looks like you haven\'t added any items to your cart yet.',
      emptyButton: 'Continue Shopping',
      quantity: 'Quantity',
      remove: 'Remove',
      subtotal: 'Subtotal',
      delivery: 'Delivery Fee',
      total: 'Total',
      checkout: 'Proceed to Checkout',
      clearCart: 'Clear Cart',
      items: 'items',
      item: 'item',
      freeDelivery: 'Free delivery on orders over ₪300'
    },
    he: {
      title: 'עגלת קניות',
      emptyTitle: 'העגלה שלך ריקה',
      emptyDescription: 'נראה שעדיין לא הוספת פריטים לעגלה.',
      emptyButton: 'המשך לקנות',
      quantity: 'כמות',
      remove: 'הסר',
      subtotal: 'סכום ביניים',
      delivery: 'דמי משלוח',
      total: 'סה"כ',
      checkout: 'המשך לתשלום',
      clearCart: 'נקה עגלה',
      items: 'פריטים',
      item: 'פריט',
      freeDelivery: 'משלוח חינם בהזמנות מעל ₪300'
    }
  }

  const t = content[lng as keyof typeof content]

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Track view_cart event
  useEffect(() => {
    if (!isClient || loading || items.length === 0) return

    try {
      const cartItems = items.map(item => ({
        name: item.name[lng as 'en' | 'he'] || 'Unknown Product',
        id: item.sku,
        price: item.salePrice || item.price,
        brand: undefined, // Cart items don't have brand info, can be enhanced later
        categories: undefined, // Cart items don't have category info, can be enhanced later
        variant: [item.size, item.color].filter(Boolean).join('-') || undefined,
        quantity: item.quantity
      }))

      trackViewCart(cartItems, 'ILS')
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError)
    }
  }, [isClient, loading, items, lng])

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
          {items.length > 0 && (
            <p className="text-gray-600 mt-2">
              {totalItems} {totalItems === 1 ? t.item : t.items}
            </p>
          )}
        </div>

        {/* Cart Content */}
        {items.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <ShoppingBagIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
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

                <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t.subtotal}</span>
                    <span>₪{totalPrice.toFixed(2)}</span>
                  </div>
                  
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
                  {t.emptyButton}
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
        items={items}
      />
    </div>
  )
}
