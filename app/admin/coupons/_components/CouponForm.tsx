'use client'

import { useEffect, useMemo, useState } from 'react'
import { CouponDiscountType } from '@prisma/client'
import clsx from 'clsx'

type SupportedLocale = 'en' | 'he'

const uiText = {
  en: {
    localeToggleLabel: 'Preview language',
    code: 'Coupon Code',
    nameEn: 'Coupon Name (English)',
    nameHe: 'Coupon Name (Hebrew)',
    descriptionEn: 'Description (English)',
    descriptionHe: 'Description (Hebrew)',
    discountType: 'Discount Type',
    discountValue: 'Discount Value',
    minCartValue: 'Minimum Cart Value',
    usageLimit: 'Usage Limit (Global)',
    usageLimitPerUser: 'Usage Limit Per User',
    startDate: 'Start Date',
    endDate: 'End Date',
    stackable: 'Allow stacking with other coupons',
    autoApply: 'Auto-apply when eligible',
    eligibleProducts: 'Eligible Product SKUs (comma separated)',
    eligibleCategories: 'Eligible Categories (IDs or slugs, comma separated)',
    bogoBuyQuantity: 'BOGO: Buy Quantity',
    bogoGetQuantity: 'BOGO: Get Quantity Free',
    bogoEligibleSkus: 'BOGO Eligible SKUs (comma separated)',
    isActive: 'Coupon is active',
    submit: 'Save Coupon',
    test: 'Test Coupon',
    cancel: 'Cancel',
    discountTypePlaceholder: 'Select discount type',
    discountValuePlaceholder: 'Enter discount value',
    minCartValuePlaceholder: 'Enter minimum total required',
    usageLimitPlaceholder: 'Leave empty for unlimited',
    datetimePlaceholder: 'YYYY-MM-DDTHH:MM',
    previewTitle: 'Customer Preview',
    discountLabel: 'Discount Label',
    summaryTitle: 'Coupon Summary',
    stackableTooltip: 'Stackable coupons can be combined with other stackable coupons.',
    autoApplyTooltip: 'Auto-apply coupons are automatically added when the cart qualifies.',
    required: 'This field is required.',
    percentageHelper: 'For % discounts, enter value like 10 for 10%.',
    currencyHelper: 'For fixed discounts, enter value in ILS (e.g. 50).',
    bogoHelper: 'Configure buy/get quantities and eligible SKUs for BOGO offers.',
    generalError: 'Please review the highlighted fields.'
  },
  he: {
    localeToggleLabel: 'שפת תצוגה',
    code: 'קוד קופון',
    nameEn: 'שם הקופון (אנגלית)',
    nameHe: 'שם הקופון (עברית)',
    descriptionEn: 'תיאור (אנגלית)',
    descriptionHe: 'תיאור (עברית)',
    discountType: 'סוג הנחה',
    discountValue: 'ערך ההנחה',
    minCartValue: 'סכום עגלה מינימלי',
    usageLimit: 'מגבלת שימוש (כללית)',
    usageLimitPerUser: 'מגבלת שימוש למשתמש',
    startDate: 'תאריך התחלה',
    endDate: 'תאריך סיום',
    stackable: 'אפשר שילוב עם קופונים אחרים',
    autoApply: 'הפעל אוטומטית כאשר יש זכאות',
    eligibleProducts: 'מק"טים זכאים (מופרדים בפסיקים)',
    eligibleCategories: 'קטגוריות זכאיות (מזהים או סלאגים, מופרדים בפסיקים)',
    bogoBuyQuantity: 'מבצע 1+1: כמות לקנייה',
    bogoGetQuantity: 'מבצע 1+1: כמות במתנה',
    bogoEligibleSkus: 'מק"טים למבצע 1+1 (מופרדים בפסיקים)',
    isActive: 'הקופון פעיל',
    submit: 'שמור קופון',
    test: 'בדוק קופון',
    cancel: 'ביטול',
    discountTypePlaceholder: 'בחר סוג הנחה',
    discountValuePlaceholder: 'הזן ערך הנחה',
    minCartValuePlaceholder: 'הזן סכום נדרש',
    usageLimitPlaceholder: 'השאר ריק ללא הגבלה',
    datetimePlaceholder: 'YYYY-MM-DDTHH:MM',
    previewTitle: 'תצוגה מקדימה ללקוח',
    discountLabel: 'תווית ההנחה',
    summaryTitle: 'תקציר הקופון',
    stackableTooltip: 'קופון שניתן לשילוב יכול לפעול עם קופונים נוספים הניתנים לשילוב.',
    autoApplyTooltip: 'קופון אוטומטי מופעל לבד כאשר העגלה עומדת בתנאים.',
    required: 'שדה זה חובה.',
    percentageHelper: 'להנחות באחוזים, הזן ערך כמו 10 עבור 10%.',
    currencyHelper: 'להנחות קבועות, הזן ערך בש״ח (למשל 50).',
    bogoHelper: 'הגדר כמות קנייה/קבלה ומק"טים זכאים למבצע 1+1.',
    generalError: 'אנא בדוק את השדות המסומנים.'
  }
}

