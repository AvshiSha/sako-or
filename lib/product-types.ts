import type { ProductImageDetail } from '@/lib/product-images'
import type {
  SizeFit,
  FootWidthFit,
  ArchFit,
  AdjustableFeature,
  UpperMaterial,
  Lining,
  Insole,
  Outsole,
  ToeShape,
  HeelType,
  ClosureType,
  SoleType,
  HeelHeightCm,
} from '@/lib/product-enums'

export interface Product {
  id?: string
  sku: string
  title_en: string
  title_he: string
  /** Short title for product cards / places the full title is too long. */
  shortTitle_en?: string
  shortTitle_he?: string
  description_en: string
  description_he: string
  /** Short description, distinct from the full description above. */
  shortDescription_en?: string
  shortDescription_he?: string
  category: string
  subCategory?: string
  subSubCategory?: string
  categories_path: string[]
  categories_path_id: string[]
  brand: string
  price: number
  salePrice?: number
  currency: string
  colorVariants: Record<
    string,
    {
      colorSlug: string
      isActive?: boolean
      priceOverride?: number
      salePrice?: number
      stockBySize: Record<string, number>
      metaTitle?: string
      metaDescription?: string
      images: string[]
      /** Optional per-image alt text/type/order, keyed by URL to entries in `images`. Use normalizeProductImages() to read both together. */
      imageDetails?: ProductImageDetail[]
      primaryImage?: string
      videos?: string[]
    }
  >
  isEnabled: boolean
  isDeleted: boolean
  newProduct: boolean
  featuredProduct: boolean
  materialCare?: {
    upperMaterial_en?: string
    upperMaterial_he?: string
    materialInnerSole_en?: string
    materialInnerSole_he?: string
    lining_en?: string
    lining_he?: string
    sole_en?: string
    sole_he?: string
    heelHeight_en?: string
    heelHeight_he?: string
    height_en?: string
    height_he?: string
    depth_en?: string
    depth_he?: string
    width_en?: string
    width_he?: string
    // New structured specification fields
    toeShape_en?: string
    toeShape_he?: string
    closureType_en?: string
    closureType_he?: string
    heelType_en?: string
    heelType_he?: string
    careInstructions_en?: string
    careInstructions_he?: string
    // Dropdown-backed attribute fields (single stable value; labels resolved via
    // getOptionLabel, never persisted). Separate from the legacy _en/_he pairs
    // above, which remain as historical/reconciliation-hint data only.
    upperMaterial?: UpperMaterial[]
    lining?: Lining
    insole?: Insole
    outsole?: Outsole
    soleType?: SoleType
    toeShape?: ToeShape
    heelType?: HeelType
    closureType?: ClosureType
    heelHeight?: HeelHeightCm
  }
  /** Only meaningful for footwear products (see getCategoryFieldGroup in lib/product-enums.ts). */
  shoeFit?: {
    sizeFit?: SizeFit
    footWidthFit?: FootWidthFit
    archFit?: ArchFit
    adjustableFeatures?: AdjustableFeature[]
    recommendation_en?: string
    recommendation_he?: string
    notes_en?: string
    notes_he?: string
  }
  seo?: {
    title_en?: string
    title_he?: string
    description_en?: string
    description_he?: string
    slug?: string
    focusKeyword_en?: string
    focusKeyword_he?: string
    secondaryKeywords_en?: string[]
    secondaryKeywords_he?: string[]
  }
  searchKeywords?: string[]
  createdAt: Date
  updatedAt: Date
  name?: {
    en: string
    he: string
  }
  slug?: {
    en: string
    he: string
  }
  description?: {
    en: string
    he: string
  }
  baseSku?: string
  featured?: boolean
  isNew?: boolean
  isActive?: boolean
  categoryId?: string
  categorySlug?: string
  categoryObj?: unknown
  categoryPath?: string
  upperMaterial?: {
    en: string
    he: string
  }
  materialInnerSole?: {
    en: string
    he: string
  }
  lining?: {
    en: string
    he: string
  }
  sole?: {
    en: string
    he: string
  }
  heelHeight?: {
    en: string
    he: string
  }
  shippingReturns?: {
    en: string
    he: string
  }
  tags: string[]
  videoUrl?: string
}

