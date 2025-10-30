import { NextRequest, NextResponse } from 'next/server'
import { productService, type Product } from '@/lib/firebase'

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function buildRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvEscape).join(',')
}

export async function GET(request: NextRequest) {
  // Server-side protection using API key
  const providedKey = request.headers.get('x-api-key')
  const validKey = process.env.ADMIN_API_KEY
  const isProd = process.env.NODE_ENV === 'production'
  // In production, always require a valid key.
  // In development, enforce only if a key is configured; otherwise allow.
  if ((isProd && providedKey !== validKey) || (!isProd && validKey && providedKey !== validKey)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const headers = [
    // A - S
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
    'google_product_category',
    'fb_product_category',
    'quantity_to_sell_on_facebook',
    'sale_price',
    'sale_price_effective_date',
    'item_group_id',
    'gender',
    'color',
    'size',
    'age_group'
  ]

  const lines: string[] = []
  lines.push(buildRow(headers))

  const products: Product[] = await productService.getAllProducts()

  for (const product of products) {
    const sku = product.sku
    const titleHe = product.title_he
    const descHe = product.description_he
    const basePrice = product.price
    const currency = product.currency
    const groupId = sku

    const colorVariants = product.colorVariants || {}
    for (const variantKey of Object.keys(colorVariants)) {
      const variant = colorVariants[variantKey]
      if (!variant) continue
      const colorSlug = variant.colorSlug
      const primaryImage = variant.primaryImage || (variant.images && variant.images[0]) || ''

      const stockBySize = variant.stockBySize || {}
      for (const [size, quantity] of Object.entries(stockBySize)) {
        const id = `${sku}-${size}-${colorSlug}`
        const title = titleHe
        const description = descHe
        const availability = 'in stock'
        const condition = 'new'
        const price = `${basePrice} ${currency}`
        const link = `https://www.sako-or.com/he/product/${sku}/${colorSlug}`
        const imageLink = primaryImage
        const brand = 'SAKO-OR'
        const googleCategory = 'Apparel & Accessories > Shoes'
        const fbCategory = "clothing & accessories > shoes & footwear > women's shoes"
        const quantityToSell = quantity
        const salePrice = (variant.salePrice && variant.salePrice > 0)
          ? variant.salePrice
          : (product.salePrice && product.salePrice > 0)
            ? product.salePrice
            : ''
        const salePriceEffectiveDate = ''
        const itemGroupId = groupId
        const gender = 'female'
        const color = colorSlug
        const sizeOut = size
        const ageGroup = 'all ages'

        lines.push(buildRow([
          id,
          title,
          description,
          availability,
          condition,
          price,
          link,
          imageLink,
          brand,
          googleCategory,
          fbCategory,
          quantityToSell,
          salePrice,
          salePriceEffectiveDate,
          itemGroupId,
          gender,
          color,
          sizeOut,
          ageGroup
        ]))
      }
    }
  }

  // Prepend UTF-8 BOM so Excel correctly recognizes Hebrew characters
  const csv = '\uFEFF' + lines.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="meta_catalog.csv"'
    }
  })
}


