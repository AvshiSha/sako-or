import { prisma } from './prisma'
import { Coupon, CouponDiscountType } from '@prisma/client'
import { productService, Product } from './firebase'

export type SupportedLocale = 'en' | 'he'

export interface CouponCartItemInput {
  sku: string
  quantity: number
  price: number
  salePrice?: number | null
  color?: string | null
  size?: string | null
}

export interface CouponValidationInput {
  code: string
  cartItems: CouponCartItemInput[]
  locale?: SupportedLocale
  currency?: string
  userIdentifier?: string | null
  existingCouponCodes?: string[]
}

export interface CouponDiscountedItem {
  sku: string
  quantity: number
  unitPrice: number
  discountAmount: number
}

export interface CouponLabel {
  en: string
  he: string
}

export interface CouponValidationSuccess {
  success: true
  coupon: {
    id: string
    code: string
    name: {
      en: string
      he: string
    }
    description: {
      en?: string | null
      he?: string | null
    }
    discountType: CouponDiscountType
    discountValue?: number | null
    discountAmount: number
    discountLabel: CouponLabel
    stackable: boolean
    minCartValue?: number | null
    autoApply: boolean
  }
  subtotal: number
  newSubtotal: number
  discountAmount: number
  discountedItems: CouponDiscountedItem[]
  messages: CouponLabel
  warnings: CouponLabel[]
}

export interface CouponValidationFailure {
  success: false
  code:
    | 'COUPON_NOT_FOUND'
    | 'COUPON_INACTIVE'
    | 'COUPON_EXPIRED'
    | 'COUPON_USAGE_EXCEEDED'
    | 'COUPON_USAGE_PER_USER_EXCEEDED'
    | 'MIN_CART_VALUE_NOT_MET'
    | 'COUPON_NOT_APPLICABLE'
    | 'STACKING_CONFLICT'
    | 'MISSING_USER_IDENTIFIER'
    | 'UNKNOWN_ERROR'
  messages: CouponLabel
  details?: Record<string, unknown>
}

export type CouponValidationResult = CouponValidationSuccess | CouponValidationFailure

const DEFAULT_LOCALE: SupportedLocale = 'en'

const currencySymbols: Record<string, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€'
}

function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase()
}

function normalizeString(value: string | null | undefined): string | null {
  if (!value) return null
  return value.trim().toLowerCase()
}

function getUnitPrice(item: CouponCartItemInput): number {
  const sale = typeof item.salePrice === 'number' ? item.salePrice : null
  if (sale !== null && sale >= 0) {
    return sale
  }
  return item.price
}

function calculateSubtotal(cartItems: CouponCartItemInput[]): number {
  return cartItems.reduce((total, item) => {
    const unitPrice = getUnitPrice(item)
    const quantity = Math.max(item.quantity, 0)
    return total + unitPrice * quantity
  }, 0)
}

function buildMessage(en: string, he: string): CouponLabel {
  return { en, he }
}

function getCouponLabel(
  coupon: Coupon,
  currency: string
): CouponLabel {
  const symbol = currencySymbols[currency] ?? currencySymbols.ILS

  switch (coupon.discountType) {
    case 'percent_all':
    case 'percent_specific': {
      const percentage = coupon.discountValue ?? 0
      return {
        en: `${percentage}% OFF`,
        he: `${percentage}% הנחה`
      }
    }
    case 'fixed': {
      const amount = coupon.discountValue ?? 0
      return {
        en: `${symbol}${amount} off`,
        he: `${symbol}${amount} הנחה`
      }
    }
    case 'bogo': {
      const buy = coupon.bogoBuyQuantity ?? 1
      const get = coupon.bogoGetQuantity ?? 1
      return {
        en: `Buy ${buy}, get ${get} free`,
        he: `קנה ${buy}, קבל ${get} חינם`
      }
    }
    default:
      return {
        en: 'Coupon applied',
        he: 'קופון הופעל'
      }
  }
}

async function loadProductMap(
  skus: string[]
): Promise<Map<string, Product | null>> {
  const uniqueSkus = Array.from(new Set(skus.filter(Boolean)))
  const productMap = new Map<string, Product | null>()

  await Promise.all(
    uniqueSkus.map(async (sku) => {
      try {
        const product = await productService.getProductBySku(sku)
        productMap.set(sku, product)
      } catch (error) {
        console.warn(`Failed to load product for SKU ${sku}:`, error)
        productMap.set(sku, null)
      }
    })
  )

  return productMap
}