export interface ColorVariant {
  id?: string
  colorName: string
  colorSlug: string
  colorHex?: string
  price?: number
  salePrice?: number
  saleStartDate?: Date
  saleEndDate?: Date
  stock: number
  isActive: boolean
  videoUrl?: string
  metaTitle?: string
  metaDescription?: string
  createdAt: Date
  updatedAt: Date
  images: ColorVariantImage[]
  sizes: ColorVariantSize[]
}

export interface ColorVariantImage {
  id?: string
  url: string
  alt?: string
  isPrimary: boolean
  order: number
  createdAt: Date
}

export interface ColorVariantSize {
  id?: string
  size: string
  stock: number
  sku?: string
  createdAt: Date
  updatedAt: Date
}

export interface VariantItem {
  product: Product
  variant: {
    colorSlug: string
    isActive?: boolean
    priceOverride?: number
    salePrice?: number
    stockBySize: Record<string, number>
    metaTitle?: string
    metaDescription?: string
    images: string[]
    primaryImage?: string
    videos?: string[]
  }
  variantKey: string
}

/**
 * Fields the product detail page's client component actually renders. Used to
 * narrow the RSC → client payload instead of shipping the whole Firestore
 * document — notably excludes `categoryObj` (a full joined category doc),
 * `seo`/`searchKeywords`, and internal flags like `isDeleted`/`isEnabled`.
 */
const PRODUCT_CLIENT_VIEW_FIELDS = [
  'sku',
  'baseSku',
  'currency',
  'price',
  'salePrice',
  'category',
  'categories_path',
  'title_en',
  'title_he',
  'brand',
  'description_en',
  'description_he',
  'name',
  'description',
  'materialCare',
  'upperMaterial',
  'materialInnerSole',
  'lining',
  'sole',
  'heelHeight',
  'shoeFit',
  'shippingReturns',
] as const satisfies readonly (keyof Product)[]

export type ProductClientView = Pick<Product, (typeof PRODUCT_CLIENT_VIEW_FIELDS)[number]>

export function pickProductClientView(product: Product): ProductClientView {
  const picked: Record<string, unknown> = {}
  for (const key of PRODUCT_CLIENT_VIEW_FIELDS) {
    picked[key] = product[key]
  }
  return picked as ProductClientView
}

export const productHelpers = {
  getField: (
    product: Pick<Product, 'name' | 'description' | 'slug'>,
    field: 'name' | 'description' | 'slug',
    language: 'en' | 'he'
  ): string => {
    return product[field]?.[language] || product[field]?.en || ''
  },

  getImageAlt: (image: ColorVariantImage, _language: 'en' | 'he'): string => {
    return image.alt || ''
  },

  generateSlug: (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  },

  validateBilingualProduct: (
    product: Record<string, unknown>
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    const name = product.name as { en?: string; he?: string } | undefined
    const description = product.description as { en?: string; he?: string } | undefined
    const slug = product.slug as { en?: string; he?: string } | undefined

    if (!name || typeof name !== 'object') {
      errors.push('Product name must be an object with en and he properties')
    } else {
      if (!name.en || name.en.trim() === '') {
        errors.push('English name is required')
      }
      if (!name.he || name.he.trim() === '') {
        errors.push('Hebrew name is required')
      }
    }

    if (!description || typeof description !== 'object') {
      errors.push('Product description must be an object with en and he properties')
    } else {
      if (!description.en || description.en.trim() === '') {
        errors.push('English description is required')
      }
      if (!description.he || description.he.trim() === '') {
        errors.push('Hebrew description is required')
      }
    }

    if (!slug || typeof slug !== 'object') {
      console.log('Slug will be auto-generated for product:', name?.en)
    } else {
      if (!slug.en || slug.en.trim() === '') {
        console.log('English slug will be auto-generated for product:', name?.en)
      }
      if (!slug.he || slug.he.trim() === '') {
        console.log('Hebrew slug will be auto-generated for product:', name?.en)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  },
}
