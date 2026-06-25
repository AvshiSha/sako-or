import { unstable_cache } from 'next/cache'

import {
  categoryService,
  getFilteredProducts,
  type Product,
  type ProductFilters,
} from '@/lib/firebase'
import { serializeFirestoreValue } from '@/lib/serialize-firestore'

const HOME_PRODUCTS_REVALIDATE_SECONDS = 600
const HOME_BAGS_PAGE_SIZE = 20

function serializeProducts(products: Product[]): Product[] {
  return products.map((product) => serializeFirestoreValue(product))
}

export const BEST_SELLER_SKUS: string[] = [
  '5022-5409',
  '5025-3516',
  '5003-0030',
  '5025-3418',
  '5005-0205',
  '5025-3517',
  '5026-6815',
  '5003-0017',
  '5004-0700',
  '5025-3417',
  '5025-7826',
  '5005-0205'
]

export const BOGO_PAIR_SKUS: string[] = [
  ...['4925-2703', '4925-2704', '4725-1310', '4725-2725'],
  ...[
    '4929-3123',
    '4724-0231',
    '4725-1201',
    '4725-1326',
    '4725-2521',
    '4725-2718',
    '4725-4007',
    '4725-6110',
    '4725-6119',
    '4726-8916',
  ],
  ...[
    '4925-1304',
    '4925-1309',
    '4925-1320',
    '4925-1327',
    '4925-2714',
    '4925-2715',
    '4925-2901',
    '4925-2913',
    '4925-4013',
    '4925-4031',
    '4925-6113',
    '4929-9281',
    '4929-9988',
    '4715-0603',
    '4715-0701',
    '4725-1007',
    '4725-1011',
    '4725-1207',
    '4725-1305',
    '4725-2915',
    '4725-6108',
    '4725-6109',
  ],
  ...[
    '4922-1804',
    '4924-0001',
    '4925-0301',
    '4925-0310',
    '4925-1205',
    '4925-1210',
    '4925-1329',
    '4925-2512',
    '4925-4001',
    '4925-6107',
    '4925-6108',
    '4925-6170',
    '4925-6180',
    '4929-2318',
    '4929-3985',
    '4929-9521',
    '4725-1210',
    '4725-3315',
    '4725-6105',
    '4824-6873',
    '4824-6870',
    '4824-8761',
    '4827-2268',
  ],
  ...[
    '4922-5394',
    '4924-0605',
    '4924-7168',
    '4924-7187',
    '4924-8017',
    '4925-1302',
    '4929-2668',
    '4704-0007',
    '4704-0010',
    '4704-0061',
    '4712-4218',
    '4713-0100',
    '4713-0201',
    '4824-0070',
  ],
]

async function fetchProductsBySkus(skus: string[]): Promise<Product[]> {
  if (skus.length === 0) return []

  const uniqueSkus: string[] = []
  const seen = new Set<string>()
  for (const sku of skus) {
    if (seen.has(sku)) continue
    seen.add(sku)
    uniqueSkus.push(sku)
  }

  const chunkSize = 10
  const skuChunks: string[][] = []
  for (let i = 0; i < uniqueSkus.length; i += chunkSize) {
    skuChunks.push(uniqueSkus.slice(i, i + chunkSize))
  }

  const results = await Promise.all(
    skuChunks.map((chunk) => getFilteredProducts({ includeSkus: chunk }))
  )

  const productBySku = new Map<string, Product>()
  for (const result of results) {
    for (const product of result.products as Product[]) {
      if (product.sku) {
        productBySku.set(product.sku, product)
      }
    }
  }

  const ordered: Product[] = []
  for (const sku of uniqueSkus) {
    const product = productBySku.get(sku)
    if (product) ordered.push(product)
  }
  return ordered
}

async function loadHomeBestSellers(): Promise<Product[]> {
  return serializeProducts(await fetchProductsBySkus(BEST_SELLER_SKUS))
}

async function loadHomeBagsProducts(): Promise<Product[]> {
  const categoryInfo = await categoryService.getCategoryIdsFromPath(
    'women/accessories/bags',
    'en'
  )
  const filters: ProductFilters = categoryInfo?.categoryIds?.length
    ? { categoryIds: categoryInfo.categoryIds }
    : { categoryPath: 'women/accessories/bags' }

  const result = await getFilteredProducts(filters, 'newest', {
    page: 1,
    pageSize: HOME_BAGS_PAGE_SIZE,
  })
  return serializeProducts(result.products ?? [])
}

const getCachedHomeBestSellers = unstable_cache(
  loadHomeBestSellers,
  ['home-best-sellers'],
  { revalidate: HOME_PRODUCTS_REVALIDATE_SECONDS }
)

const getCachedHomeBagsProducts = unstable_cache(
  loadHomeBagsProducts,
  ['home-bags-products'],
  { revalidate: HOME_PRODUCTS_REVALIDATE_SECONDS }
)

export async function fetchHomeBestSellers(): Promise<Product[]> {
  return getCachedHomeBestSellers()
}

export async function fetchHomeBagsProducts(): Promise<Product[]> {
  return getCachedHomeBagsProducts()
}

export async function fetchHomeBogoPairProducts(): Promise<Product[]> {
  return fetchProductsBySkus(BOGO_PAIR_SKUS)
}