function hasCategoryMatch(
  product: Product | null | undefined,
  eligibleCategories: Set<string>
): boolean {
  if (!product || eligibleCategories.size === 0) return false

  const categories: string[] = []

  if (Array.isArray((product as any).categories_path_id)) {
    categories.push(
      ...(product as any).categories_path_id.map((id: string) => id.toLowerCase())
    )
  }

  if (Array.isArray((product as any).categories_path)) {
    categories.push(
      ...(product as any).categories_path.map((slug: string) => slug.toLowerCase())
    )
  }

  if (product.category) {
    categories.push(product.category.toLowerCase())
  }

  if (product.subCategory) {
    categories.push(product.subCategory.toLowerCase())
  }

  if (product.subSubCategory) {
    categories.push(product.subSubCategory.toLowerCase())
  }

  return categories.some(category => eligibleCategories.has(category))
}

interface DiscountComputation {
  discountAmount: number
  discountedItems: CouponDiscountedItem[]
}

async function computeDiscount(
  coupon: Coupon,
  cartItems: CouponCartItemInput[],
  productMap: Map<string, Product | null>
): Promise<DiscountComputation> {
  switch (coupon.discountType) {
    case 'percent_all':
      return computePercentAllDiscount(coupon, cartItems)
    case 'fixed':
      return computeFixedDiscount(coupon, cartItems)
    case 'percent_specific':
      return computePercentSpecificDiscount(coupon, cartItems, productMap)
    case 'bogo':
      return computeBogoDiscount(coupon, cartItems, productMap)
    default:
      return { discountAmount: 0, discountedItems: [] }
  }
}

function computePercentAllDiscount(
  coupon: Coupon,
  cartItems: CouponCartItemInput[]
): DiscountComputation {
  const subtotal = calculateSubtotal(cartItems)
  const percentage = (coupon.discountValue ?? 0) / 100
  const discountAmount = Math.max(0, subtotal * percentage)

  const discountedItems: CouponDiscountedItem[] = cartItems.map(item => {
    const unitPrice = getUnitPrice(item)
    const lineTotal = unitPrice * item.quantity
    const itemDiscount = lineTotal * percentage
    return {
      sku: item.sku,
      quantity: item.quantity,
      unitPrice,
      discountAmount: itemDiscount
    }
  })

  return {
    discountAmount,
    discountedItems
  }
}

function computeFixedDiscount(
  coupon: Coupon,
  cartItems: CouponCartItemInput[]
): DiscountComputation {
  const subtotal = calculateSubtotal(cartItems)
  const requestedDiscount = coupon.discountValue ?? 0
  const discountAmount = Math.min(Math.max(requestedDiscount, 0), subtotal)

  if (discountAmount <= 0) {
    return { discountAmount: 0, discountedItems: [] }
  }

  // Allocate discount proportionally across items
  const discountedItems: CouponDiscountedItem[] = []
  const subtotalWithoutZero = subtotal || 1

  cartItems.forEach(item => {
    const unitPrice = getUnitPrice(item)
    const lineTotal = unitPrice * item.quantity
    const proportion = lineTotal / subtotalWithoutZero
    const itemDiscount = discountAmount * proportion
    discountedItems.push({
      sku: item.sku,
      quantity: item.quantity,
      unitPrice,
      discountAmount: itemDiscount
    })
  })

  return {
    discountAmount,
    discountedItems
  }
}

function computePercentSpecificDiscount(
  coupon: Coupon,
  cartItems: CouponCartItemInput[],
  productMap: Map<string, Product | null>
): DiscountComputation {
  const eligibleSkus = new Set(
    (coupon.eligibleProducts ?? []).map(value => value.toLowerCase())
  )
  const eligibleCategories = new Set(
    (coupon.eligibleCategories ?? []).map(value => value.toLowerCase())
  )
  const percentage = (coupon.discountValue ?? 0) / 100

  if (eligibleSkus.size === 0 && eligibleCategories.size === 0) {
    return { discountAmount: 0, discountedItems: [] }
  }

  let discountBase = 0
  const discountedItems: CouponDiscountedItem[] = []

  cartItems.forEach(item => {
    const sku = item.sku.toLowerCase()
    let isEligible = eligibleSkus.has(sku)

    if (!isEligible && eligibleCategories.size > 0) {
      const product = productMap.get(item.sku)
      isEligible = hasCategoryMatch(product ?? null, eligibleCategories)
    }

    if (isEligible) {
      const unitPrice = getUnitPrice(item)
      const lineTotal = unitPrice * item.quantity
      const itemDiscount = lineTotal * percentage
      discountBase += itemDiscount
      discountedItems.push({
        sku: item.sku,
        quantity: item.quantity,
        unitPrice,
        discountAmount: itemDiscount
      })
    }
  })

  return {
    discountAmount: discountBase,
    discountedItems
  }
}