const discountTypeOptions: { value: CouponDiscountType; label: CouponLabel }[] = [
  {
    value: 'percent_all',
    label: {
      en: 'Percentage off entire cart',
      he: 'הנחה באחוזים על כל העגלה'
    }
  },
  {
    value: 'percent_specific',
    label: {
      en: 'Percentage off specific items/categories',
      he: 'הנחה באחוזים על פריטים/קטגוריות מסוימים'
    }
  },
  {
    value: 'fixed',
    label: {
      en: 'Fixed amount off',
      he: 'הנחה בסכום קבוע'
    }
  },
  {
    value: 'bogo',
    label: {
      en: 'Buy X Get Y (BOGO)',
      he: 'מבצע קנה X קבל Y'
    }
  }
]

type CouponLabel = {
  en: string
  he: string
}

export interface CouponFormValues {
  code: string
  name_en: string
  name_he: string
  description_en: string
  description_he: string
  discountType: CouponDiscountType
  discountValue: string
  minCartValue: string
  usageLimit: string
  usageLimitPerUser: string
  startDate: string
  endDate: string
  stackable: boolean
  autoApply: boolean
  eligibleProducts: string
  eligibleCategories: string
  bogoBuyQuantity: string
  bogoGetQuantity: string
  bogoEligibleSkus: string
  isActive: boolean
}

interface CouponFormProps {
  initialValues: CouponFormValues
  onSubmit: (values: CouponFormValues) => Promise<void>
  onCancel?: () => void
  onTest?: (values: CouponFormValues) => void
  submitLabel?: string
  heading?: string
  mode?: 'create' | 'edit'
}

type FormErrors = Partial<Record<keyof CouponFormValues, string>>

const defaultValues: CouponFormValues = {
  code: '',
  name_en: '',
  name_he: '',
  description_en: '',
  description_he: '',
  discountType: 'percent_all',
  discountValue: '',
  minCartValue: '',
  usageLimit: '',
  usageLimitPerUser: '',
  startDate: '',
  endDate: '',
  stackable: false,
  autoApply: false,
  eligibleProducts: '',
  eligibleCategories: '',
  bogoBuyQuantity: '',
  bogoGetQuantity: '',
  bogoEligibleSkus: '',
  isActive: true
}

function formatDatetimeLocal(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString()
  return iso.slice(0, 16)
}

function currencySymbol(): string {
  return '₪'
}

