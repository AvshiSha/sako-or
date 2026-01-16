'use client';

import { CartItem } from '../hooks/useCart';
import { getColorName } from '@/lib/colors';
import Accordion from './Accordion';

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  appliedCoupons: Array<{
    code: string;
    discountAmount: number;
    discountType: 'percent_all' | 'percent_specific' | 'fixed' | 'bogo';
    stackable: boolean;
    description?: string;
    discountLabel?: { en: string; he: string };
  }>;
  language: 'he' | 'en';
  showPromoCode?: boolean;
  onApplyCoupon?: (code: string) => void;
  onRemoveCoupon?: (code: string) => void;
  couponInput?: string;
  onCouponInputChange?: (value: string) => void;
  couponLoading?: boolean;
  couponStatus?: { type: 'success' | 'error' | 'info'; message: string } | null;
  pointsDiscount?: number;
}

export default function OrderSummary({
  items,
  subtotal,
  discountTotal,
  deliveryFee,
  appliedCoupons,
  language,
  showPromoCode = false,
  onApplyCoupon,
  onRemoveCoupon,
  couponInput = '',
  onCouponInputChange,
  couponLoading = false,
  couponStatus,
  pointsDiscount = 0
}: OrderSummaryProps) {
  const isHebrew = language === 'he';
  const isRTL = isHebrew;
  const discountedSubtotal = Math.max(subtotal - discountTotal - pointsDiscount, 0);
  const finalTotal = Math.max(discountedSubtotal + deliveryFee, 0);

  const couponStrings = {
    en: {
      label: 'Have a coupon code?',
      placeholder: 'Enter coupon',
      apply: 'Apply',
      remove: 'Remove',
    },
    he: {
      label: 'הכנס קוד קופון',
      placeholder: 'קוד קופון',
      apply: 'החל',
      remove: 'הסר',
    }
  }[language];

  const t = {
    subtotal: isHebrew ? 'סה"כ ביניים' : 'Subtotal',
    delivery: isHebrew ? 'משלוח' : 'Delivery',
    freeDelivery: isHebrew ? 'משלוח חינם' : 'Free delivery',
    total: isHebrew ? 'סה"כ' : 'Total',
    size: isHebrew ? 'מידה' : 'Size',
    color: isHebrew ? 'צבע' : 'Color',
    qty: isHebrew ? 'כמות' : 'Qty',
    subtotalAfterDiscounts: isHebrew ? 'סכום לאחר הנחות' : 'Subtotal after discounts',
  };

  const handleCouponSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (couponInput.trim() && onApplyCoupon) {
      onApplyCoupon(couponInput.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Items List */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${item.sku}-${item.size}-${item.color}-${index}`} className="flex justify-between text-sm">
            <div className="text-gray-600">
              <div className="font-medium">{item.name[language]}</div>
              <div className="text-xs text-gray-500">
                {item.size && (
                  <span>{t.size}: {item.size}</span>
                )}
                {item.size && item.color && <span> • </span>}
                {item.color && (
                  <span>{t.color}: {getColorName(item.color, language)}</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {t.qty}: {item.quantity}
              </div>
            </div>
            <span className="font-medium text-gray-700">
              ₪{((item.salePrice || item.price) * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Promo Code Accordion */}
      {showPromoCode && (
        <Accordion title={couponStrings.label}>
          <div dir={isRTL ? 'rtl' : 'ltr'}>
            <form onSubmit={handleCouponSubmit} className="space-y-2">
              <div className={`flex ${isRTL ? 'flex-row-reverse space-x-reverse' : 'flex-row'} items-center gap-2`}>
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => onCouponInputChange?.(e.target.value)}
                  placeholder={couponStrings.placeholder}
                  className={`flex-1 rounded-md border border-gray-300 text-gray-900 py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isRTL ? 'text-right' : 'text-left'}`}
                  disabled={couponLoading}
                />
                <button
                  type="submit"
                  disabled={couponLoading || !couponInput.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70"
                >
                  {couponLoading ? (isHebrew ? 'בודק...' : 'Checking...') : couponStrings.apply}
                </button>
              </div>
              {couponStatus && (
                <p className={`text-sm ${couponStatus.type === 'error' ? 'text-red-600' : couponStatus.type === 'success' ? 'text-green-600' : 'text-gray-600'}`}>
                  {couponStatus.message}
                </p>
              )}
            </form>

            {appliedCoupons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {appliedCoupons.map(coupon => (
                  <span
                    key={coupon.code}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700"
                  >
                    {coupon.code}
                    {onRemoveCoupon && (
                      <button
                        onClick={() => onRemoveCoupon(coupon.code)}
                        className={`${isRTL ? 'mr-2' : 'ml-2'} text-indigo-500 hover:text-indigo-700`}
                        aria-label={couponStrings.remove}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Accordion>
      )}

      {/* Totals */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{t.subtotal}</span>
          <span>₪{subtotal.toFixed(2)}</span>
        </div>

        {discountTotal > 0 && (
          <>
            {appliedCoupons.map(coupon => (
              <div key={coupon.code} className="flex justify-between text-xs text-green-600">
                <span>
                  {coupon.code}
                  {coupon.discountLabel && ` • ${coupon.discountLabel[language]}`}
                </span>
                <span>-₪{coupon.discountAmount.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm text-gray-600">
              <span>{t.subtotalAfterDiscounts}</span>
              <span>₪{discountedSubtotal.toFixed(2)}</span>
            </div>
          </>
        )}

        {pointsDiscount > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>{language === 'he' ? 'הנחת נקודות' : 'Points discount'}</span>
            <span>₪{pointsDiscount.toFixed(2)}</span>
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
          <span>₪{finalTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

