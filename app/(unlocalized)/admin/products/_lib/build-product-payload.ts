import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { resizeProductImageFile } from '@/lib/resize-image-file'
import type {
  CategoryLike,
  ColorVariantFormInput,
  ProductFormInput,
  ProductImageFileInput,
  ProductVideoFileInput,
} from './product-form-types'

function categoryName(category: CategoryLike | undefined): { en: string; he: string } {
  if (!category) return { en: '', he: '' }
  return typeof category.name === 'object' ? category.name : { en: category.name, he: category.name }
}

function categorySlug(category: CategoryLike | undefined): string | undefined {
  if (!category) return undefined
  return typeof category.slug === 'object' ? category.slug.en : category.slug
}

/** Resolves the 3-level category selection into path slugs/ids + resolved bilingual names, exactly as the real product save does. */
export function resolveCategoryPath(
  formData: Pick<ProductFormInput, 'category' | 'subCategory' | 'subSubCategory'>,
  categories: CategoryLike[]
) {
  const categories_path: string[] = []
  const categories_path_id: string[] = []
  let category_en = ''
  let category_he = ''
  let subCategory_en = ''
  let subCategory_he = ''
  let subSubCategory_en = ''
  let subSubCategory_he = ''

  const mainCategory = categories.find((cat) => cat.id === formData.category)
  if (mainCategory) {
    const mainSlug = categorySlug(mainCategory)
    const mainName = categoryName(mainCategory)
    if (mainSlug) {
      categories_path.push(mainSlug)
      if (mainCategory.id) categories_path_id.push(mainCategory.id)
    }
    category_en = mainName.en
    category_he = mainName.he

    if (formData.subCategory) {
      const subCategory = categories.find((cat) => cat.id === formData.subCategory)
      if (subCategory) {
        const subSlug = categorySlug(subCategory)
        const subName = categoryName(subCategory)
        if (subSlug) {
          categories_path.push(subSlug)
          if (subCategory.id) categories_path_id.push(subCategory.id)
        }
        subCategory_en = subName.en
        subCategory_he = subName.he

        if (formData.subSubCategory) {
          const subSubCategory = categories.find((cat) => cat.id === formData.subSubCategory)
          if (subSubCategory) {
            const subSubSlug = categorySlug(subSubCategory)
            const subSubName = categoryName(subSubCategory)
            if (subSubSlug) {
              categories_path.push(subSubSlug)
              if (subSubCategory.id) categories_path_id.push(subSubCategory.id)
            }
            subSubCategory_en = subSubName.en
            subSubCategory_he = subSubName.he
          }
        }
      }
    }
  }

  return {
    categories_path,
    categories_path_id,
    category_en,
    category_he,
    subCategory_en,
    subCategory_he,
    subSubCategory_en,
    subSubCategory_he,
  }
}

export interface UploadVariantDeps {
  sku: string
  onImagesUpdate?: (variantId: string, images: ProductImageFileInput[]) => void
  onVideoUpdate?: (variantId: string, video: ProductVideoFileInput | null) => void
}

/** Uploads any not-yet-uploaded images for one variant to Firebase Storage, reusing already-uploaded URLs as-is. */
async function uploadVariantImages(variant: ColorVariantFormInput, deps: UploadVariantDeps): Promise<string[]> {
  const uploadedUrls: string[] = []

  for (let i = 0; i < variant.images.length; i++) {
    const imageFile = variant.images[i]
    if (imageFile.uploaded && imageFile.url) {
      uploadedUrls.push(imageFile.url)
      continue
    }

    try {
      deps.onImagesUpdate?.(
        variant.id,
        variant.images.map((img, idx) => (idx === i ? { ...img, uploading: true } : img))
      )

      const processedFile = await resizeProductImageFile(imageFile.file)
      const fileName = `products/${deps.sku}/${variant.colorSlug}/${Date.now()}-${i}-${processedFile.name}`
      const storageRef = ref(storage, fileName)
      const snapshot = await uploadBytes(storageRef, processedFile)
      const downloadURL = await getDownloadURL(snapshot.ref)

      deps.onImagesUpdate?.(
        variant.id,
        variant.images.map((img, idx) => (idx === i ? { ...img, uploading: false, uploaded: true, url: downloadURL } : img))
      )

      uploadedUrls.push(downloadURL)
    } catch (error) {
      console.error('Error uploading variant image:', error)
      deps.onImagesUpdate?.(
        variant.id,
        variant.images.map((img, idx) => (idx === i ? { ...img, uploading: false } : img))
      )
    }
  }

  return uploadedUrls
}

