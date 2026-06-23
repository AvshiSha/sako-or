export interface Product {
  id?: string
  sku: string
  title_en: string
  title_he: string
  description_en: string
  description_he: string
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
  }
  seo?: {
    title_en?: string
    title_he?: string
    description_en?: string
    description_he?: string
    slug?: string
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

export const productHelpers = {
  getField: (
    product: Product,
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
