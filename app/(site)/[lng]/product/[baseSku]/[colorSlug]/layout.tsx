import { notFound } from 'next/navigation'
import { getCachedProductByBaseSku } from '@/lib/server/cached-product-data'
import { getCachedCategoryById } from '@/lib/server/cached-category-data'
import {
  buildMetadata,
  buildProductStructuredData,
  buildBreadcrumbStructuredData,
  buildAbsoluteUrl,
  type BreadcrumbCrumb,
} from '@/lib/seo'
import { buildProductTitle, getPrimaryColorSlug } from '@/lib/product-seo'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import type { Metadata } from 'next'
import { languages } from '@/i18n/settings'
import { getImageUrl } from '@/lib/image-urls'
import { getColorName } from '@/lib/colors'
import {
  SIZE_FIT_OPTIONS,
  FOOT_WIDTH_FIT_OPTIONS,
  ARCH_FIT_OPTIONS,
  UPPER_MATERIAL_OPTIONS,
  LINING_OPTIONS,
  OUTSOLE_OPTIONS,
  SOLE_TYPE_OPTIONS,
  CLOSURE_TYPE_OPTIONS,
  HEEL_TYPE_OPTIONS,
  HEEL_HEIGHT_CM_OPTIONS,
  getOptionLabel,
  isUndefinedFitValue,
} from '@/lib/product-enums'
import type { Product } from '@/lib/product-types'

/** Dropdown value first (resolved to a label), then legacy free text. */
function resolveSpecFact(
  dropdownValue: string | undefined,
  options: { value: string; label_en: string; label_he: string }[],
  legacyEn: string | undefined,
  legacyHe: string | undefined,
  locale: 'en' | 'he'
): string | undefined {
  if (dropdownValue) {
    const label = getOptionLabel(options, dropdownValue, locale)
    if (label) return label
  }
  return locale === 'he' ? legacyHe : legacyEn
}