async function uploadVariantVideo(variant: ColorVariantFormInput, deps: UploadVariantDeps): Promise<string | null> {
  const videoFile = variant.video
  if (!videoFile) return null
  if (videoFile.uploaded && videoFile.url) return videoFile.url
  if (!videoFile.file) return null

  try {
    deps.onVideoUpdate?.(variant.id, { ...videoFile, uploading: true })

    const fileName = `products/${deps.sku}/${variant.colorSlug}/video/${Date.now()}-${videoFile.file.name}`
    const storageRef = ref(storage, fileName)
    const snapshot = await uploadBytes(storageRef, videoFile.file)
    const downloadURL = await getDownloadURL(snapshot.ref)

    deps.onVideoUpdate?.(variant.id, { ...videoFile, uploading: false, uploaded: true, url: downloadURL })
    return downloadURL
  } catch (error) {
    console.error('Error uploading variant video:', error)
    deps.onVideoUpdate?.(variant.id, { ...videoFile, uploading: false })
    return null
  }
}

/**
 * Builds the exact Firestore-shaped product object (colorVariants map, resolved
 * category path/names, materialCare/shoeFit/seo passthrough) from the admin
 * form's in-memory state — uploading any pending local image/video files along
 * the way. This is the single normalization layer shared by: the Add Product
 * page's real create, and the Preview flow on both Add and Edit Product pages.
 */
export async function buildProductPayload(
  formData: ProductFormInput,
  categories: CategoryLike[],
  deps: Omit<UploadVariantDeps, 'sku'>
): Promise<Record<string, unknown>> {
  const uploadDeps: UploadVariantDeps = { sku: formData.sku, ...deps }

  const colorVariants: Record<string, unknown> = {}
  for (const variant of formData.colorVariants) {
    const uploadedImages = await uploadVariantImages(variant, uploadDeps)
    const videoUrl = variant.video?.file ? await uploadVariantVideo(variant, uploadDeps) : variant.video?.url ?? null

    const primaryImageIndex = variant.images.findIndex((img) => img.isPrimary)
    const primaryImageUrl =
      primaryImageIndex >= 0 && primaryImageIndex < uploadedImages.length
        ? uploadedImages[primaryImageIndex]
        : uploadedImages[0] || null

    const imageDetails = uploadedImages.map((url, index) => ({
      url,
      altEn: variant.images[index]?.altEn || undefined,
      altHe: variant.images[index]?.altHe || undefined,
      type: variant.images[index]?.imageType || undefined,
      order: index,
    }))

    colorVariants[variant.colorSlug] = {
      colorSlug: variant.colorSlug,
      isActive: variant.isActive !== false,
      priceOverride: variant.price || null,
      salePrice: variant.salePrice || null,
      stockBySize: variant.stockBySize,
      metaTitle: variant.metaTitle || '',
      metaDescription: variant.metaDescription || '',
      images: uploadedImages,
      imageDetails,
      primaryImage: primaryImageUrl,
      videos: videoUrl ? [videoUrl] : [],
    }
  }

  const categoryPath = resolveCategoryPath(formData, categories)

  return {
    sku: formData.sku,
    title_en: formData.title_en,
    title_he: formData.title_he,
    shortTitle_en: formData.shortTitle_en || null,
    shortTitle_he: formData.shortTitle_he || null,
    description_en: formData.description_en,
    description_he: formData.description_he,
    shortDescription_en: formData.shortDescription_en || null,
    shortDescription_he: formData.shortDescription_he || null,
    category: formData.category,
    subCategory: formData.subCategory || null,
    subSubCategory: formData.subSubCategory || null,
    category_en: categoryPath.category_en,
    subCategory_en: categoryPath.subCategory_en || null,
    subSubCategory_en: categoryPath.subSubCategory_en || null,
    category_he: categoryPath.category_he,
    subCategory_he: categoryPath.subCategory_he || null,
    subSubCategory_he: categoryPath.subSubCategory_he || null,
    categories_path: categoryPath.categories_path,
    categories_path_id: categoryPath.categories_path_id,
    brand: formData.brand,
    price: formData.price,
    salePrice: formData.salePrice > 0 ? formData.salePrice : null,
    currency: formData.currency,
    colorVariants,
    isEnabled: formData.isEnabled,
    isDeleted: formData.isDeleted,
    newProduct: formData.newProduct,
    featuredProduct: formData.featuredProduct,
    materialCare: formData.materialCare,
    shoeFit: formData.shoeFit,
    seo: formData.seo,
    searchKeywords: formData.searchKeywords,
    tags: formData.tags || [],
  }
}
