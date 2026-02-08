import { notFound } from 'next/navigation'
import { productService } from '@/lib/firebase'
import { buildMetadata, buildProductStructuredData, buildAbsoluteUrl } from '@/lib/seo'
import type { Metadata } from 'next'
import { languages } from '@/i18n/settings'
import { getImageUrl } from '@/lib/image-urls'

interface ProductColorLayoutProps {
  children: React.ReactNode
  params: Promise<{
    lng: string
    baseSku: string
    colorSlug: string
  }>
}

// Generate metadata for product pages
export async function generateMetadata({
  params,
}: ProductColorLayoutProps): Promise<Metadata> {
  const { lng, baseSku, colorSlug } = await params
  const locale = lng as 'en' | 'he'

  // Validate language
  if (!['en', 'he'].includes(lng)) {
    return buildMetadata({
      title: 'Product Not Found | SAKO-OR',
      description: 'The requested product could not be found',
      url: `/${lng}/collection`,
      locale,
    })
  }

  try {
    // Fetch product data
    const product = await productService.getProductByBaseSku(baseSku)

    if (!product) {
      return buildMetadata({
        title: 'Product Not Found | SAKO-OR',
        description: 'The requested product could not be found',
        url: `/${lng}/collection`,
        locale,
      })
    }

    // Get color variant
    const variant = Object.values(product.colorVariants || {}).find(
      v => v.colorSlug === colorSlug
    )

    if (!variant || variant.isActive === false) {
      return buildMetadata({
        title: 'Product Not Available | SAKO-OR',
        description: 'The requested product variant is not available',
        url: `/${lng}/collection`,
        locale,
      })
    }

    // Get product title (prefer SEO title, fallback to regular title)
    const productTitle = product.seo?.title_en || product.seo?.title_he
      ? (locale === 'he' ? product.seo.title_he : product.seo.title_en) || 
        (locale === 'he' ? product.title_he : product.title_en)
      : (locale === 'he' ? product.title_he : product.title_en)

    // Get product description (prefer SEO description, fallback to regular description)
    const productDescription = product.seo?.description_en || product.seo?.description_he
      ? (locale === 'he' ? product.seo.description_he : product.seo.description_en) || 
        (locale === 'he' ? product.description_he : product.description_en)
      : (locale === 'he' ? product.description_he : product.description_en)

    // Get color name for title enhancement
    const colorName = variant.colorSlug
      ? variant.colorSlug.charAt(0).toUpperCase() + variant.colorSlug.slice(1)
      : ''

    // Build title with color if available
    const title = colorName 
      ? `${productTitle} – ${colorName} | SAKO-OR`
      : `${productTitle} | SAKO-OR`

    // Get product image (prefer primary image, fallback to first image)
    const productImage = variant.primaryImage || 
                        (variant.images && variant.images.length > 0 ? variant.images[0] : null) ||
                        null

    // Build URL
    const url = `/${lng}/product/${baseSku}/${colorSlug}`

    // Build alternate locales
    const alternateLocales = languages
      .filter(l => l !== locale)
      .map(altLng => ({
        locale: altLng,
        url: `/${altLng}/product/${baseSku}/${colorSlug}`,
      }))

    return buildMetadata({
      title,
      description: productDescription,
      url,
      image: productImage || undefined,
      type: 'product',
      locale,
      alternateLocales,
    })
  } catch (error) {
    console.error('Error generating product metadata:', error)
    return buildMetadata({
      title: 'Product | SAKO-OR',
      description: 'View our quality products',
      url: `/${lng}/collection`,
      locale,
    })
  }
}

export default async function ProductColorLayout({ children, params }: ProductColorLayoutProps) {
  const { lng, baseSku, colorSlug } = await params
  
  // Validate language
  if (!['en', 'he'].includes(lng)) {
    notFound()
  }

  // Fetch product for JSON-LD structured data
  let structuredData: object | null = null
  try {
    const product = await productService.getProductByBaseSku(baseSku)
    if (product) {
      const variant = Object.values(product.colorVariants || {}).find(
        v => v.colorSlug === colorSlug
      )

      if (variant && variant.isActive !== false) {
        // Get current price (prefer variant price, fallback to product price)
        const currentPrice = variant.priceOverride || variant.salePrice || product.salePrice || product.price
        const currency = product.currency || 'ILS'
        
        // Check availability (in stock if any size has stock > 0)
        const hasStock = Object.values(variant.stockBySize || {}).some(stock => stock > 0)
        const availability = hasStock ? 'InStock' : 'OutOfStock'

        // Get product images
        const images = variant.images && variant.images.length > 0
          ? variant.images.map(img => img.startsWith('http') ? img : buildAbsoluteUrl(img))
          : []

        // Get product name and description
        const productName = (lng === 'he' ? product.title_he : product.title_en) || product.sku
        const productDesc = (lng === 'he' ? product.description_he : product.description_en) || ''

        // Build model number (SKU + color)
        const model = `${baseSku}-${colorSlug.toUpperCase()}`

        structuredData = buildProductStructuredData({
          name: productName,
          description: productDesc,
          image: images.length > 0 ? images : [getImageUrl('/images/placeholder.svg')],
          brand: product.brand || 'SAKO-OR',
          sku: `${baseSku}-${colorSlug}`,
          offers: {
            price: currentPrice,
            currency,
            availability,
            url: buildAbsoluteUrl(`/${lng}/product/${baseSku}/${colorSlug}`),
          },
          model,
        }, lng as 'en' | 'he')
      }
    }
  } catch (error) {
    console.error('Error generating structured data:', error)
  }
  
  return (
    <div className={`${lng === 'he' ? 'rtl' : 'ltr'}`}>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      {children}
    </div>
  )
}