/** Structured-data facts (material/color/spec+fit PropertyValue list) shared between the two product fetches below. */
function buildStructuredDataFacts(
  product: Product,
  colorSlug: string,
  locale: 'en' | 'he'
): { material?: string; color?: string; additionalProperty: Array<{ name: string; value: string }> } {
  const materialCare = product.materialCare
  const material = materialCare?.upperMaterial && materialCare.upperMaterial.length > 0
    ? materialCare.upperMaterial
        .map((value) => getOptionLabel(UPPER_MATERIAL_OPTIONS, value, locale))
        .filter((label): label is string => !!label)
        .join(', ')
    : (locale === 'he' ? materialCare?.upperMaterial_he : materialCare?.upperMaterial_en)
  const color = getColorName(colorSlug, locale)

  const additionalProperty: Array<{ name: string; value: string }> = []
  const pushSpec = (name: string, value: string | undefined) => {
    if (value) additionalProperty.push({ name, value })
  }

  pushSpec(locale === 'he' ? 'בטנה' : 'Lining', resolveSpecFact(materialCare?.lining, LINING_OPTIONS, materialCare?.lining_en, materialCare?.lining_he, locale))
  pushSpec(locale === 'he' ? 'סוליה' : 'Outsole', resolveSpecFact(materialCare?.outsole, OUTSOLE_OPTIONS, materialCare?.sole_en, materialCare?.sole_he, locale))
  pushSpec(locale === 'he' ? 'סוג סוליה' : 'Sole type', materialCare?.soleType ? getOptionLabel(SOLE_TYPE_OPTIONS, materialCare.soleType, locale) : undefined)
  pushSpec(locale === 'he' ? 'סגירה' : 'Closure', resolveSpecFact(materialCare?.closureType, CLOSURE_TYPE_OPTIONS, materialCare?.closureType_en, materialCare?.closureType_he, locale))
  pushSpec(locale === 'he' ? 'סוג עקב' : 'Heel type', resolveSpecFact(materialCare?.heelType, HEEL_TYPE_OPTIONS, materialCare?.heelType_en, materialCare?.heelType_he, locale))
  pushSpec(locale === 'he' ? 'גובה עקב' : 'Heel height', resolveSpecFact(materialCare?.heelHeight, HEEL_HEIGHT_CM_OPTIONS, materialCare?.heelHeight_en, materialCare?.heelHeight_he, locale))

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

type CategoryCrumb = { name: string; path: string }

/**
 * The product's category trail, root-first and localised, e.g.
 * [נשים, אאוטלט, סנדלים] with each carrying its full collection path.
 *
 * Feeds two things at once. The deepest name gives the page title a keyword
 * worth ranking for - the stored product title is the brand ("IL BORGO
 * FIRENZE"), which nobody searches. The full trail becomes the breadcrumb,
 * which is how a product page stops being orphaned from the collection tree
 * it belongs to.
 *
 * Best-effort throughout: a product with no category path still renders, just
 * without a leading keyword and without breadcrumbs.
 */
async function resolveCategoryTrail(
  product: Product,
  locale: 'en' | 'he'
): Promise<CategoryCrumb[]> {
  const categoryIds = product.categories_path_id
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return []

  try {
    const categories = await Promise.all(
      categoryIds.map((id) => getCachedCategoryById(id).catch(() => null))
    )
    return categories.flatMap((category) => {
      const resolved = category as { name?: Record<string, string>; path?: string } | null
      const name = resolved?.name?.[locale] || resolved?.name?.en
      const path = resolved?.path
      return name && path ? [{ name, path }] : []
    })
  } catch (error) {
    console.error('Error resolving category trail for product:', error)
    return []
  }
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
    const product = await getCachedProductByBaseSku(baseSku)

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

    // An admin-authored SEO title wins outright; otherwise we compose one,
    // because the stored title is the brand name and carries no keyword.
    const seoTitleOverride = locale === 'he' ? product.seo?.title_he : product.seo?.title_en
    const productTitle = locale === 'he' ? product.title_he : product.title_en

    // Get product description (prefer SEO description, fallback to regular description)
    const productDescription = product.seo?.description_en || product.seo?.description_he
      ? (locale === 'he' ? product.seo.description_he : product.seo.description_en) || 
        (locale === 'he' ? product.description_he : product.description_en)
      : (locale === 'he' ? product.description_he : product.description_en)

    // getColorName() rather than title-casing the slug: the slug is English,
    // so Hebrew pages were shipping titles like "... – Beige" and
    // "... – Dark-brown" while the JSON-LD on the same page said "בז'".
    const colorName = getColorName(colorSlug, locale)
    const categoryTrail = await resolveCategoryTrail(product, locale)
    const categoryName = categoryTrail[categoryTrail.length - 1]?.name

    // SKU fallback so a product missing title, category and colour cannot
    // ship a title that is nothing but the " | SAKO-OR" suffix.
    const title = buildProductTitle({
      seoTitleOverride,
      productTitle,
      categoryName,
      colorName,
    }) || product.sku

    // Get product image (prefer primary image, fallback to first image)
    const productImage = variant.primaryImage || 
                        (variant.images && variant.images.length > 0 ? variant.images[0] : null) ||
                        null

    const url = `/${lng}/product/${baseSku}/${colorSlug}`

    // Every colour of a product canonicalises to one of them. See
    // lib/product-seo.ts for why - in short, the colour siblings are
    // near-identical and Google was indexing none of them.
    const primaryColorSlug = getPrimaryColorSlug(product) || colorSlug
    const isPrimaryColor = primaryColorSlug === colorSlug
    const canonicalUrl = `/${lng}/product/${baseSku}/${primaryColorSlug}`

    // hreflang only on the canonical colour. A cluster is only valid if every
    // URL in it self-canonicalises; pointing hreflang at a colour that
    // canonicalises elsewhere makes Google discard the whole cluster.
    const alternateLocales = isPrimaryColor
      ? languages
          .filter(l => l !== locale)
          .map(altLng => ({
            locale: altLng,
            url: `/${altLng}/product/${baseSku}/${colorSlug}`,
          }))
      : []

    return buildMetadata({
      title,
      description: productDescription,
      url,
      canonicalUrl,
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
  let breadcrumbStructuredData: object | null = null
  let breadcrumbs: BreadcrumbCrumb[] = []
  let lcpImageUrl: string | null = null
  try {
    const product = await getCachedProductByBaseSku(baseSku)
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

        // Same composed name as the <title>, so the structured data and the
        // visible page agree on what this product is called. Previously this
        // emitted the bare brand ("IL BORGO FIRENZE") as schema.org `name`,
        // which is what an AI assistant or shopping surface reads back.
        // getCachedCategoryById is request-cached, so this costs nothing on
        // top of the generateMetadata lookup above.
        const locale = lng as 'en' | 'he'
        const categoryTrail = await resolveCategoryTrail(product, locale)
        const colorName = getColorName(colorSlug, locale)
        const productName = buildProductTitle({
          seoTitleOverride: locale === 'he' ? product.seo?.title_he : product.seo?.title_en,
          productTitle: locale === 'he' ? product.title_he : product.title_en,
          categoryName: categoryTrail[categoryTrail.length - 1]?.name,
          colorName,
        }) || product.sku
        const productDesc = (lng === 'he' ? product.description_he : product.description_en) || ''

        // Home > category trail > this product. The final crumb deliberately
        // uses brand + colour rather than the composed page title, which
        // already leads with the category and would read as a repeat of the
        // crumb immediately before it.
        breadcrumbs = [
          { name: locale === 'he' ? 'בית' : 'Home', url: `/${lng}` },
          ...categoryTrail.map((crumb) => ({
            name: crumb.name,
            url: `/${lng}/collection/${crumb.path}`,
          })),
          {
            name: [locale === 'he' ? product.title_he : product.title_en, colorName]
              .filter(Boolean)
              .join(' – ') || product.sku,
          },
        ]
        breadcrumbStructuredData = buildBreadcrumbStructuredData(breadcrumbs)

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
      {breadcrumbStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
        />
      )}
      <Breadcrumbs crumbs={breadcrumbs} />
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
