'use client'

import Image from 'next/image'
import { ShoppingBagIcon } from '@heroicons/react/24/outline'
import { profileTheme } from './profileTheme'
import { getColorName } from '@/lib/colors'

type OrderItem = {
  id: string
  productName: string
  productSku: string
  modelNumber: string | null
  colorName: string | null
  size: string | null
  quantity: number
  price: number
  salePrice: number | null
  total: number
  primaryImage: string | null
}

type AppliedCoupon = {
  code: string
  discountAmount: number
  discountType: string
  description: string | null
}

type Order = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  total: number
  currency: string
  subtotal: number | null
  discountTotal: number | null
  deliveryFee: number | null
  createdAt: string
  updatedAt: string
  orderItems: OrderItem[]
  appliedCoupons: AppliedCoupon[]
  pointsUsed: number | null
}

interface OrderHistoryProps {
  orders: Order[]
  loading?: boolean
  locale: string
  lng: 'en' | 'he'
  variant?: 'single' | 'list'
  translations: {
    orderHistory: string
    orderNumber: (n: string) => string
    orderDate: string
    noOrdersYet: string
    startShopping: string
    products: string
    quantity: string
    size: string
    price: string
    total: string
    subtotal: string
    shipping: string
    discount: string
    couponsApplied: string
    loyaltyPointsUsed: string
    modelNumber: string
    color: string
  }
}

