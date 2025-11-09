'use client'

import { useState } from 'react'
import { CouponCartItemInput, CouponValidationSuccess } from '@/lib/coupons'
import clsx from 'clsx'

interface CouponTestModalProps {
  isOpen: boolean
  couponCode: string
  onClose: () => void
  initialCartItems?: CouponCartItemInput[]
}

const sampleCart: CouponCartItemInput[] = [
  {
    sku: 'SKU-1001',
    quantity: 1,
    price: 250
  },
  {
    sku: 'SKU-1002',
    quantity: 2,
    price: 180
  }
]

const localeLabels = {
  en: {
    title: 'Test Coupon',
    description: 'Simulate the coupon against a sample cart to verify the discount logic.',
    cartItemsLabel: 'Cart items (JSON)',
    currencyLabel: 'Currency',
    localeLabel: 'Locale',
    userIdentifierLabel: 'User identifier (optional)',
    existingCodesLabel: 'Existing coupon codes (comma separated)',
    runTest: 'Run test',
    close: 'Close',
    resultTitle: 'Test result',
    discountAmount: 'Discount amount',
    newSubtotal: 'New subtotal',
    discountLabel: 'Discount label',
    affectedItems: 'Affected items',
    sku: 'SKU',
    quantity: 'Quantity',
    discount: 'Discount',
    errorParsing: 'Unable to parse cart items JSON.',
    noResult: 'No discount applied. Please review coupon conditions.'
  },
  he: {
    title: 'בדיקת קופון',
    description: 'הדמיית הקופון מול עגלת דוגמה כדי לוודא שהלוגיקה תקינה.',
    cartItemsLabel: 'פריטי עגלה (JSON)',
    currencyLabel: 'מטבע',
    localeLabel: 'שפה',
    userIdentifierLabel: 'מזהה משתמש (אופציונלי)',
    existingCodesLabel: 'קופונים קיימים (מופרדים בפסיקים)',
    runTest: 'הפעל בדיקה',
    close: 'סגור',
    resultTitle: 'תוצאות בדיקה',
    discountAmount: 'סכום ההנחה',
    newSubtotal: 'סכום חדש',
    discountLabel: 'תווית הנחה',
    affectedItems: 'פריטים שהושפעו',
    sku: 'מק״ט',
    quantity: 'כמות',
    discount: 'הנחה',
    errorParsing: 'לא ניתן לפענח את JSON של פריטי העגלה.',
    noResult: 'לא הוחלה הנחה. אנא בדוק את תנאי הקופון.'
  }
}

export function CouponTestModal({
  isOpen,
  couponCode,
  onClose,
  initialCartItems = sampleCart
}: CouponTestModalProps) {
  const [cartInput, setCartInput] = useState(() => JSON.stringify(initialCartItems, null, 2))
  const [currency, setCurrency] = useState('ILS')
  const [locale, setLocale] = useState<'en' | 'he'>('en')
  const [userIdentifier, setUserIdentifier] = useState('')
  const [existingCodes, setExistingCodes] = useState('')
  const [result, setResult] = useState<CouponValidationSuccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  if (!isOpen) {
    return null
  }

  const labels = localeLabels[locale]

  const handleRunTest = async () => {
    try {
      setError(null)
      setResult(null)
      setIsTesting(true)

      let parsedCart: CouponCartItemInput[]
      try {
        parsedCart = JSON.parse(cartInput)
        if (!Array.isArray(parsedCart)) {
          throw new Error('Cart items must be an array.')
        }
      } catch (parseError) {
        console.warn('[COUPON_TEST_PARSE_ERROR]', parseError)
        setError(labels.errorParsing)
        return
      }

      const response = await fetch('/api/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode,
          cartItems: parsedCart,
          currency,
          locale,
          userIdentifier: userIdentifier.trim() || undefined,
          existingCouponCodes: existingCodes
            .split(',')
            .map(code => code.trim())
            .filter(Boolean)
        })
      })

      const data = await response.json()
      if (data.success) {
        setResult(data as CouponValidationSuccess)
      } else {
        setError(data.messages?.[locale] ?? labels.noResult)
      }
    } catch (testError) {
      console.error('[COUPON_TEST_ERROR]', testError)
      setError(labels.noResult)
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{labels.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{labels.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label={labels.close}
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 py-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {labels.cartItemsLabel}
              </label>
              <textarea
                value={cartInput}
                onChange={(event) => setCartInput(event.target.value)}
                rows={12}
                className="mt-2 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.currencyLabel}
                </label>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="ILS">ILS (₪)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.localeLabel}
                </label>
                <select
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as 'en' | 'he')}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="en">English</option>
                  <option value="he">עברית</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {labels.userIdentifierLabel}
              </label>
              <input
                type="text"
                value={userIdentifier}
                onChange={(event) => setUserIdentifier(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {labels.existingCodesLabel}
              </label>
              <input
                type="text"
                value={existingCodes}
                onChange={(event) => setExistingCodes(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="SAVE10, SPRING25"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRunTest}
                disabled={isTesting}
                className={clsx(
                  'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
                  isTesting && 'opacity-75 cursor-not-allowed'
                )}
              >
                {isTesting ? 'Testing…' : labels.runTest}
              </button>
              {error && (
                <span className="text-sm text-red-600">{error}</span>
              )}
            </div>

            <div className="border border-dashed border-gray-300 rounded-lg p-4 min-h-[240px] bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                {labels.resultTitle}
              </h3>

              {result ? (
                <div className="mt-4 space-y-3 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>{labels.discountAmount}</span>
                    <span>
                      {result.discountAmount.toFixed(2)} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{labels.newSubtotal}</span>
                    <span>
                      {result.newSubtotal.toFixed(2)} {currency}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{labels.discountLabel}</p>
                    <p className="text-gray-600">
                      {result.coupon.discountLabel[locale]}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">{labels.affectedItems}</p>
                    <ul className="mt-2 space-y-2 text-gray-600">
                      {result.discountedItems.map(item => (
                        <li key={`${item.sku}-${item.quantity}`} className="flex justify-between">
                          <span>{labels.sku}: {item.sku}</span>
                          <span>{labels.quantity}: {item.quantity}</span>
                          <span>{labels.discount}: {item.discountAmount.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                    {result.messages[locale]}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">{labels.noResult}</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            {labels.close}
          </button>
        </div>
      </div>
    </div>
  )
}