function computeBogoDiscount(
  coupon: Coupon,
  cartItems: CouponCartItemInput[],
  productMap: Map<string, Product | null>
): DiscountComputation {
  const eligibleSkus = new Set(
    (coupon.bogoEligibleSkus ?? []).map(value => value.toLowerCase())
  )
  const eligibleCategories = new Set(
    (coupon.eligibleCategories ?? []).map(value => value.toLowerCase())
  )

  if (eligibleSkus.size === 0 && eligibleCategories.size === 0) {
    return { discountAmount: 0, discountedItems: [] }
  }

  const buyQty = Math.max(coupon.bogoBuyQuantity ?? 1, 1)
  const getQty = Math.max(coupon.bogoGetQuantity ?? 1, 1)
  const groupSize = buyQty + getQty

  let discountAmount = 0
  const discountedItems: CouponDiscountedItem[] = []

  cartItems.forEach(item => {
    const sku = item.sku.toLowerCase()
    let isEligible = eligibleSkus.has(sku)

    if (!isEligible && eligibleCategories.size > 0) {
      const product = productMap.get(item.sku)
      isEligible = hasCategoryMatch(product ?? null, eligibleCategories)
    }

    if (!isEligible) return

    const quantity = Math.max(item.quantity, 0)
    if (quantity < groupSize) return

    const unitPrice = getUnitPrice(item)
    const groups = Math.floor(quantity / groupSize)
    const freeUnits = groups * getQty
    const itemDiscount = freeUnits * unitPrice

    if (itemDiscount > 0) {
      discountAmount += itemDiscount
      discountedItems.push({
        sku: item.sku,
        quantity: freeUnits,
        unitPrice,
        discountAmount: itemDiscount
      })
    }
  })

  return {
    discountAmount,
    discountedItems
  }
}

function buildStackingConflictMessage(
  locale: SupportedLocale,
  requestedCode: string,
  existingCodes: string[]
): CouponLabel {
  if (locale === 'he') {
    return buildMessage(
      `קופון ${requestedCode} אינו ניתן לשילוב עם קופונים קיימים (${existingCodes.join(', ')}).`,
      `קופון ${requestedCode} אינו ניתן לשילוב עם קופונים קיימים (${existingCodes.join(', ')}).`
    )
  }

  return buildMessage(
    `Coupon ${requestedCode} cannot be stacked with current coupons (${existingCodes.join(', ')}).`,
    `Coupon ${requestedCode} אינו ניתן לשילוב עם קופונים קיימים (${existingCodes.join(', ')}).`
  )
}