export default function OrderHistory({
  orders,
  loading = false,
  locale,
  lng,
  variant = 'single',
  translations: t
}: OrderHistoryProps) {
  const isRTL = lng === 'he'
  const dir = isRTL ? 'rtl' : 'ltr'

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    })
  }

  const formatPrice = (price: number, currency: string = 'ILS') => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'ILS',
      minimumFractionDigits: 2
    }).format(price)
  }

  if (loading) {
    return (
      <div className={profileTheme.section} dir={dir}>
        <div className="animate-pulse space-y-4">
          {[...Array(variant === 'single' ? 1 : 3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className={profileTheme.section} dir={dir}>
        <div className="text-center py-8 text-gray-500">
          <ShoppingBagIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="mb-4">{t.noOrdersYet}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={profileTheme.section} dir={dir}>
      {variant === 'single' && orders.length > 0 && (
        <OrderCard
          order={orders[0]}
          formatDate={formatDate}
          formatPrice={formatPrice}
          isRTL={isRTL}
          translations={t}
          lng={lng}
        />
      )}

      {variant === 'list' && (
        <div className="space-y-8 md:space-y-10">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              formatDate={formatDate}
              formatPrice={formatPrice}
              isRTL={isRTL}
              translations={t}
              lng={lng}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderCard({
  order,
  formatDate,
  formatPrice,
  isRTL,
  translations: t,
  lng
}: {
  order: Order
  formatDate: (date: string) => string
  formatPrice: (price: number, currency?: string) => string
  isRTL: boolean
  translations: OrderHistoryProps['translations']
  lng: 'en' | 'he'
}) {
  const dir = isRTL ? 'rtl' : 'ltr'
  const textAlign = isRTL ? 'text-right' : 'text-left'
  const flexDirection = isRTL ? 'flex-row-reverse' : 'flex-row'
  // Price on outer side: right for LTR, left for RTL
  const priceAlign = isRTL ? 'text-right' : 'text-left'

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      {/* Order Header - Elegant and Spacious */}
      <div className={`px-6 py-5 ${flexDirection} justify-between items-start border-b`} style={{ borderColor: '#EFEFEF' }}>
        <div className={textAlign}>
          <p className="font-medium text-base tracking-tight uppercase" style={{ color: '#1C1C1C' }}>
            {t.orderNumber(order.orderNumber)}
          </p>
          <p className="text-xs mt-1 font-medium" style={{ color: '#8A8A8A' }}>
            {t.orderDate}: {formatDate(order.createdAt)}
          </p>
        </div>
        <div className={isRTL ? 'text-left' : 'text-right'}>
          <p className={`text-xs mt-1 font-medium capitalize ${isRTL ? 'text-right' : 'text-left'}`} style={{ color: order.status === 'completed' ? '#9CAF88' : '#8A8A8A' }}>
            {order.status}
          </p>
        </div>
      </div>

      {/* Two Column Layout: Products + Summary */}
      <div className={`px-6 py-8 lg:grid lg:gap-8 ${isRTL ? 'lg:grid-cols-[1fr_auto]' : 'lg:grid-cols-[1fr_auto]'}`} dir={dir}>
        {/* Main Column: Products List */}
        <div className={`${isRTL ? 'lg:order-1' : 'lg:order-1'}`}>
          <h4 className={`text-xs mt-1 font-medium uppercase tracking-wider mb-6 ${textAlign}`} style={{ color: '#8A8A8A' }}>
            {t.products}
          </h4>
          <div className="space-y-8">
            {order.orderItems.map((item) => {
              // Get translated color name using colors.ts
              const translatedColor = item.colorName ? getColorName(item.colorName, lng) : null
              // Use productSku as the SKU/model number
              const sku = item.productSku || item.modelNumber
              
              return (
                <div key={item.id} className={`${flexDirection} gap-6 ${order.orderItems.length > 1 ? 'pb-8 border-b last:border-0 last:pb-0' : ''}`} style={{ borderColor: '#EFEFEF' }}>
                  {/* Product Image - Catalog Style, Anchored to Outer Side */}
                  {item.primaryImage && (
                    <div className="relative w-36 h-36 md:w-40 md:h-40 flex-shrink-0 rounded-xl overflow-hidden" style={{ backgroundColor: '#FAFAFA' }}>
                      <Image
                        src={item.primaryImage}
                        alt={item.productName}
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                    </div>
                  )}

                  {/* Product Details - Vertically Stacked */}
                  <div className={`flex-1 min-w-0 ${textAlign} space-y-1.5`}>
                    {/* Product Name */}
                    <p className="font-normal text-base leading-relaxed" style={{ color: '#1C1C1C', fontWeight: 400 }}>
                      {item.productName}
                    </p>
                    
                    {/* SKU and Color - Stacked Vertically (SKU first) */}
                    {(sku || translatedColor) && (
                      <div className="space-y-0.5">
                        {sku && (
                          <p className="text-sm mt-0.5 font-medium" style={{ color: '#8A8A8A', fontWeight: 300 }}>
                            {t.modelNumber} {sku}
                          </p>
                        )}
                        {translatedColor && (
                          <p className="text-sm mt-0.5 font-medium" style={{ color: '#8A8A8A', fontWeight: 300 }}>
                            {t.color}: {translatedColor}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Size & Quantity - Stacked Vertically */}
                    <div className="space-y-0.5">
                      {item.size && (
                        <p className="text-sm mt-0.5 font-medium" style={{ color: '#8A8A8A', fontWeight: 300 }}>
                          {t.size} {item.size}
                        </p>
                      )}
                      <p className="text-sm mt-0.5 font-medium" style={{ color: '#8A8A8A', fontWeight: 300 }}>
                        {t.quantity} {item.quantity}
                      </p>
                    </div>
                  </div>

                  {/* Price - On Outer Side (Right for LTR, Left for RTL) */}
                  <div className={`flex-shrink-0 ${priceAlign}`}>
                    {item.salePrice && item.salePrice < item.price ? (
                      <div className="space-y-0.5">
                        <span className="text-xs line-through font-light block" style={{ color: '#8A8A8A' }}>
                          {formatPrice(item.price, order.currency)}
                        </span>
                        <span className="text-sm font-medium tracking-tight" style={{ color: '#1C1C1C', fontWeight: 500 }}>
                          {formatPrice(item.salePrice, order.currency)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-medium tracking-tight" style={{ color: '#1C1C1C', fontWeight: 500 }}>
                        {formatPrice(item.price, order.currency)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Side Column: Order Summary - Sticky on Desktop (Left for RTL, Right for LTR) */}
        <div className={`mt-8 lg:mt-4 ${isRTL ? 'lg:order-2' : 'lg:order-2'}`}>
          <div className="lg:sticky lg:top-6">
            <div className="bg-white rounded-lg p-12 -mx-6" style={{ border: '1px solid #EFEFEF' }}>
              <h4 className={`text-md font-medium uppercase tracking-wider mb-6  ${textAlign}`} style={{ color: '#8A8A8A' }}>
                {t.total}
              </h4>
              
              <div className={`space-y-3 ${textAlign}`}>
                {order.subtotal !== null && (
                  <div className={`${flexDirection} justify-between text-sm`}>
                    <span className="font-light" style={{ color: '#8A8A8A' }}>{t.subtotal}</span>
                    <span className="font-normal" style={{ color: '#1C1C1C', fontWeight: 500 }}>{formatPrice(order.subtotal, order.currency)}</span>
                  </div>
                )}

                <div className={`${flexDirection} justify-between text-sm`}>
                  <span className="font-light" style={{ color: '#8A8A8A' }}>{t.shipping}</span>
                  {order.deliveryFee !== null && order.deliveryFee > 0 ? (
                    <span className="font-normal" style={{ color: '#1C1C1C', fontWeight: 500 }}>{formatPrice(order.deliveryFee, order.currency)}</span>
                  ) : (
                    <span className="font-light" style={{ color: '#8A8A8A' }}>—</span>
                  )}
                </div>

                <div className={`${flexDirection} justify-between text-sm`}>
                  <span className="font-light" style={{ color: '#8A8A8A' }}>{t.couponsApplied}</span>
                  {order.appliedCoupons.length > 0 ? (
                    <span className="font-normal" style={{ color: '#1C1C1C', fontWeight: 500 }}>
                      {order.appliedCoupons.map((c, idx) => (
                        <span key={idx}>
                          {idx > 0 && ', '}
                          -{formatPrice(c.discountAmount, order.currency)}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="font-light" style={{ color: '#8A8A8A' }}>—</span>
                  )}
                </div>

                {order.discountTotal !== null && order.discountTotal > 0 && (
                  <div className={`${flexDirection} justify-between text-sm`}>
                    <span className="font-light" style={{ color: '#8A8A8A' }}>{t.discount}</span>
                    <span className="font-normal" style={{ color: '#1C1C1C', fontWeight: 500 }}>
                      -{formatPrice(order.discountTotal, order.currency)}
                    </span>
                  </div>
                )}

                <div className={`${flexDirection} justify-between text-sm`}>
                  <span className="font-light" style={{ color: '#8A8A8A' }}>{t.loyaltyPointsUsed}</span>
                  {order.pointsUsed !== null && order.pointsUsed > 0 ? (
                    <span className="font-normal" style={{ color: '#1C1C1C', fontWeight: 500 }}>{order.pointsUsed} {t.loyaltyPointsUsed.split(' ').slice(-1)[0]}</span>
                  ) : (
                    <span className="font-light" style={{ color: '#8A8A8A' }}>—</span>
                  )}
                </div>

                {/* Final Total - Thin Divider, Refined Emphasis */}
                <div className={`${flexDirection} justify-between pt-4 mt-4`} style={{ borderTop: '1px solid #EFEFEF' }}>
                  <span className="font-semibold text-base" style={{ color: '#1C1C1C' }}>{t.total}</span>
                  <span className="font-semibold text-base tracking-tight" style={{ color: '#1C1C1C', fontWeight: 600 }}>
                    {formatPrice(order.total, order.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
