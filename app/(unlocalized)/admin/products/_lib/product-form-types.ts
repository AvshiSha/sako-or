import type {
  ProductImageType,
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
import type { ShoeFitValues } from '../_components/ShoeFitSection'

/**
 * Narrow, structural shapes describing only the fields the shared form
 * helpers (validation / payload building) actually read. Both the Add
 * Product and Edit Product pages' own (slightly-diverged) local
 * `ProductFormData`/`ColorVariantData`/`ImageFile` interfaces already
 * satisfy these structurally, so neither page needs to change its own
 * types to use the shared helpers below.
 */

export interface ProductImageFileInput {
  file: File
  preview: string
  uploading: boolean
  uploaded: boolean
  url?: string
  isPrimary?: boolean
  altEn?: string
  altHe?: string
  imageType?: ProductImageType
}

export interface ProductVideoFileInput {
  file?: File
  preview?: string
  uploading: boolean
  uploaded: boolean
  url?: string
}

export interface ColorVariantFormInput {
  id: string
  colorSlug: string
  isActive: boolean
  price?: number
  salePrice?: number
  stockBySize: Record<string, number>
  metaTitle?: string
  metaDescription?: string
  images: ProductImageFileInput[]
  video: ProductVideoFileInput | null
}

export interface MaterialCareFormInput {
  upperMaterial_en: string
  upperMaterial_he: string
  materialInnerSole_en: string
  materialInnerSole_he: string
  lining_en: string
  lining_he: string
  sole_en: string
  sole_he: string
  heelHeight_en: string
  heelHeight_he: string
  height_en: string
  height_he: string
  depth_en: string
  depth_he: string
  width_en: string
  width_he: string
  toeShape_en?: string
  toeShape_he?: string
  closureType_en?: string
  closureType_he?: string
  heelType_en?: string
  heelType_he?: string
  careInstructions_en?: string
  careInstructions_he?: string
  upperMaterial: UpperMaterial[]
  lining?: Lining
  insole?: Insole
  outsole?: Outsole
  soleType?: SoleType
  toeShape?: ToeShape
  heelType?: HeelType
  closureType?: ClosureType
  heelHeight?: HeelHeightCm
}

export interface SeoFormInput {
  title_en: string
  title_he: string
  description_en: string
  description_he: string
  slug: string
  focusKeyword_en?: string
  focusKeyword_he?: string
  secondaryKeywords_en: string[]
  secondaryKeywords_he: string[]
}

export interface ProductFormInput {
  sku: string
  title_en: string
  title_he: string
  shortTitle_en?: string
  shortTitle_he?: string
  description_en: string
  description_he: string
  shortDescription_en?: string
  shortDescription_he?: string
  category: string
  subCategory?: string
  subSubCategory?: string
  brand: string
  price: number
  salePrice: number
  currency: string
  colorVariants: ColorVariantFormInput[]
  isEnabled: boolean
  isDeleted: boolean
  newProduct: boolean
  featuredProduct: boolean
  materialCare: MaterialCareFormInput
  shoeFit: ShoeFitValues
  seo: SeoFormInput
  searchKeywords: string[]
  tags?: string[]
}

export interface CategoryLike {
  id?: string
  name: string | { en: string; he: string }
  slug: string | { en: string; he: string }
}
