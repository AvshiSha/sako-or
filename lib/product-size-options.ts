import { getCategoryFieldGroup } from './product-enums'
import { normalizeSizeKey } from './product-size'

/**
 * Which sizes a product offers, and whether each one can be bought.
 *
 * The offered range is a property of the category, not of the stock table: a
 * women's shoe offers 35-42 whether or not every row exists in Firebase. Sizes
 * that are absent or at zero are still returned, flagged out of stock, so the PDP
 * can draw them struck through (438:2692) instead of silently shortening the grid.
 */

export const WOMEN_SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42'] as const
export const MEN_SHOE_SIZES = ['39', '40', '41', '42', '43', '44', '45', '46'] as const

/**
 * Stock is keyed "One size" in Firebase and Neon - "OS" is Verifone's format and
 * lib/inventory.ts converts it on the way in. Both are accepted here so a record
 * written straight from the feed still resolves, and the label stays "OS".
 */
export const ONE_SIZE_STOCK_KEY = 'One size'
export const ONE_SIZE_LABEL = 'OS'
const ONE_SIZE_ALIASES = ['one size', 'os', 'onesize', 'one-size']

/**
 * Columns for the size grid, chosen so the last row comes out full.
 *
 * The grid draws its dividers by letting an ink ground show through 1px gaps, so
 * a cell with nothing in it reads as a solid black block rather than as empty
 * space. Rather than pad the run with spacers, pick a column count that divides
 * it: a category range is eight sizes and lands on 4+4, while a five-size product
 * still gets the single row of five that 438:4240 draws. 4 is the fallback for
 * counts that divide by nothing sensible (7, 11), where a spacer is unavoidable.
 */
export function getSizeGridColumns(count: number): 1 | 3 | 4 | 5 {
  if (count <= 1) return 1
  for (const columns of [5, 4, 3] as const) {
    if (count % columns === 0) return columns
  }
  return 4
}

export type ProductSizeOption = {
  /** Key to write into the cart and to look up in stockBySize. */
  key: string
  /** What the shopper sees. Differs from `key` only for one-size products. */
  label: string
  stock: number
  inStock: boolean
}

type CategorySource = {
  categories_path?: string[]
  subCategory_en?: string
  subCategory_he?: string
  subSubCategory_en?: string
  subSubCategory_he?: string
}

function lookupStock(stockBySize: Record<string, number>, key: string): number {
  if (key in stockBySize) return stockBySize[key] ?? 0
  const wanted = normalizeSizeKey(key).toLowerCase()
  for (const [rawKey, qty] of Object.entries(stockBySize)) {
    if (normalizeSizeKey(rawKey).toLowerCase() === wanted) return qty ?? 0
  }
  return 0
}

/** True for shoes/boots/sandals; false for bags, belts, charms and anything else. */
export function isFootwear(product: CategorySource): boolean {
  const path = product.categories_path ?? []
  if (path.some((segment) => segment?.toLowerCase() === 'shoes')) return true
  return (
    getCategoryFieldGroup(
      product.subCategory_en,
      product.subCategory_he,
      product.subSubCategory_en,
      product.subSubCategory_he,
      ...path
    ) === 'shoes'
  )
}

/** Women unless the category path says men. There are no unisex products. */
export function isMensProduct(product: CategorySource): boolean {
  return (product.categories_path ?? []).some((segment) => {
    const value = segment?.toLowerCase()
    return value === 'men' || value === 'mens' || value === "men's"
  })
}

export function getProductSizeOptions(
  product: CategorySource,
  stockBySize: Record<string, number> | undefined | null
): ProductSizeOption[] {
  const stock = stockBySize ?? {}

  if (!isFootwear(product)) {
    // Every accessory is one-size, so only the one-size row counts. Deliberately
    // NOT falling back to the sum of stockBySize: real records carry stray shoe
    // rows (SAKO SUIT BAG 9025 holds {"35":1,"One size":5}), and summing those
    // would report a sold-out bag as available on the strength of a leftover.
    const quantity = ONE_SIZE_ALIASES.reduce(
      (found, alias) => (found > 0 ? found : lookupStock(stock, alias)),
      0
    )

    return [
      {
        key: ONE_SIZE_STOCK_KEY,
        label: ONE_SIZE_LABEL,
        stock: quantity,
        inStock: quantity > 0,
      },
    ]
  }

  // The range is the whole story - nothing outside it is ever offered. The house
  // stocks no women's shoe below 35 and nothing above 42 today, so a stock row
  // outside the range is bad data rather than sellable inventory, and surfacing
  // it would put a size on the page that cannot be honoured.
  const range = isMensProduct(product) ? MEN_SHOE_SIZES : WOMEN_SHOE_SIZES

  return range.map((size) => {
    const quantity = lookupStock(stock, size)
    return { key: size, label: size, stock: quantity, inStock: quantity > 0 }
  })
}