export function CouponForm({
  initialValues,
  onSubmit,
  onCancel,
  onTest,
  submitLabel,
  heading,
  mode = 'create'
}: CouponFormProps) {
  const [values, setValues] = useState<CouponFormValues>({ ...defaultValues, ...initialValues })
  const [errors, setErrors] = useState<FormErrors>({})
  const [formLocale, setFormLocale] = useState<SupportedLocale>('en')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    setValues({
      ...defaultValues,
      ...initialValues,
      startDate: formatDatetimeLocal(initialValues.startDate),
      endDate: formatDatetimeLocal(initialValues.endDate)
    })
  }, [initialValues])

  const labels = uiText[formLocale]
  const dir = formLocale === 'he' ? 'rtl' : 'ltr'

  const previewData = useMemo(() => {
    const discountValueNumber = Number(values.discountValue) || 0
    let discountLabel: CouponLabel

    switch (values.discountType) {
      case 'percent_all':
      case 'percent_specific':
        discountLabel = {
          en: `${discountValueNumber}% OFF`,
          he: `${discountValueNumber}% הנחה`
        }
        break
      case 'fixed':
        discountLabel = {
          en: `${currencySymbol()}${discountValueNumber} off`,
          he: `${currencySymbol()}${discountValueNumber} הנחה`
        }
        break
      case 'bogo': {
        const buyQty = Number(values.bogoBuyQuantity) || 1
        const getQty = Number(values.bogoGetQuantity) || 1
        discountLabel = {
          en: `Buy ${buyQty}, get ${getQty} free`,
          he: `קנה ${buyQty}, קבל ${getQty} חינם`
        }
        break
      }
      default:
        discountLabel = {
          en: 'Coupon',
          he: 'קופון'
        }
    }

    return {
      name: {
        en: values.name_en || 'Untitled coupon',
        he: values.name_he || 'קופון ללא שם'
      },
      description: {
        en: values.description_en || '',
        he: values.description_he || ''
      },
      discountLabel
    }
  }, [
    values.discountValue,
    values.discountType,
    values.name_en,
    values.name_he,
    values.description_en,
    values.description_he,
    values.bogoBuyQuantity,
    values.bogoGetQuantity
  ])

  const handleChange = <K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) => {
    setValues(prev => ({
      ...prev,
      [key]: value
    }))
    setErrors(prev => ({
      ...prev,
      [key]: undefined
    }))
  }

  const validate = (): boolean => {
    const validationErrors: FormErrors = {}

    if (!values.code.trim()) {
      validationErrors.code = labels.required
    }
    if (!values.name_en.trim()) {
      validationErrors.name_en = labels.required
    }
    if (!values.name_he.trim()) {
      validationErrors.name_he = labels.required
    }

    if (values.discountType === 'percent_all' || values.discountType === 'percent_specific') {
      const percent = Number(values.discountValue)
      if (!percent || percent <= 0) {
        validationErrors.discountValue = labels.percentageHelper
      }
    }

    if (values.discountType === 'fixed') {
      const amount = Number(values.discountValue)
      if (!amount || amount <= 0) {
        validationErrors.discountValue = labels.currencyHelper
      }
    }

    if (values.discountType === 'bogo') {
      const buyQty = Number(values.bogoBuyQuantity)
      const getQty = Number(values.bogoGetQuantity)

      if (!buyQty || buyQty <= 0) {
        validationErrors.bogoBuyQuantity = labels.required
      }
      if (!getQty || getQty <= 0) {
        validationErrors.bogoGetQuantity = labels.required
      }
    }

    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError(labels.generalError)
      return false
    }

    setSubmitError(null)
    return true
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) {
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit(values)
      setSubmitError(null)
    } catch (submitErr) {
      console.error('[COUPON_FORM_SUBMIT_ERROR]', submitErr)
      const message = submitErr instanceof Error ? submitErr.message : uiText.en.generalError
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const showBogoFields = values.discountType === 'bogo'
  const showSpecificFields = values.discountType === 'percent_specific' || values.discountType === 'bogo'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          {heading && (
            <h1 className="text-2xl font-semibold text-gray-900">{heading}</h1>
          )}
          <p className="text-gray-500 mt-1">
            {formLocale === 'he'
              ? 'נהל פרטי קופון לרכישות באתר'
              : 'Manage coupon details for store promotions'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">{labels.localeToggleLabel}</span>
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => setFormLocale('en')}
              className={clsx(
                'px-3 py-1 text-sm font-medium border border-gray-300 first:rounded-l-md last:rounded-r-md',
                formLocale === 'en' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setFormLocale('he')}
              className={clsx(
                'px-3 py-1 text-sm font-medium border border-gray-300 first:rounded-l-md last:rounded-r-md',
                formLocale === 'he' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              HE
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section
            dir={dir}
            className={clsx('bg-white shadow-sm rounded-lg p-6 space-y-6', formLocale === 'he' ? 'text-right' : 'text-left')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.code}
                </label>
                <input
                  type="text"
                  value={values.code}
                  onChange={(event) => handleChange('code', event.target.value)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    errors.code && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.code}
                  required
                  autoComplete="off"
                />
                {errors.code && (
                  <p className="mt-1 text-sm text-red-600">{errors.code}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.discountType}
                </label>
                <select
                  value={values.discountType}
                  onChange={(event) => handleChange('discountType', event.target.value as CouponDiscountType)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                >
                  <option value="" disabled>
                    {labels.discountTypePlaceholder}
                  </option>
                  {discountTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label[formLocale]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.discountValue}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={values.discountValue}
                  onChange={(event) => handleChange('discountValue', event.target.value)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    errors.discountValue && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.discountValuePlaceholder}
                />
                {errors.discountValue && (
                  <p className="mt-1 text-sm text-red-600">{errors.discountValue}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.minCartValue}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={values.minCartValue}
                  onChange={(event) => handleChange('minCartValue', event.target.value)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.minCartValuePlaceholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.usageLimit}
                </label>
                <input
                  type="number"
                  value={values.usageLimit}
                  onChange={(event) => handleChange('usageLimit', event.target.value)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.usageLimitPlaceholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.usageLimitPerUser}
                </label>
                <input
                  type="number"
                  value={values.usageLimitPerUser}
                  onChange={(event) => handleChange('usageLimitPerUser', event.target.value)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.usageLimitPlaceholder}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.startDate}
                </label>
                <input
                  type="datetime-local"
                  value={values.startDate}
                  onChange={(event) => handleChange('startDate', event.target.value)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.datetimePlaceholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.endDate}
                </label>
                <input
                  type="datetime-local"
                  value={values.endDate}
                  onChange={(event) => handleChange('endDate', event.target.value)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.datetimePlaceholder}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.nameEn}
                </label>
                <input
                  type="text"
                  value={values.name_en}
                  onChange={(event) => handleChange('name_en', event.target.value)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    errors.name_en && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.nameEn}
                />
                {errors.name_en && (
                  <p className="mt-1 text-sm text-red-600">{errors.name_en}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {labels.nameHe}
                </label>
                <input
                  type="text"
                  value={values.name_he}
                  onChange={(event) => handleChange('name_he', event.target.value)}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    errors.name_he && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.nameHe}
                />
                {errors.name_he && (
                  <p className="mt-1 text-sm text-red-600">{errors.name_he}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700">
                  {labels.descriptionEn}
                </label>
                <textarea
                  value={values.description_en}
                  onChange={(event) => handleChange('description_en', event.target.value)}
                  rows={3}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.descriptionEn}
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700">
                  {labels.descriptionHe}
                </label>
                <textarea
                  value={values.description_he}
                  onChange={(event) => handleChange('description_he', event.target.value)}
                  rows={3}
                  className={clsx(
                    'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                    formLocale === 'he' ? 'text-right' : 'text-left'
                  )}
                  placeholder={labels.descriptionHe}
                />
              </div>
            </div>

            {showSpecificFields && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {labels.eligibleProducts}
                  </label>
                  <textarea
                    value={values.eligibleProducts}
                    onChange={(event) => handleChange('eligibleProducts', event.target.value)}
                    rows={2}
                    className={clsx(
                      'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                      formLocale === 'he' ? 'text-right' : 'text-left'
                    )}
                    placeholder="SKU-1001, SKU-1002"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {labels.eligibleCategories}
                  </label>
                  <textarea
                    value={values.eligibleCategories}
                    onChange={(event) => handleChange('eligibleCategories', event.target.value)}
                    rows={2}
                    className={clsx(
                      'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                      formLocale === 'he' ? 'text-right' : 'text-left'
                    )}
                    placeholder="heels, boots, accessories"
                  />
                </div>
              </div>
            )}

            {showBogoFields && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">{labels.bogoHelper}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {labels.bogoBuyQuantity}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={values.bogoBuyQuantity}
                      onChange={(event) => handleChange('bogoBuyQuantity', event.target.value)}
                      className={clsx(
                        'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                        errors.bogoBuyQuantity && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                        formLocale === 'he' ? 'text-right' : 'text-left'
                      )}
                      placeholder="1"
                    />
                    {errors.bogoBuyQuantity && (
                      <p className="mt-1 text-sm text-red-600">{errors.bogoBuyQuantity}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {labels.bogoGetQuantity}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={values.bogoGetQuantity}
                      onChange={(event) => handleChange('bogoGetQuantity', event.target.value)}
                      className={clsx(
                        'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                        errors.bogoGetQuantity && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                        formLocale === 'he' ? 'text-right' : 'text-left'
                      )}
                      placeholder="1"
                    />
                    {errors.bogoGetQuantity && (
                      <p className="mt-1 text-sm text-red-600">{errors.bogoGetQuantity}</p>
                    )}
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">
                      {labels.bogoEligibleSkus}
                    </label>
                    <textarea
                      value={values.bogoEligibleSkus}
                      onChange={(event) => handleChange('bogoEligibleSkus', event.target.value)}
                      rows={2}
                      className={clsx(
                        'mt-1 block w-full rounded-md border-gray-300 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                        formLocale === 'he' ? 'text-right' : 'text-left'
                      )}
                      placeholder="SKU-1001, SKU-1002"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section
            dir={dir}
            className={clsx('bg-white shadow-sm rounded-lg p-6 space-y-4', formLocale === 'he' ? 'text-right' : 'text-left')}
          >
            <h2 className="text-lg font-semibold text-gray-900">{labels.summaryTitle}</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>{labels.discountType}</span>
                <span>{discountTypeOptions.find(option => option.value === values.discountType)?.label[formLocale]}</span>
              </div>
              {values.discountValue && (
                <div className="flex justify-between">
                  <span>{labels.discountValue}</span>
                  <span>{values.discountValue}</span>
                </div>
              )}
              {values.minCartValue && (
                <div className="flex justify-between">
                  <span>{labels.minCartValue}</span>
                  <span>{currencySymbol()}{values.minCartValue}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{labels.stackable}</span>
                <span>{values.stackable ? (formLocale === 'he' ? 'כן' : 'Yes') : (formLocale === 'he' ? 'לא' : 'No')}</span>
              </div>
              <div className="flex justify-between">
                <span>{labels.autoApply}</span>
                <span>{values.autoApply ? (formLocale === 'he' ? 'כן' : 'Yes') : (formLocale === 'he' ? 'לא' : 'No')}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900">{labels.previewTitle}</h2>
            <div className="mt-4 space-y-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-gray-500 uppercase tracking-wide">{labels.discountLabel}</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">{previewData.discountLabel.en}</p>
                <p className="mt-1 text-gray-600">{previewData.name.en}</p>
                {previewData.description.en && (
                  <p className="mt-2 text-sm text-gray-500">{previewData.description.en}</p>
                )}
              </div>
              <div className="border rounded-lg p-4" dir="rtl">
                <p className="text-sm text-gray-500 uppercase tracking-wide">{labels.discountLabel}</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">{previewData.discountLabel.he}</p>
                <p className="mt-1 text-gray-600">{previewData.name.he}</p>
                {previewData.description.he && (
                  <p className="mt-2 text-sm text-gray-500">{previewData.description.he}</p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white shadow-sm rounded-lg p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-1">
                <label className="inline-flex items-start">
                  <input
                    type="checkbox"
                    checked={values.stackable}
                    onChange={(event) => handleChange('stackable', event.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-1"
                    title={labels.stackableTooltip}
                  />
                  <span className="ml-2 text-sm text-gray-700">{labels.stackable}</span>
                </label>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-1">
                <label className="inline-flex items-start">
                  <input
                    type="checkbox"
                    checked={values.autoApply}
                    onChange={(event) => handleChange('autoApply', event.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-1"
                    title={labels.autoApplyTooltip}
                  />
                  <span className="ml-2 text-sm text-gray-700">{labels.autoApply}</span>
                </label>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-1">
                <label className="inline-flex items-start">
                  <input
                    type="checkbox"
                    checked={values.isActive}
                    onChange={(event) => handleChange('isActive', event.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-1"
                  />
                  <span className="ml-2 text-sm text-gray-700">{labels.isActive}</span>
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className={clsx(
              'inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
              isSubmitting && 'opacity-75 cursor-not-allowed'
            )}
          >
            {isSubmitting ? 'Saving…' : (submitLabel ?? labels.submit)}
          </button>
          {onTest && (
            <button
              type="button"
              onClick={() => onTest(values)}
              className="inline-flex items-center px-4 py-2 border border-indigo-200 text-sm font-medium rounded-md text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {labels.test}
            </button>
          )}
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            {labels.cancel}
          </button>
        )}
      </div>
    </form>
  )
}

