import { notFound } from 'next/navigation'
import { productService } from '@/lib/firebase'
import { buildMetadata, buildProductStructuredData, buildAbsoluteUrl } from '@/lib/seo'
import type { Metadata } from 'next'
import { languages } from '@/i18n/settings'
import { getImageUrl } from '@/lib/image-urls'
import { getColorName } from '@/lib/colors'
import {
  SIZE_FIT_OPTIONS,
  FOOT_WIDTH_FIT_OPTIONS,
  ARCH_FIT_OPTIONS,
  getOptionLabel,
  isUndefinedFitValue,
} from '@/lib/product-enums'
import type { Product } from '@/lib/product-types'

/** Structured-data facts (material/color/spec+fit PropertyValue list) shared between the two product fetches below. */
function buildStructuredDataFacts(
  product: Product,
  colorSlug: string,
  locale: 'en' | 'he'
): { material?: string; color?: string; additionalProperty: Array<{ name: string; value: string }> } {
  const materialCare = product.materialCare
  const material = locale === 'he' ? materialCare?.upperMaterial_he : materialCare?.upperMaterial_en
  const color = getColorName(colorSlug, locale)

  const additionalProperty: Array<{ name: string; value: string }> = []
  const pushSpec = (name: string, value: string | undefined) => {
    if (value) additionalProperty.push({ name, value })
  }

  pushSpec(locale === 'he' ? 'בטנה' : 'Lining', locale === 'he' ? materialCare?.lining_he : materialCare?.lining_en)
  pushSpec(locale === 'he' ? 'סוליה' : 'Sole', locale === 'he' ? materialCare?.sole_he : materialCare?.sole_en)
  pushSpec(locale === 'he' ? 'סגירה' : 'Closure', locale === 'he' ? materialCare?.closureType_he : materialCare?.closureType_en)
  pushSpec(locale === 'he' ? 'סוג עקב' : 'Heel type', locale === 'he' ? materialCare?.heelType_he : materialCare?.heelType_en)
  pushSpec(locale === 'he' ? 'גובה עקב' : 'Heel height', locale === 'he' ? materialCare?.heelHeight_he : materialCare?.heelHeight_en)

  const shoeFit = product.shoeFit
  if (shoeFit) {
    if (!isUndefinedFitValue(shoeFit.sizeFit)) {
      pushSpec(locale === 'he' ? 'התאמת מידה' : 'Size fit', getOptionLabel(SIZE_FIT_OPTIONS, shoeFit.sizeFit, locale))
    }
    if (!isUndefinedFitValue(shoeFit.footWidthFit)) {
      pushSpec(locale === 'he' ? 'רוחב מומלץ' : 'Recommended foot width', getOptionLabel(FOOT_WIDTH_FIT_OPTIONS, shoeFit.footWidthFit, locale))
    }
    if (!isUndefinedFitValue(shoeFit.archFit)) {
      pushSpec(locale === 'he' ? 'התאמת קשת כף רגל' : 'Arch fit', getOptionLabel(ARCH_FIT_OPTIONS, shoeFit.archFit, locale))
    }
  }

  return { material: material || undefined, color: color || undefined, additionalProperty }
}

function reorderImagesByPrimary(images: string[] | undefined, primaryImage: string | undefined): string[] {
  const list = Array.isArray(images) ? images : []
  if (!primaryImage) return list
  const idx = list.findIndex((img) => img === primaryImage)
  if (idx <= 0) return list
  return [primaryImage, ...list.slice(0, idx), ...list.slice(idx + 1)]
}

function getLcpImageUrl(variant: { images?: string[]; primaryImage?: string }): string | null {
  const ordered = reorderImagesByPrimary(variant.images, variant.primaryImage)
  const first = ordered[0]
  if (!first) return null
  return first.startsWith('http') ? first : buildAbsoluteUrl(first)
}

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
    const seoTitle = locale === 'he' ? product.seo?.title_he : product.seo?.title_en
    const productTitle = seoTitle || (locale === 'he' ? product.title_he : product.title_en)

    // Get product description (prefer SEO description, fallback to regular description)
    const productDescription = product.seo?.description_en || product.seo?.description_he
      ? (locale === 'he' ? product.seo.description_he : product.seo.description_en) || 
        (locale === 'he' ? product.description_he : product.description_en)
      : (locale === 'he' ? product.description_he : product.description_en)

    // Get color name for title enhancement
    const colorName = variant.colorSlug ? getColorName(variant.colorSlug, locale) : ''

    // Build title with color if available. The SEO title is already a complete, brand-suffixed
    // title on its own (e.g. "... | GRUNLAND Italy") — only append the SAKO-OR site suffix when
    // falling back to the plain product title, to avoid duplicating the brand mention.
    const title = seoTitle
      ? (colorName ? `${productTitle} – ${colorName}` : productTitle)
      : (colorName ? `${productTitle} – ${colorName} | SAKO-OR` : `${productTitle} | SAKO-OR`)

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

  // Fetch product for JSON-LD structured data and LCP image preload
  let structuredData: object | null = null
  let lcpImageUrl: string | null = null
  try {
    const product = await productService.getProductByBaseSku(baseSku)
    if (product) {
      const variant = Object.values(product.colorVariants || {}).find(
        v => v.colorSlug === colorSlug
      )

      if (variant && variant.isActive !== false) {
        lcpImageUrl = getLcpImageUrl(variant)
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

        const { material, color, additionalProperty } = buildStructuredDataFacts(
          product,
          colorSlug,
          lng as 'en' | 'he'
        )

        structuredData = buildProductStructuredData({
          name: productName,
          description: productDesc,
          image: images.length > 0 ? images : [getImageUrl('/images/placeholder.svg')],
          brand: product.brand || 'SAKO-OR',
          sku: `${baseSku}-${colorSlug}`,
          material,
          color,
          additionalProperty,
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
      {lcpImageUrl && (
        <link
          rel="preload"
          as="image"
          href={lcpImageUrl}
          fetchPriority="high"
        />
      )}
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