export async function validateCouponForCart(
  input: CouponValidationInput
): Promise<CouponValidationResult> {
  const {
    code,
    cartItems,
    locale = DEFAULT_LOCALE,
    currency = 'ILS',
    userIdentifier,
    existingCouponCodes = []
  } = input

  if (!cartItems || cartItems.length === 0) {
    return {
      success: false,
      code: 'COUPON_NOT_APPLICABLE',
      messages: buildMessage(
        'Your cart is empty – add items before applying a coupon.',
        'העגלה שלך ריקה – הוסף פריטים לפני החלת קופון.'
      )
    }
  }

  const normalizedCode = normalizeCouponCode(code)
  const coupon = await prisma.coupon.findUnique({
    where: { code: normalizedCode }
  })

  if (!coupon) {
    return {
      success: false,
      code: 'COUPON_NOT_FOUND',
      messages: buildMessage(
        'Invalid or expired coupon.',
        'קופון זה אינו תקף או שפג תוקפו.'
      )
    }
  }

  if (!coupon.isActive) {
    return {
      success: false,
      code: 'COUPON_INACTIVE',
      messages: buildMessage(
        'This coupon is not active at the moment.',
        'קופון זה אינו פעיל כעת.'
      )
    }
  }

  const now = new Date()
  if (coupon.startDate && coupon.startDate > now) {
    return {
      success: false,
      code: 'COUPON_INACTIVE',
      messages: buildMessage(
        'This coupon will be active soon. Please try again later.',
        'קופון זה יופעל בקרוב. אנא נסה במועד מאוחר יותר.'
      )
    }
  }

  if (coupon.endDate && coupon.endDate < now) {
    return {
      success: false,
      code: 'COUPON_EXPIRED',
      messages: buildMessage(
        'This coupon has expired.',
        'תוקף הקופון פג.'
      )
    }
  }

  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
    if (coupon.usageCount >= coupon.usageLimit) {
      return {
        success: false,
        code: 'COUPON_USAGE_EXCEEDED',
        messages: buildMessage(
          'This coupon has reached its usage limit.',
          'קופון זה מיצה את כמות השימושים המותרת.'
        )
      }
    }
  }

  if (coupon.usageLimitPerUser !== null && coupon.usageLimitPerUser !== undefined) {
    if (!userIdentifier) {
      return {
        success: false,
        code: 'MISSING_USER_IDENTIFIER',
        messages: buildMessage(
          'Please sign in to use this coupon.',
          'אנא התחבר כדי להשתמש בקופון זה.'
        )
      }
    }

    const redemption = await prisma.couponRedemption.findUnique({
      where: {
        couponId_userIdentifier: {
          couponId: coupon.id,
          userIdentifier
        }
      }
    })

    if (redemption && redemption.usageCount >= (coupon.usageLimitPerUser ?? 0)) {
      return {
        success: false,
        code: 'COUPON_USAGE_PER_USER_EXCEEDED',
        messages: buildMessage(
          'You have already used this coupon the maximum number of times.',
          'הגעת לכמות השימושים המותרת בקופון זה.'
        )
      }
    }
  }

  const subtotal = calculateSubtotal(cartItems)
  const minCartValue = coupon.minCartValue ?? 0
  if (subtotal < minCartValue) {
    const formattedValue = `${currencySymbols[currency] ?? currencySymbols.ILS}${minCartValue}`
    return {
      success: false,
      code: 'MIN_CART_VALUE_NOT_MET',
      messages: buildMessage(
        `Add more items to reach ${formattedValue} and unlock this coupon.`,
        `הוסף פריטים נוספים כדי להגיע לסך ${formattedValue} ולהפעיל את הקופון.`
      )
    }
  }

  if (existingCouponCodes.length > 0) {
    if (!coupon.stackable) {
      return {
        success: false,
        code: 'STACKING_CONFLICT',
        messages: buildStackingConflictMessage(locale, coupon.code, existingCouponCodes)
      }
    }

    const normalizedExistingCodes = existingCouponCodes.map(normalizeCouponCode)
    const existingCoupons = await prisma.coupon.findMany({
      where: {
        code: {
          in: normalizedExistingCodes
        }
      }
    })

    const hasNonStackableExisting = existingCoupons.some(existing => !existing.stackable)
    if (hasNonStackableExisting) {
      return {
        success: false,
        code: 'STACKING_CONFLICT',
        messages: buildStackingConflictMessage(locale, coupon.code, existingCouponCodes)
      }
    }
  }

  // Load products only if we need category validation
  const requiresProductLookup =
    (coupon.discountType === 'percent_specific' || coupon.discountType === 'bogo') &&
    (coupon.eligibleCategories?.length ?? 0) > 0

  const productMap = requiresProductLookup
    ? await loadProductMap(cartItems.map(item => item.sku))
    : new Map<string, Product | null>()

  const { discountAmount, discountedItems } = await computeDiscount(
    coupon,
    cartItems,
    productMap
  )

  if (discountAmount <= 0 || discountedItems.length === 0) {
    return {
      success: false,
      code: 'COUPON_NOT_APPLICABLE',
      messages: buildMessage(
        'This coupon does not apply to the items in your cart.',
        'קופון זה אינו חל על הפריטים בעגלה.'
      )
    }
  }

  const finalSubtotal = Math.max(subtotal - discountAmount, 0)
  const discountLabel = getCouponLabel(coupon, currency)
  const successMessage = buildMessage(
    'Coupon applied successfully.',
    'הקופון הופעל בהצלחה.'
  )

  return {
    success: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: {
        en: coupon.name_en,
        he: coupon.name_he
      },
      description: {
        en: coupon.description_en,
        he: coupon.description_he
      },
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      discountLabel,
      stackable: coupon.stackable,
      minCartValue: coupon.minCartValue,
      autoApply: coupon.autoApply
    },
    subtotal,
    newSubtotal: finalSubtotal,
    discountAmount,
    discountedItems,
    messages: successMessage,
    warnings: []
  }
}

export async function evaluateAutoApplyCoupons(
  cartItems: CouponCartItemInput[],
  options?: {
    currency?: string
    locale?: SupportedLocale
    userIdentifier?: string | null
  }
): Promise<CouponValidationSuccess | null> {
  const { currency = 'ILS', locale = DEFAULT_LOCALE, userIdentifier } = options ?? {}

  const autoCoupons = await prisma.coupon.findMany({
    where: {
      autoApply: true,
      isActive: true
    }
  })

  if (autoCoupons.length === 0) {
    return null
  }

  let bestResult: CouponValidationSuccess | null = null

  for (const coupon of autoCoupons) {
    const validation = await validateCouponForCart({
      code: coupon.code,
      cartItems,
      currency,
      locale,
      userIdentifier
    })

    if (validation.success) {
      if (!bestResult || validation.discountAmount > bestResult.discountAmount) {
        bestResult = validation
      }
    }
  }

  return bestResult
}

