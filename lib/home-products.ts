import { getFilteredProducts, type Product } from '@/lib/firebase'

export const BEST_SELLER_SKUS: string[] = [
  '5003-0030',
  '5004-0010',
  '5025-3418',
  '5025-3509',
  '5025-3516',
  '5025-3513',
  '5025-4204',
  '5022-3102',
  '5025-2901',
  '5026-0872',
  '5025-7830',
  '5025-7821',
  '5029-8695',
  '5004-0016',
  '5004-0070',
  '5025-3517',
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

export async function fetchHomeBestSellers(): Promise<Product[]> {
  return fetchProductsBySkus(BEST_SELLER_SKUS)
}

export async function fetchHomeBagsProducts(): Promise<Product[]> {
  const result = await getFilteredProducts(
    { categoryPath: 'women/accessories/bags' },
    'newest',
    { page: 1, pageSize: 200 }
  )
  return result.products ?? []
}

export async function fetchHomeBogoPairProducts(): Promise<Product[]> {
  return fetchProductsBySkus(BOGO_PAIR_SKUS)
}
