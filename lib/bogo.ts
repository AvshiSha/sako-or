import { prisma } from './prisma'
import { parseSku } from './sku-parser'

type CartItemForBogo = {
  sku: string
  quantity: number
  price: number
  salePrice?: number | null
}

type BogoPairType = 'same-group' | 'cross-group'

export type BogoAppliedPair = {
  type: BogoPairType
  groupIdA: string
  groupIdB: string
  pairPrice: number
  items: Array<{
    sku: string
    unitPrice: number
    groupId: string
  }>
}

export type BogoComputationResult = {
  bogoDiscountAmount: number
  regularTotalEligible: number
  discountedTotalEligible: number
  hasLeftover: boolean
  pairs: BogoAppliedPair[]
}

type EligibleUnit = {
  sku: string
  unitPrice: number
  groupId: string
  pairPrice: number
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Compute automated BOGO discount for cart items based on product groups.
 *
 * - Each eligible product belongs to exactly one BogoGroup (via Product.bogoGroupId).
 * - First forms same‑group pairs at the group's pairPriceIls.
 * - Then forms cross‑group pairs from leftovers at the average of the two groups' pairPriceIls.
 * - Returns a single cart‑level bogoDiscountAmount and pairing metadata.
 */
export async function computeBogoForCartItems(
  cartItems: CartItemForBogo[]
): Promise<BogoComputationResult> {
  if (!cartItems || cartItems.length === 0) {
    return {
      bogoDiscountAmount: 0,
      regularTotalEligible: 0,
      discountedTotalEligible: 0,
      hasLeftover: false,
      pairs: []
    }
  }

  // 1. Resolve base SKUs and load products with BogoGroup info
  const baseSkuSet = new Set<string>()
  const itemWithBaseSku = cartItems.map(item => {
    const parsed = parseSku(item.sku)
    const baseSku = parsed.baseSku || item.sku
    baseSkuSet.add(baseSku)
    return {
      ...item,
      baseSku
    }
  })

  const baseSkus = Array.from(baseSkuSet)

  const products = await prisma.product.findMany({
    where: {
      sku: { in: baseSkus }
    },
    include: {
      bogoGroup: true
    }
  })

  const productBySku = new Map<string, any>()
  for (const product of products) {
    productBySku.set(product.sku, product)
  }

  // 2. Build list of eligible units (one entry per unit in an eligible BogoGroup)
  const eligibleUnits: EligibleUnit[] = []

  for (const item of itemWithBaseSku) {
    const product = productBySku.get(item.baseSku) as any
    if (!product || !product.bogoGroup) {
      continue
    }

    const groupId = product.bogoGroup.id
    const pairPrice = product.bogoGroup.pairPriceIls

    if (pairPrice <= 0) continue
    if (!item.quantity || item.quantity <= 0) continue

    // Match the cart's visible pricing logic: salePrice takes precedence when present
    const effectiveUnitPrice =
      item.salePrice != null && item.salePrice > 0 ? item.salePrice : item.price

    if (effectiveUnitPrice <= 0) continue

    for (let i = 0; i < item.quantity; i++) {
      eligibleUnits.push({
        sku: item.sku,
        unitPrice: effectiveUnitPrice,
        groupId,
        pairPrice
      })
    }
  }

  if (eligibleUnits.length < 2) {
    return {
      bogoDiscountAmount: 0,
      regularTotalEligible: 0,
      discountedTotalEligible: 0,
      hasLeftover: false,
      pairs: []
    }
  }

  // 3. Same‑group pairing: maximize savings within each group
  const unitsByGroup = new Map<string, EligibleUnit[]>()
  for (const unit of eligibleUnits) {
    const list = unitsByGroup.get(unit.groupId)
    if (list) list.push(unit)
    else unitsByGroup.set(unit.groupId, [unit])
  }

  let regularTotalEligible = 0
  let discountedTotalEligible = 0
  const pairs: BogoAppliedPair[] = []
  const leftovers: EligibleUnit[] = []

  for (const [groupId, units] of unitsByGroup.entries()) {
    // Sort by unitPrice descending so we pair the most expensive units first
    const sorted = [...units].sort((a, b) => b.unitPrice - a.unitPrice)
    const count = sorted.length
    const pairCount = Math.floor(count / 2)

    for (let i = 0; i < pairCount; i++) {
      const u1 = sorted[2 * i]
      const u2 = sorted[2 * i + 1]
      const groupPairPrice = u1.pairPrice // same group, so any unit's pairPrice is fine

      const pairRegular = u1.unitPrice + u2.unitPrice
      const pairDiscounted = groupPairPrice

      regularTotalEligible += pairRegular
      discountedTotalEligible += pairDiscounted

      pairs.push({
        type: 'same-group',
        groupIdA: groupId,
        groupIdB: groupId,
        pairPrice: roundToTwo(groupPairPrice),
        items: [
          { sku: u1.sku, unitPrice: u1.unitPrice, groupId: u1.groupId },
          { sku: u2.sku, unitPrice: u2.unitPrice, groupId: u2.groupId }
        ]
      })
    }

    // Leftover (at most 1 per group) – charged at regular price, not discounted
    const leftoverStartIndex = pairCount * 2
    for (let i = leftoverStartIndex; i < count; i++) {
      leftovers.push(sorted[i])
    }
  }

  // 4. Cross‑group pairing from leftovers (mix & match)
  if (leftovers.length >= 2) {
    const sortedLeftovers = [...leftovers].sort((a, b) => {
      if (a.pairPrice !== b.pairPrice) {
        return a.pairPrice - b.pairPrice
      }
      if (a.unitPrice !== b.unitPrice) {
        // Higher priced units later in tie‑break so they tend to pair with higher groups
        return a.unitPrice - b.unitPrice
      }
      return a.sku.localeCompare(b.sku)
    })

    let i = 0
    let j = sortedLeftovers.length - 1

    while (i < j) {
      const uLow = sortedLeftovers[i]
      const uHigh = sortedLeftovers[j]

      const pairRegular = uLow.unitPrice + uHigh.unitPrice
      const crossPairPrice = roundToTwo(
        (uLow.pairPrice + uHigh.pairPrice) / 2
      )

      regularTotalEligible += pairRegular
      discountedTotalEligible += crossPairPrice

      pairs.push({
        type: 'cross-group',
        groupIdA: uLow.groupId,
        groupIdB: uHigh.groupId,
        pairPrice: crossPairPrice,
        items: [
          { sku: uLow.sku, unitPrice: uLow.unitPrice, groupId: uLow.groupId },
          {
            sku: uHigh.sku,
            unitPrice: uHigh.unitPrice,
            groupId: uHigh.groupId
          }
        ]
      })

      i++
      j--
    }

    const hasLeftover = sortedLeftovers.length % 2 === 1
    const bogoDiscountAmount = roundToTwo(
      Math.max(0, regularTotalEligible - discountedTotalEligible)
    )

    return {
      bogoDiscountAmount,
      regularTotalEligible: roundToTwo(regularTotalEligible),
      discountedTotalEligible: roundToTwo(discountedTotalEligible),
      hasLeftover,
      pairs
    }
  }

  const hasLeftover = leftovers.length > 0
  const bogoDiscountAmount = roundToTwo(
    Math.max(0, regularTotalEligible - discountedTotalEligible)
  )

  return {
    bogoDiscountAmount,
    regularTotalEligible: roundToTwo(regularTotalEligible),
    discountedTotalEligible: roundToTwo(discountedTotalEligible),
    hasLeftover,
    pairs
  }
}
