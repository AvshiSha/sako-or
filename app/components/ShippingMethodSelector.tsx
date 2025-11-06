'use client'

import { useEffect } from 'react'
import { useCart } from '@/app/hooks/useCart'
import { FulfillmentMethod } from '@/app/types/fulfillment'
import clsx from 'clsx'

declare global {
  interface Window {
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
  }
}

interface ShippingMethodSelectorProps {
  language?: 'he' | 'en'
}

// Pickup location details - UPDATE with actual address
const PICKUP_LOCATION_EN = {
  name: 'Sako-Or, Rishon LeZion',
  address: 'Rothchild 51, Rishon Lezion', // TODO: Update to actual address
  notes: 'Please bring ID when collecting your order',
  etaBusinessDays: [1, 2] as [number, number]
}

const PICKUP_LOCATION_HE = {
  name: 'סכו עור, ראשון לציון',
  address: 'רחוב רוטשילד 51, ראשון לציון', // TODO: Update to actual address
  notes: 'נא להגיע עם תעודת זהות בעת איסוף ההזמנה',
  etaBusinessDays: [1, 2] as [number, number]
}

export default function ShippingMethodSelector({ language = 'en' }: ShippingMethodSelectorProps) {
  const { getTotalPrice, fulfillment, setFulfillment, getDeliveryFee } = useCart()
  
  const isRTL = language === 'he'
  const isHebrew = language === 'he'
  const subtotal = getTotalPrice()
  const shippingCost = getDeliveryFee()
  
  // Translations
  const t = {
    title: isHebrew ? 'איך תרצי/ה לקבל את ההזמנה?' : 'How would you like to receive your order?',
    delivery: {
      title: isHebrew ? 'משלוח' : 'Delivery',
      subtitle: isHebrew ? 'מגיע תוך 3–5 ימי עסקים' : 'Arrives in 3–5 business days',
      price: isHebrew 
        ? (subtotal < 300 ? '₪45 להזמנות מתחת ל-₪300' : 'חינם מהזמנה של ₪300 ומעלה')
        : (subtotal < 300 ? '₪45 for orders under ₪300' : 'Free from ₪300'),
      fullPrice: isHebrew
        ? '₪45 להזמנות מתחת ל-₪300 · חינם מהזמנה של ₪300 ומעלה'
        : '₪45 for orders under ₪300 · Free from ₪300'
    },
    pickup: {
      title: isHebrew ? 'איסוף מהחנות' : 'In-Store Pickup',
      subtitle: isHebrew ? 'מוכן תוך 1–2 ימי עסקים בסניף שלנו' : 'Ready in 1–2 business days at our store',
      price: isHebrew ? 'חינם' : 'Free',
      locationTitle: isHebrew ? 'נקודת איסוף' : 'Pickup location',
      address: isHebrew 
        ? `סכו עור, ראשון לציון (כתובת: ${PICKUP_LOCATION_HE.address})`
        : `Sako-Or, Rishon LeZion (Address: ${PICKUP_LOCATION_EN.address})`,
    }
  }

  // Shipping cost is already computed in the hook

  // Track shipping option selection
  const handleFulfillmentChange = (method: FulfillmentMethod) => {
    console.log('[ShippingMethodSelector] handleFulfillmentChange called with method:', method);
    console.log('[ShippingMethodSelector] Current fulfillment before change:', fulfillment);
    console.log('[ShippingMethodSelector] Current shippingCost before change:', shippingCost);
    setFulfillment(method)
    console.log('[ShippingMethodSelector] setFulfillment called with:', method);
    // Get the updated shipping cost after setting fulfillment
    const updatedShippingCost = getDeliveryFee();
    console.log('[ShippingMethodSelector] Updated shippingCost after setFulfillment:', updatedShippingCost);
    
    // Track analytics event
    try {
      // GA4 dataLayer event
      if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push({
          event: 'shipping_option_selected',
          method: method,
          value: updatedShippingCost,
          currency: 'ILS',
          cart_value: subtotal
        })
      }

      // Meta Pixel event
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'AddPaymentInfo', {
          content_name: 'Shipping Method',
          content_category: method,
          value: shippingCost,
          currency: 'ILS'
        })
      }
    } catch (error) {
      console.warn('Analytics tracking error:', error)
    }
  }

  // Only show if feature flag is enabled (default to true)
  const featureEnabled = process.env.NEXT_PUBLIC_FEATURE_PICKUP !== 'false'

  if (!featureEnabled) {
    return null
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-4 md:p-6 space-y-4 bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <h3 className="text-lg font-semibold text-gray-900">
        {t.title}
      </h3>
      
      <div className="grid gap-3 md:grid-cols-2">
        {/* Delivery Option */}
        <button
          type="button"
          onClick={() => handleFulfillmentChange('delivery')}
          aria-pressed={fulfillment === 'delivery'}
          className={clsx(
            "w-full rounded-2xl border-2 p-4 text-left transition-all",
            fulfillment === 'delivery' 
              ? "ring-2 ring-black border-black shadow-md" 
              : "border-gray-300 hover:border-black/40 hover:shadow-sm"
          )}
          data-cy="choose-delivery"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-medium text-gray-900">
              {t.delivery.title}
            </span>
            <input 
              type="radio" 
              readOnly 
              checked={fulfillment === 'delivery'} 
              className="w-4 h-4 text-black focus:ring-black"
            />
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {t.delivery.subtitle}
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {t.delivery.price}
          </p>
        </button>

        {/* Pickup Option */}
        <button
          type="button"
          onClick={() => handleFulfillmentChange('pickup')}
          aria-pressed={fulfillment === 'pickup'}
          className={clsx(
            "w-full rounded-2xl border-2 p-4 text-left transition-all",
            fulfillment === 'pickup' 
              ? "ring-2 ring-black border-black shadow-md" 
              : "border-gray-300 hover:border-black/40 hover:shadow-sm"
          )}
          data-cy="choose-pickup"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-medium text-gray-900">
              {t.pickup.title}
            </span>
            <input 
              type="radio" 
              readOnly 
              checked={fulfillment === 'pickup'} 
              className="w-4 h-4 text-black focus:ring-black"
            />
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {t.pickup.subtitle}
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {t.pickup.price}
          </p>
        </button>
      </div>

      {/* Pickup Location Info */}
      {fulfillment === 'pickup' && (
        <div className="rounded-xl bg-black/[0.03] p-4 mt-4">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {t.pickup.locationTitle}
          </p>
          <p className="text-sm text-gray-700 mb-2">
            {t.pickup.address}
          </p>
          {PICKUP_LOCATION_HE.notes && (
            <p className="text-xs text-gray-600 mt-2">
              {PICKUP_LOCATION_HE.notes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

