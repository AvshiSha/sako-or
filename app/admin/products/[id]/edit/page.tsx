'use client'

import { useState, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useRouter, useParams } from 'next/navigation'
import { productService, categoryService, Category, storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import SuccessMessage from '@/app/components/SuccessMessage'
import GoogleDrivePicker from '@/app/components/GoogleDrivePicker'
import Image from 'next/image'
import { getColorHex } from '@/lib/colors'
import { resizeProductImageFile } from '@/lib/resize-image-file'
import { 
  ArrowLeftIcon, 
  TrashIcon, 
  PlusIcon, 
  StarIcon,
  VideoCameraIcon,
  PhotoIcon,
  CloudIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { getCategoryFieldGroup, type ProductImageType } from '@/lib/product-enums'
import { normalizeProductImages } from '@/lib/product-images'
import { validateProductFormBasics } from '../../_lib/validate-product-form'
import PreviewProductButton from '../../_components/PreviewProductButton'
import ProductBasicInformationSection from '../../_components/ProductBasicInformationSection'
import ProductClassificationSection from '../../_components/ProductClassificationSection'
import ProductSpecificationsSection from '../../_components/ProductSpecificationsSection'
import ShoeFitSection, { type ShoeFitValues } from '../../_components/ShoeFitSection'
import ProductSeoSection from '../../_components/ProductSeoSection'
import ProductImageSeoFields from '../../_components/ProductImageSeoFields'

interface ColorVariantData {
  id: string;
  colorName: string;
  colorSlug: string;
  colorHex: string;
  price?: number;
  salePrice?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  stock: number;
  isActive: boolean;
  images: ImageFile[];
  video: VideoFile | null;
  sizes: string[];
  stockBySize: Record<string, number>;
  metaTitle?: string;
  metaDescription?: string;
}

interface ProductFormData {
  sku: string;
  title_en: string;
  title_he: string;
  shortTitle_en: string;
  shortTitle_he: string;
  description_en: string;
  description_he: string;
  shortDescription_en: string;
  shortDescription_he: string;
  category: string; // Level 1 category ID
  subCategory: string; // Level 2 category ID
  subSubCategory: string; // Level 3 category ID
  categories_path: string[];
  categories_path_id: string[];
  brand: string;
  price: number;
  salePrice: number;
  currency: string;
  colorVariants: ColorVariantData[];
  isEnabled: boolean;
  isDeleted: boolean;
  newProduct: boolean;
  featuredProduct: boolean;

  // Material & Care fields (Product Specifications)
  materialCare: {
    upperMaterial_en: string;
    upperMaterial_he: string;
    materialInnerSole_en: string;
    materialInnerSole_he: string;
    lining_en: string;
    lining_he: string;
    sole_en: string;
    sole_he: string;
    heelHeight_en: string;
    heelHeight_he: string;
    height_en: string;
    height_he: string;
    depth_en: string;
    depth_he: string;
    width_en: string;
    width_he: string;
    toeShape_en?: string;
    toeShape_he?: string;
    closureType_en?: string;
    closureType_he?: string;
    heelType_en?: string;
    heelType_he?: string;
    careInstructions_en?: string;
    careInstructions_he?: string;
  };

  // Shoe Fit and Sizing (only meaningful for footwear categories)
  shoeFit: ShoeFitValues;

  // SEO fields
  seo: {
    title_en: string;
    title_he: string;
    description_en: string;
    description_he: string;
    slug: string;
    focusKeyword_en?: string;
    focusKeyword_he?: string;
    secondaryKeywords_en: string[];
    secondaryKeywords_he: string[];
  };

  searchKeywords: string[];
  tags: string[];
}

interface FormErrors {
  sku?: string;
  title_en?: string;
  title_he?: string;
  description_en?: string;
  description_he?: string;
  price?: string;
  brand?: string;
  category?: string;
  subCategory?: string;
  subSubCategory?: string;
  colorVariants?: string;
  seoSlug?: string;
  shoeFit?: string;
}

interface ImageFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  isPrimary?: boolean;
  order?: number;
  altEn?: string;
  altHe?: string;
  imageType?: ProductImageType;
}

interface VideoFile {
  file?: File;
  preview?: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  name?: string;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  parents?: string[];
}

const commonSizes = ['One size', 'XS', 'S', 'M', 'L', 'XL', 'XXL','34','35','36', '37', '38', '39', '40', '41', '42', '43', '44', '45','46'];
const commonColors = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Orange', 'light Brown', 'Dark Brown', 'Gray', 'Navy', 'Beige', 'Gold', 'Silver', 'Off White', 'Light Blue', 'Dark Blue', 'Bordeaux', 'Black nail polish', 'Olive', 'Multicolor', 'Black & White', 'Transparent', 'camel', 'light pink', 'caramel', 'bronze', 'black-red','nude','lyla'];

/** Parse comma-separated tags for storage; input field keeps raw string so trailing commas are not erased. */
function parseCommaSeparatedTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

/** Category.name can be either a plain string or a { en, he } object depending on data source. */
function getCategoryEnglishName(category: Category | undefined): string | undefined {
  if (!category) return undefined
  return typeof category.name === 'object' ? category.name.en : category.name
}

function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params?.id as string
  
  const [categories, setCategories] = useState<Category[]>([])
  const [mainCategories, setMainCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<Category[]>([])
  const [subSubCategories, setSubSubCategories] = useState<Category[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState(false)
  const [currentVariantForGoogleDrive, setCurrentVariantForGoogleDrive] = useState<string | null>(null)
  const [showGoogleDriveVideoPicker, setShowGoogleDriveVideoPicker] = useState(false)
  const [currentVariantForGoogleDriveVideo, setCurrentVariantForGoogleDriveVideo] = useState<string | null>(null)
  const [originalFormData, setOriginalFormData] = useState<ProductFormData | null>(null)
  const [tagsInputValue, setTagsInputValue] = useState('')
  const [searchKeywordsInputValue, setSearchKeywordsInputValue] = useState('')

  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    title_en: '',
    title_he: '',
    shortTitle_en: '',
    shortTitle_he: '',
    description_en: '',
    description_he: '',
    shortDescription_en: '',
    shortDescription_he: '',
    category: '',
    subCategory: '',
    subSubCategory: '',
    categories_path: [],
    categories_path_id: [],
    brand: '',
    price: 0,
    salePrice: 0,
    currency: 'ILS',
    colorVariants: [],
    isEnabled: true,
    isDeleted: false,
    newProduct: false,
    featuredProduct: false,

    // Material & Care fields
    materialCare: {
      upperMaterial_en: '',
      upperMaterial_he: '',
      materialInnerSole_en: '',
      materialInnerSole_he: '',
      lining_en: '',
      lining_he: '',
      sole_en: '',
      sole_he: '',
      heelHeight_en: '',
      heelHeight_he: '',
      height_en: '',
      height_he: '',
      depth_en: '',
      depth_he: '',
      width_en: '',
      width_he: ''
    },

    // Shoe Fit and Sizing
    shoeFit: {
      adjustableFeatures: [],
    },

    // SEO fields
    seo: {
      title_en: '',
      title_he: '',
      description_en: '',
      description_he: '',
      slug: '',
      secondaryKeywords_en: [],
      secondaryKeywords_he: [],
    },

    searchKeywords: [],
    tags: []
  })

  const categoryFieldGroup = getCategoryFieldGroup(
    getCategoryEnglishName(mainCategories.find((cat) => cat.id === formData.category)),
    getCategoryEnglishName(subCategories.find((cat) => cat.id === formData.subCategory)),
    getCategoryEnglishName(subSubCategories.find((cat) => cat.id === formData.subSubCategory))
  )

  /** categories_path only gets populated with names at submit time, so resolve IDs -> names here too for the SEO export snapshot. */
  const seoCategoryPath = [
    getCategoryEnglishName(mainCategories.find((cat) => cat.id === formData.category)),
    getCategoryEnglishName(subCategories.find((cat) => cat.id === formData.subCategory)),
    getCategoryEnglishName(subSubCategories.find((cat) => cat.id === formData.subSubCategory)),
  ].filter((name): name is string => !!name)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const cats = await categoryService.getAllCategories()
        setCategories(cats)
        
        // Filter main categories (level 0) that are enabled
        const mainCats = cats.filter(cat => cat.level === 0 && cat.isEnabled)
        setMainCategories(mainCats)
        
        // Fetch product data
        const product = await productService.getProductById(productId)
        if (product) {
          console.log('Fetched product data:', product) // Debug log
          console.log('Color variants:', product.colorVariants) // Debug color variants
          
          // Convert color variants to the new format
          const colorVariants: ColorVariantData[] = product.colorVariants ? Object.values(product.colorVariants).map((variant, index) => ({
            id: `existing-${index}`,
            colorName: variant.colorSlug.charAt(0).toUpperCase() + variant.colorSlug.slice(1).replace(/-/g, ' '),
            colorSlug: variant.colorSlug,
            colorHex: (variant as any).colorHex || getColorHex(variant.colorSlug),
            price: variant.priceOverride,
            salePrice: variant.salePrice,
            stock: Object.values(variant.stockBySize || {}).reduce((sum, stock) => sum + stock, 0),
            isActive: variant.isActive !== false, // Load the isActive flag, default to true if not specified
            images: normalizeProductImages(variant.images, (variant as { imageDetails?: unknown }).imageDetails).map((img) => ({
              file: new File([], 'existing-image'),
              preview: img.url,
              uploading: false,
              uploaded: true,
              url: img.url,
              isPrimary: variant.primaryImage === img.url,
              order: img.order,
              altEn: img.altEn,
              altHe: img.altHe,
              imageType: img.type,
            })),
            video: variant.videos && variant.videos.length > 0 ? {
              file: new File([], 'existing-video'),
              preview: variant.videos[0],
              uploading: false,
              uploaded: true,
              url: variant.videos[0],
              name: 'Existing Video'
            } : null,
            sizes: Object.keys(variant.stockBySize || {}),
            stockBySize: variant.stockBySize || {},
            metaTitle: variant.metaTitle || '',
            metaDescription: variant.metaDescription || ''
          })) : []
          
          const loadedMaterialCare = product.materialCare || {}
          const loadedTags = product.tags || []
          const nextFormData: ProductFormData = {
            sku: product.sku || product.baseSku || '',
            title_en: product.title_en || product.name?.en || '',
            title_he: product.title_he || product.name?.he || '',
            shortTitle_en: product.shortTitle_en || '',
            shortTitle_he: product.shortTitle_he || '',
            description_en: product.description_en || product.description?.en || '',
            description_he: product.description_he || product.description?.he || '',
            shortDescription_en: product.shortDescription_en || '',
            shortDescription_he: product.shortDescription_he || '',
            category: product.categoryId || product.category || '',
            subCategory: product.subCategory || '',
            subSubCategory: product.subSubCategory || '',
            categories_path: [...(product.categories_path || [])],
            categories_path_id: [...(product.categories_path_id || [])],
            brand: product.brand || '',
            price: product.price || 0,
            salePrice: product.salePrice || 0,
            currency: product.currency || 'ILS',
            colorVariants: colorVariants,
            isEnabled: product.isEnabled !== false,
            isDeleted: product.isDeleted || false,
            newProduct: product.isNew || product.newProduct || false,
            featuredProduct: product.featured || product.featuredProduct || false,
            
            // Material & Care fields (prefer new structure, fallback to legacy)
            materialCare: {
              upperMaterial_en: loadedMaterialCare.upperMaterial_en || product.upperMaterial?.en || '',
              upperMaterial_he: loadedMaterialCare.upperMaterial_he || product.upperMaterial?.he || '',
              materialInnerSole_en: loadedMaterialCare.materialInnerSole_en || product.materialInnerSole?.en || '',
              materialInnerSole_he: loadedMaterialCare.materialInnerSole_he || product.materialInnerSole?.he || '',
              lining_en: loadedMaterialCare.lining_en || product.lining?.en || '',
              lining_he: loadedMaterialCare.lining_he || product.lining?.he || '',
              sole_en: loadedMaterialCare.sole_en || product.sole?.en || '',
              sole_he: loadedMaterialCare.sole_he || product.sole?.he || '',
              heelHeight_en: loadedMaterialCare.heelHeight_en || product.heelHeight?.en || '',
              heelHeight_he: loadedMaterialCare.heelHeight_he || product.heelHeight?.he || '',
              height_en: loadedMaterialCare.height_en || '',
              height_he: loadedMaterialCare.height_he || '',
              depth_en: loadedMaterialCare.depth_en || '',
              depth_he: loadedMaterialCare.depth_he || '',
              width_en: loadedMaterialCare.width_en || '',
              width_he: loadedMaterialCare.width_he || '',
              toeShape_en: loadedMaterialCare.toeShape_en || '',
              toeShape_he: loadedMaterialCare.toeShape_he || '',
              closureType_en: loadedMaterialCare.closureType_en || '',
              closureType_he: loadedMaterialCare.closureType_he || '',
              heelType_en: loadedMaterialCare.heelType_en || '',
              heelType_he: loadedMaterialCare.heelType_he || '',
              careInstructions_en: loadedMaterialCare.careInstructions_en || '',
              careInstructions_he: loadedMaterialCare.careInstructions_he || ''
            },

            // Shoe Fit and Sizing (safe defaults for existing products without this data)
            shoeFit: {
              sizeFit: product.shoeFit?.sizeFit,
              footWidthFit: product.shoeFit?.footWidthFit,
              archFit: product.shoeFit?.archFit,
              adjustableFeatures: product.shoeFit?.adjustableFeatures || [],
              recommendation_en: product.shoeFit?.recommendation_en || '',
              recommendation_he: product.shoeFit?.recommendation_he || '',
              notes_en: product.shoeFit?.notes_en || '',
              notes_he: product.shoeFit?.notes_he || '',
            },

            // SEO fields
            seo: {
              title_en: product.seo?.title_en || '',
              title_he: product.seo?.title_he || '',
              description_en: product.seo?.description_en || '',
              description_he: product.seo?.description_he || '',
              slug: product.seo?.slug || '',
              focusKeyword_en: product.seo?.focusKeyword_en || '',
              focusKeyword_he: product.seo?.focusKeyword_he || '',
              secondaryKeywords_en: [...(product.seo?.secondaryKeywords_en || [])],
              secondaryKeywords_he: [...(product.seo?.secondaryKeywords_he || [])],
            },

            searchKeywords: [...(product.searchKeywords || [])],
            tags: [...loadedTags]
          }
          // One synchronous commit: form, tags text field, and original snapshot stay aligned
          flushSync(() => {
            setFormData(nextFormData)
            setTagsInputValue(loadedTags.join(', '))
            setSearchKeywordsInputValue((product.searchKeywords || []).join(', '))
            // Deep snapshot so nested arrays/objects (tags, colorVariants, etc.) are not shared with formData
            setOriginalFormData(structuredClone(nextFormData))
          })
          
          // Load subcategories if main category is selected
          if (product.categoryId || product.category) {
            try {
              const subCats = await categoryService.getSubCategories(product.categoryId || product.category)
              const enabledSubCats = subCats.filter(cat => cat.isEnabled)
              setSubCategories(enabledSubCats)
              
              // Load sub-subcategories if subcategory is selected
              if (product.subCategory) {
                const subSubCats = await categoryService.getSubCategories(product.subCategory)
                const enabledSubSubCats = subSubCats.filter(cat => cat.isEnabled)
                setSubSubCategories(enabledSubSubCats)
              }
            } catch (error) {
              console.error('Error loading subcategories:', error)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        alert('Failed to load product data')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [productId])

  const handleInputChange = (field: keyof ProductFormData, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
  }

  const handleCategoryChange = async (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      category: categoryId,
      subCategory: '', // Reset subcategory
      subSubCategory: '' // Reset sub-subcategory
    }))
    
    // Clear subcategory and sub-subcategory selections
    setSubCategories([])
    setSubSubCategories([])
    
    // Clear errors
    setErrors(prev => ({
      ...prev,
      category: undefined,
      subCategory: undefined,
      subSubCategory: undefined
    }))
    
    if (categoryId) {
      try {
        // Fetch subcategories for the selected main category
        const subCats = await categoryService.getSubCategories(categoryId)
        const enabledSubCats = subCats.filter(cat => cat.isEnabled)
        setSubCategories(enabledSubCats)
      } catch (error) {
        console.error('Error fetching subcategories:', error)
      }
    }
  }

  const handleSubCategoryChange = async (subCategoryId: string) => {
    setFormData(prev => ({
        ...prev,
      subCategory: subCategoryId,
      subSubCategory: '' // Reset sub-subcategory
    }))
    
    // Clear sub-subcategory selections
    setSubSubCategories([])
    
    // Clear errors
    setErrors(prev => ({
      ...prev,
      subCategory: undefined,
      subSubCategory: undefined
    }))
    
    if (subCategoryId) {
      try {
        // Fetch sub-subcategories for the selected subcategory
        const subSubCats = await categoryService.getSubCategories(subCategoryId)
        const enabledSubSubCats = subSubCats.filter(cat => cat.isEnabled)
        setSubSubCategories(enabledSubSubCats)
      } catch (error) {
        console.error('Error fetching sub-subcategories:', error)
      }
    }
  }

  const handleSubSubCategoryChange = (subSubCategoryId: string) => {
    setFormData(prev => ({
      ...prev,
      subSubCategory: subSubCategoryId
    }))
    
    // Clear error
    setErrors(prev => ({
      ...prev,
      subSubCategory: undefined
    }))
  }

  const handleBasicInfoFieldChange = (field: keyof ProductFormData, value: string) => {
    handleInputChange(field, value)
  }

  const handleSpecificationChange = (field: string, value: string | number | undefined) => {
    setFormData(prev => ({
      ...prev,
      materialCare: { ...prev.materialCare, [field]: value }
    }))
  }

  const handleShoeFitChange = <K extends keyof ShoeFitValues>(field: K, value: ShoeFitValues[K]) => {
    setFormData(prev => ({
      ...prev,
      shoeFit: { ...prev.shoeFit, [field]: value }
    }))
    if (errors.shoeFit) {
      setErrors(prev => ({ ...prev, shoeFit: undefined }))
    }
  }

  const handleSeoChange = <K extends keyof ProductFormData['seo']>(field: K, value: ProductFormData['seo'][K]) => {
    handleInputChange('seo', { ...formData.seo, [field]: value })
  }

  const updateVariantImageMeta = (variantId: string, index: number, updates: { altEn?: string; altHe?: string; type?: ProductImageType }) => {
    const variant = formData.colorVariants.find(v => v.id === variantId)
    if (!variant) return
    const updatedImages = variant.images.map((img, i) =>
      i === index ? { ...img, altEn: updates.altEn, altHe: updates.altHe, imageType: updates.type } : img
    )
    updateColorVariant(variantId, { images: updatedImages })
  }

  // Generate color slug from color name
  const generateColorSlug = (colorName: string): string => {
    return colorName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  // Handle color selection - create/update color variants
  const handleColorSelection = (colorName: string, isSelected: boolean) => {
    if (isSelected) {
      // Create color variant if it doesn't exist
      const existingVariant = formData.colorVariants.find(v => v.colorName === colorName)
      if (!existingVariant) {
        const newVariant: ColorVariantData = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          colorName,
          colorSlug: generateColorSlug(colorName),
          colorHex: getColorHex(colorName),
          stock: 0,
          isActive: true,
          images: [],
          video: null,
          sizes: [...commonSizes],
          stockBySize: {}
        }
        
      setFormData(prev => ({
        ...prev,
          colorVariants: [...prev.colorVariants, newVariant]
      }))
      }
    } else {
      // Remove color variant
      setFormData(prev => ({
        ...prev,
        colorVariants: prev.colorVariants.filter(v => v.colorName !== colorName)
      }))
    }
  }

  // Update color variant data
  const updateColorVariant = (variantId: string, updates: Partial<ColorVariantData>) => {
    setFormData(prev => ({
      ...prev,
      colorVariants: prev.colorVariants.map(variant => 
        variant.id === variantId ? { ...variant, ...updates } : variant
      )
    }))
  }

  // Handle variant size stock change
  const handleVariantSizeStockChange = (variantId: string, size: string, stock: number) => {
    updateColorVariant(variantId, {
      stockBySize: {
        ...formData.colorVariants.find(v => v.id === variantId)?.stockBySize,
        [size]: stock
      }
    })
  }


  // Handle variant image selection
  const handleVariantImageSelect = (variantId: string, files: FileList | null) => {
    if (!files) return;
    
    const variant = formData.colorVariants.find(v => v.id === variantId);
    const existingImages = variant?.images || [];
    const hasExistingImages = existingImages.length > 0;
    
    const newImages: ImageFile[] = Array.from(files).map((file, index) => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
      isPrimary: !hasExistingImages && index === 0 // Set first new image as primary if no existing images
    }));
    
    updateColorVariant(variantId, {
      images: [...existingImages, ...newImages]
    });
  };

  // Remove variant image
  const removeVariantImage = (variantId: string, index: number) => {
    const variant = formData.colorVariants.find(v => v.id === variantId);
    if (!variant) return;

    const imageToRemove = variant.images[index];
    const updatedImages = variant.images.filter((_, i) => i !== index);
    
    // If we removed the primary image, set the first remaining image as primary
    if (imageToRemove.isPrimary && updatedImages.length > 0) {
      updatedImages[0].isPrimary = true;
    }
    
    updateColorVariant(variantId, { images: updatedImages });
  };

  // Handle variant video selection
  const handleVariantVideoSelect = (variantId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('video/mp4')) {
      alert('Please select an MP4 video file');
      return;
    }
    
    // Validate file size (2.5MB = 2.5 * 1024 * 1024 bytes)
    const maxSize = 2.5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Video file size must not exceed 2.5MB');
      return;
    }
    
    const videoFile: VideoFile = {
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false
    };
    
    updateColorVariant(variantId, { video: videoFile });
  };

  // Remove variant video
  const removeVariantVideo = (variantId: string) => {
    updateColorVariant(variantId, { video: null });
  };




  // Handle Google Drive file selection for variants
  const handleGoogleDriveSelect = async (files: any[]) => {
    if (!currentVariantForGoogleDrive) return;

    try {
      if (files.length === 0) {
        alert('Please select at least one image to import.');
        return;
      }

      // Show loading state
      const loadingVariant = formData.colorVariants.find(v => v.id === currentVariantForGoogleDrive);
      if (loadingVariant) {
        updateColorVariant(currentVariantForGoogleDrive, {
          images: loadingVariant.images.map(img => ({ ...img, uploading: true }))
        });
      }

      // Download files from Google Drive
      const response = await fetch('/api/google-drive/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: files.map(file => file.id)
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.files || data.files.length === 0) {
        throw new Error('No files were downloaded successfully');
      }

      // Convert base64 content to File objects
      const importingVariant = formData.colorVariants.find(v => v.id === currentVariantForGoogleDrive);
      const existingImages = importingVariant?.images || [];
      const hasExistingImages = existingImages.length > 0;
      
      const newImages: ImageFile[] = data.files.map((file: any, index: number) => {
        try {
          // Convert base64 to blob
          const byteCharacters = atob(file.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: file.mimeType });
          
          // Create File object
          const fileObj = new File([blob], file.name, { type: file.mimeType });
          
          return {
            file: fileObj,
            preview: URL.createObjectURL(blob),
            uploading: false,
            uploaded: false,
            isPrimary: !hasExistingImages && index === 0 // Set first new image as primary if no existing images
          };
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          return null;
        }
      }).filter(Boolean) as ImageFile[];

      if (newImages.length === 0) {
        throw new Error('No valid images could be processed');
      }

      // Add images to the current variant
      updateColorVariant(currentVariantForGoogleDrive, {
        images: [
          ...formData.colorVariants.find(v => v.id === currentVariantForGoogleDrive)?.images || [],
          ...newImages
        ]
      });

      setShowGoogleDrivePicker(false);
      setCurrentVariantForGoogleDrive(null);

      // Show success message
      alert(`Successfully imported ${newImages.length} image(s) from Google Drive!`);
    } catch (error) {
      console.error('Error importing from Google Drive:', error);
      
      // Reset uploading state
      const errorVariant = formData.colorVariants.find(v => v.id === currentVariantForGoogleDrive);
      if (errorVariant) {
        updateColorVariant(currentVariantForGoogleDrive, {
          images: errorVariant.images.map(img => ({ ...img, uploading: false }))
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to import images from Google Drive: ${errorMessage}`);
    }
  };

  // Handle Google Drive video selection for variants
  const handleGoogleDriveVideoSelect = async (files: any[]) => {
    if (!currentVariantForGoogleDriveVideo) return;

    try {
      if (files.length === 0) {
        alert('Please select a video to import.');
        return;
      }

      if (files.length > 1) {
        alert('Please select only one video file.');
        return;
      }

      const file = files[0];
      
      // Check if it's a video file
      if (!file.mimeType.startsWith('video/')) {
        alert('Please select a video file.');
        return;
      }

      // Check file size (2.5MB limit)
      if (file.size > 2.5 * 1024 * 1024) {
        alert('Video file size must not exceed 2.5MB');
        return;
      }

      // Show loading state
      const loadingVariant = formData.colorVariants.find(v => v.id === currentVariantForGoogleDriveVideo);
      if (loadingVariant) {
        updateColorVariant(currentVariantForGoogleDriveVideo, {
          video: { 
            file: new File([], 'loading'), 
            preview: '', 
            uploading: true, 
      uploaded: false
          }
        });
      }

      // Download file from Google Drive
      const response = await fetch('/api/google-drive/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: [file.id]
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.files || data.files.length === 0) {
        throw new Error('Video file was not downloaded successfully');
      }

      // Convert base64 content to File object
      const videoData = data.files[0];
      try {
        // Convert base64 to blob
        const byteCharacters = atob(videoData.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: videoData.mimeType });
        
        // Create File object
        const videoFile = new File([blob], videoData.name, { type: videoData.mimeType });
        
        // Create preview URL
        const previewUrl = URL.createObjectURL(videoFile);

        // Update the variant with the new video
        const videoFileData: VideoFile = {
          file: videoFile,
          preview: previewUrl,
          uploading: false,
          uploaded: false
        };

        updateColorVariant(currentVariantForGoogleDriveVideo, { video: videoFileData });

        // Close the picker
        setShowGoogleDriveVideoPicker(false);
        setCurrentVariantForGoogleDriveVideo(null);

        alert('Video imported successfully from Google Drive!');
      } catch (conversionError) {
        console.error('Error converting video file:', conversionError);
        throw new Error('Failed to process video file');
      }
    } catch (error) {
      console.error('Error importing video from Google Drive:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to import video from Google Drive: ${errorMessage}`);
      
      // Reset video state on error
      if (currentVariantForGoogleDriveVideo) {
        updateColorVariant(currentVariantForGoogleDriveVideo, { video: null });
      }
    }
  };

  // Open Google Drive picker for a specific variant
  const openGoogleDrivePicker = (variantId: string) => {
    setCurrentVariantForGoogleDrive(variantId);
    setShowGoogleDrivePicker(true);
  };

  // Open Google Drive video picker for a specific variant
  const openGoogleDriveVideoPicker = (variantId: string) => {
    setCurrentVariantForGoogleDriveVideo(variantId);
    setShowGoogleDriveVideoPicker(true);
  };

  // Set primary image for a variant
  const setPrimaryImage = (variantId: string, imageIndex: number) => {
    const variant = formData.colorVariants.find(v => v.id === variantId);
    if (!variant) return;

    // Update all images to set isPrimary correctly
    const updatedImages = variant.images.map((img, index) => ({
      ...img,
      isPrimary: index === imageIndex
    }));

    updateColorVariant(variantId, { images: updatedImages });
  };

  const uploadImageToFirebase = async (imageFile: ImageFile): Promise<string> => {
    // If it's already uploaded (from Google Drive), return the URL
    if (imageFile.uploaded && imageFile.url) {
      return imageFile.url
    }
    
    console.log('Uploading image:', imageFile.file.name)
    const processedFile = await resizeProductImageFile(imageFile.file)
    const timestamp = Date.now();
    const fileName = `${timestamp}_${processedFile.name}`;
    const storageRef = ref(storage, `products/${fileName}`);
    
    const snapshot = await uploadBytes(storageRef, processedFile);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('Download URL obtained:', downloadURL)
    return downloadURL;
  }

  const uploadVideoToFirebase = async (videoFile: VideoFile): Promise<string> => {
    // If it's already uploaded (from Google Drive), return the URL
    if (videoFile.uploaded && videoFile.url) {
      return videoFile.url
    }
    
    if (!videoFile.file) {
      throw new Error('No video file to upload')
    }
    
    console.log('Uploading video:', videoFile.file.name)
    const timestamp = Date.now();
    const fileName = `${timestamp}_${videoFile.file.name}`;
    const storageRef = ref(storage, `products/videos/${fileName}`);
    
    const snapshot = await uploadBytes(storageRef, videoFile.file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('Video download URL obtained:', downloadURL)
    return downloadURL;
  }

  // Upload variant images
  const uploadVariantImages = async (variantId: string): Promise<string[]> => {
    const variant = formData.colorVariants.find(v => v.id === variantId);
    if (!variant) return [];

    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < variant.images.length; i++) {
      const imageFile = variant.images[i];
      if (imageFile.uploaded && imageFile.url) {
        uploadedUrls.push(imageFile.url);
        continue;
      }

      try {
        // Mark as uploading
        updateColorVariant(variantId, {
          images: variant.images.map((img, idx) => 
            idx === i ? { ...img, uploading: true } : img
          )
        });

        // Upload to Firebase Storage
        const processedFile = await resizeProductImageFile(imageFile.file)
        const fileName = `products/${formData.sku}/${variant.colorSlug}/${Date.now()}-${i}-${processedFile.name}`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, processedFile);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Mark as uploaded
        updateColorVariant(variantId, {
          images: variant.images.map((img, idx) => 
            idx === i ? { ...img, uploading: false, uploaded: true, url: downloadURL } : img
          )
        });

        uploadedUrls.push(downloadURL);
      } catch (error) {
        console.error('Error uploading variant image:', error);
        // Mark as failed
        updateColorVariant(variantId, {
          images: variant.images.map((img, idx) => 
            idx === i ? { ...img, uploading: false } : img
          )
        });
      }
    }

    return uploadedUrls;
  };

  // Upload variant video
  const uploadVariantVideo = async (variantId: string): Promise<string | null> => {
    const variant = formData.colorVariants.find(v => v.id === variantId);
    if (!variant || !variant.video) return null;
    
    const videoFile = variant.video;
    if (videoFile.uploaded && videoFile.url) {
      return videoFile.url;
    }

    try {
      // Mark as uploading
      updateColorVariant(variantId, {
        video: { ...videoFile, uploading: true }
      });

      // Upload to Firebase Storage
      const fileName = `products/${formData.sku}/${variant.colorSlug}/video/${Date.now()}-${videoFile.file?.name || 'video'}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, videoFile.file!);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Mark as uploaded
      updateColorVariant(variantId, {
        video: { ...videoFile, uploading: false, uploaded: true, url: downloadURL }
      });

      return downloadURL;
    } catch (error) {
      console.error('Error uploading variant video:', error);
      // Mark as failed
      updateColorVariant(variantId, {
        video: { ...videoFile, uploading: false }
      });
      return null;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = validateProductFormBasics(formData, categoryFieldGroup)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('Form submission started')
    
    if (!validateForm()) {
      console.log('Form validation failed')
      alert('Please fill in all required fields and check for errors.')
      return
    }

    console.log('Form validation passed, starting submission')
    setIsSubmitting(true)

    try {
      console.log('Preparing product data...')
      
      // Build categories path and IDs, and resolve Hebrew names
      const categoriesPath: string[] = []
      const categoriesPathId: string[] = []
      let categoryEn = ''
      let categoryHe = ''
      let subCategoryEn = ''
      let subCategoryHe = ''
      let subSubCategoryEn = ''
      let subSubCategoryHe = ''
      
      const mainCategory = categories.find(cat => cat.id === formData.category)
      if (mainCategory) {
        const mainSlug = typeof mainCategory.slug === 'object' ? mainCategory.slug.en : mainCategory.slug
        const mainNameEn = typeof mainCategory.name === 'object' ? mainCategory.name.en : mainCategory.name
        const mainNameHe = typeof mainCategory.name === 'object' ? mainCategory.name.he : mainCategory.name
        if (mainSlug) {
          categoriesPath.push(mainSlug)
          if (mainCategory.id) {
            categoriesPathId.push(mainCategory.id)
          }
        }
        categoryEn = mainNameEn
        categoryHe = mainNameHe
        
        if (formData.subCategory) {
          const subCategory = categories.find(cat => cat.id === formData.subCategory)
          if (subCategory) {
            const subSlug = typeof subCategory.slug === 'object' ? subCategory.slug.en : subCategory.slug
            const subNameEn = typeof subCategory.name === 'object' ? subCategory.name.en : subCategory.name
            const subNameHe = typeof subCategory.name === 'object' ? subCategory.name.he : subCategory.name
            if (subSlug) {
              categoriesPath.push(subSlug)
              if (subCategory.id) {
                categoriesPathId.push(subCategory.id)
              }
            }
            subCategoryEn = subNameEn
            subCategoryHe = subNameHe
            
            if (formData.subSubCategory) {
              const subSubCategory = categories.find(cat => cat.id === formData.subSubCategory)
              if (subSubCategory) {
                const subSubSlug = typeof subSubCategory.slug === 'object' ? subSubCategory.slug.en : subSubCategory.slug
                const subSubNameEn = typeof subSubCategory.name === 'object' ? subSubCategory.name.en : subSubCategory.name
                const subSubNameHe = typeof subSubCategory.name === 'object' ? subSubCategory.name.he : subSubCategory.name
                if (subSubSlug) {
                  categoriesPath.push(subSubSlug)
                  if (subSubCategory.id) {
                    categoriesPathId.push(subSubCategory.id)
                  }
                }
                subSubCategoryEn = subSubNameEn
                subSubCategoryHe = subSubNameHe
              }
            }
          }
        }
      }

      // Convert color variants to the new format
      const colorVariants: Record<string, any> = {}
      for (const variant of formData.colorVariants) {
        const uploadedImages = await uploadVariantImages(variant.id)
        let videoUrl: string | null = null
        if (variant.video) {
          videoUrl = await uploadVariantVideo(variant.id)
        }
        
        // Find the primary image from the uploaded images
        const primaryImageIndex = variant.images.findIndex(img => img.isPrimary)
        const primaryImageUrl = primaryImageIndex >= 0 && uploadedImages[primaryImageIndex] 
          ? uploadedImages[primaryImageIndex] 
          : uploadedImages[0] || null
        
        console.log(`Primary image for ${variant.colorName}:`, {
          primaryImageIndex,
          primaryImageUrl,
          totalImages: uploadedImages.length,
          variantImages: variant.images.map((img, idx) => ({ index: idx, isPrimary: img.isPrimary, url: img.url }))
        })

        // Per-image alt text/type metadata, kept as a parallel array (keyed by URL) so
        // the existing `images: string[]` contract stays unchanged for every other consumer.
        const imageDetails = uploadedImages.map((url, index) => ({
          url,
          altEn: variant.images[index]?.altEn || undefined,
          altHe: variant.images[index]?.altHe || undefined,
          type: variant.images[index]?.imageType || undefined,
          order: index,
        }))

        colorVariants[variant.colorSlug] = {
          colorSlug: variant.colorSlug,
          isActive: variant.isActive !== false, // Default to true if not specified
          priceOverride: variant.price || null,
          salePrice: variant.salePrice || null,
          stockBySize: variant.stockBySize,
          metaTitle: variant.metaTitle || '',
          metaDescription: variant.metaDescription || '',
          images: uploadedImages,
          imageDetails,
          primaryImage: primaryImageUrl,
          videos: videoUrl ? [videoUrl] : []
        }
      }

      // Build updates object: include only fields that changed; avoid clearing existing data
      const productData: any = {}

      const addIfChanged = (key: keyof ProductFormData, transform?: (v: any) => any) => {
        const current = (formData as any)[key]
        const original = (originalFormData as any)?.[key]
        const value = transform ? transform(current) : current
        if (JSON.stringify(current) !== JSON.stringify(original)) {
          productData[key] = value
        }
      }

      // Check if any category fields changed
      const categoryChanged = 
        formData.category !== originalFormData?.category ||
        formData.subCategory !== originalFormData?.subCategory ||
        formData.subSubCategory !== originalFormData?.subSubCategory

      addIfChanged('sku')
      addIfChanged('title_en')
      addIfChanged('title_he')
      addIfChanged('shortTitle_en')
      addIfChanged('shortTitle_he')
      addIfChanged('description_en')
      addIfChanged('description_he')
      addIfChanged('shortDescription_en')
      addIfChanged('shortDescription_he')
      addIfChanged('category')
      addIfChanged('subCategory')
      addIfChanged('subSubCategory')
      
      // Always update categories_path and categories_path_id if any category field changed
      if (categoryChanged) {
        productData.categories_path = categoriesPath
        productData.categories_path_id = categoriesPathId
        // Also update categoryId to match the main category
        if (formData.category) {
          productData.categoryId = formData.category
        }
        // Store resolved English and Hebrew names (will be synced to Neon)
        productData.category_en = categoryEn
        productData.category_he = categoryHe
        productData.subCategory_en = subCategoryEn || null
        productData.subCategory_he = subCategoryHe || null
        productData.subSubCategory_en = subSubCategoryEn || null
        productData.subSubCategory_he = subSubCategoryHe || null
      }
      
      addIfChanged('brand')
      addIfChanged('price')
      // Treat salePrice 0 as null, but only if changed
      addIfChanged('salePrice', (v) => (v > 0 ? v : null))
      addIfChanged('currency')

      // Always include colorVariants if any were edited (uploads cause differences)
      if (originalFormData && JSON.stringify(formData.colorVariants) !== JSON.stringify(originalFormData.colorVariants)) {
        productData.colorVariants = colorVariants
      }

      addIfChanged('isEnabled')
      addIfChanged('isDeleted')
      addIfChanged('newProduct')
      addIfChanged('featuredProduct')

      // Material & Care: include only keys that changed and are not empty strings
      if (originalFormData) {
        const mcKeys = Object.keys(formData.materialCare) as (keyof typeof formData.materialCare)[]
        mcKeys.forEach((k) => {
          const curr = formData.materialCare[k]
          const orig = originalFormData.materialCare[k]
          if (curr !== orig && curr !== '') {
            // Use dot-path to update nested fields without overwriting the whole object
            ;(productData as any)[`materialCare.${k}`] = curr
          }
        })
      }

      // SEO: include only changed keys; avoid empty-string overwrites
      if (originalFormData) {
        const seoKeys = Object.keys(formData.seo) as (keyof typeof formData.seo)[]
        seoKeys.forEach((k) => {
          const curr = formData.seo[k]
          const orig = originalFormData.seo[k]
          if (Array.isArray(curr) ? JSON.stringify(curr) !== JSON.stringify(orig) : curr !== orig && curr !== '') {
            // Use dot-path to update nested fields without overwriting the whole object
            ;(productData as any)[`seo.${k}`] = curr
          }
        })
      }

      // Shoe Fit: include only changed keys (JSON comparison handles the adjustableFeatures array).
      // Unlike materialCare/seo above, an explicit clear (back to undefined/empty) is still sent,
      // since a reset enum/array value is meaningful here rather than "leave unchanged".
      if (originalFormData) {
        const shoeFitKeys = Object.keys(formData.shoeFit) as (keyof ShoeFitValues)[]
        shoeFitKeys.forEach((k) => {
          const curr = formData.shoeFit[k]
          const orig = originalFormData.shoeFit[k]
          if (JSON.stringify(curr) !== JSON.stringify(orig)) {
            ;(productData as any)[`shoeFit.${k}`] = curr
          }
        })
      }

      // Search keywords
      if (originalFormData && JSON.stringify(formData.searchKeywords) !== JSON.stringify(originalFormData.searchKeywords)) {
        productData.searchKeywords = formData.searchKeywords
      }

      // Tags
      if (originalFormData && JSON.stringify(formData.tags) !== JSON.stringify(originalFormData.tags)) {
        productData.tags = formData.tags
      }

      // Always set updatedAt on the server; here just for completeness
      productData.updatedAt = new Date()

      console.log('Product data prepared:', productData)
      console.log('Calling productService.updateProduct...')
      
      await productService.updateProduct(productId, productData)
      console.log('Product updated successfully')
      
      setShowSuccess(true)
      setTimeout(() => {
        router.push('/admin/products')
      }, 2000)
    } catch (error: unknown) {
      console.error('Error updating product:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Error updating product: ${errorMessage}`)
    } finally {
      console.log('Setting isSubmitting to false')
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
          </div>
          <p className="text-gray-600">Update product information and settings</p>
        </div>

        {showSuccess && (
          <SuccessMessage 
            message="Product updated successfully!" 
            onClose={() => setShowSuccess(false)} 
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Product Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <ProductBasicInformationSection
              values={{
                title_en: formData.title_en,
                title_he: formData.title_he,
                shortTitle_en: formData.shortTitle_en,
                shortTitle_he: formData.shortTitle_he,
                description_en: formData.description_en,
                description_he: formData.description_he,
                shortDescription_en: formData.shortDescription_en,
                shortDescription_he: formData.shortDescription_he,
              }}
              onChange={handleBasicInfoFieldChange}
              errors={{
                title_en: errors.title_en,
                title_he: errors.title_he,
                description_en: errors.description_en,
                description_he: errors.description_he,
              }}
            />
          </div>

          {/* Pricing */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Pricing</h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price *
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-700 sm:text-sm">₪</span>
                  </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price.toString()}
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                    className={`block text-gray-700 w-full pl-7 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.price ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                </div>
                {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sale Price
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">₪</span>
                  </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.salePrice.toString()}
                  onChange={(e) => handleInputChange('salePrice', parseFloat(e.target.value) || 0)}
                    className="block text-gray-700 w-full pl-7 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                >
                  <option value="ILS">ILS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Categories and Product Classification */}
          <div className="bg-white shadow rounded-lg p-6">
            <ProductClassificationSection
              mainCategories={mainCategories}
              subCategories={subCategories}
              subSubCategories={subSubCategories}
              category={formData.category}
              subCategory={formData.subCategory}
              subSubCategory={formData.subSubCategory}
              brand={formData.brand}
              sku={formData.sku}
              onCategoryChange={handleCategoryChange}
              onSubCategoryChange={handleSubCategoryChange}
              onSubSubCategoryChange={handleSubSubCategoryChange}
              onBrandChange={(value) => handleInputChange('brand', value)}
              onSkuChange={(value) => handleInputChange('sku', value)}
              errors={{
                category: errors.category,
                subCategory: errors.subCategory,
                subSubCategory: errors.subSubCategory,
                brand: errors.brand,
                sku: errors.sku,
              }}
              skuHelperText={`This will be used to generate URLs like /product/${formData.sku || '0000-0000'}/black`}
            />
          </div>

          {/* Product Specifications */}
          <div className="bg-white shadow rounded-lg p-6">
            <ProductSpecificationsSection
              values={formData.materialCare}
              onChange={handleSpecificationChange}
              fieldGroup={categoryFieldGroup}
            />
          </div>

          {/* Shoe Fit and Sizing — only shown for footwear categories; data is preserved even when hidden */}
          {categoryFieldGroup === 'shoes' && (
            <div className="bg-white shadow rounded-lg p-6">
              <ShoeFitSection values={formData.shoeFit} onChange={handleShoeFitChange} />
              {errors.shoeFit && <p className="mt-1 text-sm text-red-600">{errors.shoeFit}</p>}
            </div>
          )}

          {/* Colors */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Color Variants *</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {commonColors.map((color) => (
                <label key={color} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                    checked={formData.colorVariants.some(v => v.colorName === color)}
                    onChange={(e) => handleColorSelection(color, e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: getColorHex(color) }}
                    />
                    <span className="text-sm text-gray-700">{color}</span>
                  </div>
                    </label>
                  ))}
                </div>
            {errors.colorVariants && <p className="mt-2 text-sm text-red-600">{errors.colorVariants}</p>}
              </div>

          {/* Color Variants */}
          {formData.colorVariants.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">Color Variants</h2>
              <div className="space-y-6">
                {formData.colorVariants.map((variant) => (
                  <div key={variant.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-6 h-6 rounded border border-gray-300"
                          style={{ backgroundColor: variant.colorHex }}
                        />
                        <h3 className="text-lg font-medium text-gray-900">{variant.colorName}</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                            checked={variant.isActive}
                            onChange={(e) => updateColorVariant(variant.id, { isActive: e.target.checked })}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">Active</span>
                    </label>
                </div>
              </div>
                    
                    {/* URL Preview */}
                    <div className="mb-4 p-3 bg-white border border-gray-200 rounded-md">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preview URL
                      </label>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-gray-400 text-white px-2 py-1 rounded">
                          /product/{formData.sku || 'sku'}/{variant.colorSlug}
                        </code>
                        <button
                          type="button"
                          onClick={() => window.open(`/product/${formData.sku}/${variant.colorSlug}`, '_blank')}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                          disabled={!formData.sku}
                        >
                          Preview
                        </button>
            </div>
          </div>

                    {/* Color Slug */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Slug
                      </label>
                      <input
                        type="text"
                        value={variant.colorSlug}
                        onChange={(e) => updateColorVariant(variant.id, { colorSlug: e.target.value })}
                        className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="URL-friendly slug"
                      />
                    </div>

                    {/* Pricing */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price Override (optional)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variant.price ? variant.price.toString() : ''}
                          onChange={(e) => updateColorVariant(variant.id, { price: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Leave empty to use base price"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sale Price (optional)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variant.salePrice ? variant.salePrice.toString() : ''}
                          onChange={(e) => updateColorVariant(variant.id, { salePrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Sale price for this color"
                        />
                      </div>
                    </div>

                    {/* Stock by Size */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stock by Size
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {commonSizes.map((size: string) => (
                          <div key={size} className="text-center">
                            <label className="block text-xs text-gray-600 mb-1">{size}</label>
                            <input
                              type="number"
                              min="0"
                              value={variant.stockBySize[size] || 0}
                              onChange={(e) => handleVariantSizeStockChange(variant.id, size, parseInt(e.target.value) || 0)}
                              className="w-full text-gray-500 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>


                    {/* SEO Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Meta Title (optional)
                        </label>
                        <input
                          type="text"
                          value={variant.metaTitle || ''}
                          onChange={(e) => updateColorVariant(variant.id, { metaTitle: e.target.value })}
                          className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="SEO title for this color"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Meta Description (optional)
                        </label>
                        <textarea
                          rows={2}
                          value={variant.metaDescription || ''}
                          onChange={(e) => updateColorVariant(variant.id, { metaDescription: e.target.value })}
                          className="mt-1 block text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="SEO description for this color"
                        />
              </div>
            </div>
            
                    {/* Color Variant Images */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {variant.colorName} Images
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <div className="text-center">
                          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <input
                type="file"
                multiple
                accept="image/*"
                              onChange={(e) => handleVariantImageSelect(variant.id, e.target.files)}
                className="hidden"
                              id={`variant-images-${variant.id}`}
              />
              <label
                              htmlFor={`variant-images-${variant.id}`}
                              className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                            >
                              Upload {variant.colorName} Images
              </label>
                            
                            <button
                              type="button"
                              onClick={() => openGoogleDrivePicker(variant.id)}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <CloudIcon className="w-4 h-4 mr-2" />
                              Import from Google Drive
                            </button>
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            Upload images from your computer or import from Google Drive
                          </p>
            </div>

                        {/* Variant Image Preview */}
                        {variant.images.length > 0 && (
                          <div className="mt-4">
                            <div className="mb-3">
                              <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Images ({variant.images.length})
                              </h4>
                              <p className="text-xs text-gray-500">
                                Click on any image to set it as the primary image (shown on product page)
                              </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                              {variant.images.map((image, index) => (
                    <div key={index} className="relative group">
                                  <div 
                                    className={`aspect-square relative overflow-hidden rounded-lg bg-gray-100 cursor-pointer transition-all duration-200 ${
                                      image.isPrimary 
                                        ? 'ring-2 ring-indigo-500 ring-offset-2' 
                                        : 'hover:ring-2 hover:ring-gray-300'
                                    }`}
                                    onClick={() => setPrimaryImage(variant.id, index)}
                                    title={image.isPrimary ? 'Primary image (click to change)' : 'Click to set as primary image'}
                                  >
                                    {image.uploading ? (
                                      <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                      </div>
                                    ) : image.uploaded ? (
                        <Image
                                        src={image.url || image.preview}
                                        alt={`${variant.colorName} - Image ${index + 1}`}
                                        fill
                                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 224px"
                                        className="object-cover"
                                      />
                                    ) : (
                                      <Image
                                        src={image.preview}
                                        alt={`${variant.colorName} - Image ${index + 1}`}
                                        fill
                                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 224px"
                                        className="object-cover"
                                      />
                                    )}

                                    {/* Primary image indicator */}
                                    {image.isPrimary && (
                                      <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded font-medium">
                                        Primary
                                      </div>
                                    )}

                                    {/* Set as primary button for non-primary images */}
                                    {!image.isPrimary && (
                                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPrimaryImage(variant.id, index);
                                          }}
                                          className="w-full bg-indigo-600 text-white text-xs px-2 py-1 rounded hover:bg-indigo-700 transition-colors"
                                        >
                                          Set as Primary
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Remove button — kept outside the overflow-hidden image box so it isn't clipped */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeVariantImage(variant.id, index);
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remove image"
                                  >
                                    ×
                                  </button>
                                  <ProductImageSeoFields
                                    values={{ altEn: image.altEn, altHe: image.altHe, type: image.imageType }}
                                    onChange={(updates) => updateVariantImageMeta(variant.id, index, updates)}
                                  />
                    </div>
                  ))}
                </div>
              </div>
            )}
              </div>
            </div>
            
                    {/* Color Variant Video */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {variant.colorName} Video (Optional)
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        {!variant.video ? (
                          <div className="text-center">
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <input
                  type="file"
                                accept="video/mp4"
                                onChange={(e) => handleVariantVideoSelect(variant.id, e.target.files)}
                  className="hidden"
                                id={`variant-video-${variant.id}`}
                />
                <label
                                htmlFor={`variant-video-${variant.id}`}
                                className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                              >
                                Upload {variant.colorName} Video
                </label>
                              <button
                                type="button"
                                onClick={() => openGoogleDriveVideoPicker(variant.id)}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              >
                                <CloudIcon className="w-4 h-4 mr-2" />
                                Import from Google Drive
                              </button>
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                              Upload a short video showcasing this color variant (MP4, max 2.5MB)
                            </p>
              </div>
            ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                  <VideoCameraIcon className="w-6 h-6 text-red-600" />
                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {variant.video.file?.name || 'Video file'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {variant.video.file?.size ? `${(variant.video.file.size / (1024 * 1024)).toFixed(2)} MB` : 'Unknown size'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {variant.video.uploading && (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                              )}
                              {variant.video.uploaded && (
                                <span className="text-sm text-green-600 font-medium">Uploaded</span>
                              )}
                <button
                  type="button"
                                onClick={() => removeVariantVideo(variant.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                                Remove
                </button>
                  </div>
              </div>
            )}
          </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEO Settings */}
          <div className="bg-white shadow rounded-lg p-6">
            <ProductSeoSection
              values={formData.seo}
              onChange={handleSeoChange}
              productUrl={`/product/${formData.sku || 'sku'}/${formData.colorVariants[0]?.colorSlug || 'color'}`}
              productDraft={{ ...formData, categories_path: seoCategoryPath }}
            />
            {errors.seoSlug && <p className="text-sm text-red-600">{errors.seoSlug}</p>}
          </div>

          {/* Product Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Product Status</h2>

            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.featuredProduct}
                  onChange={(e) => handleInputChange('featuredProduct', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Featured Product</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.newProduct}
                  onChange={(e) => handleInputChange('newProduct', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">New Product</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isEnabled}
                  onChange={(e) => handleInputChange('isEnabled', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enabled</span>
              </label>
            </div>
          </div>

          {/* Search Keywords */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Search Keywords</h2>
            <div>
              <label htmlFor="searchKeywords" className="block text-sm font-medium text-gray-700 mb-2">
                Keywords (comma-separated)
              </label>
              <input
                type="text"
                id="searchKeywords"
                value={searchKeywordsInputValue}
                onChange={(e) => {
                  const raw = e.target.value
                  setSearchKeywordsInputValue(raw)
                  handleInputChange('searchKeywords', parseCommaSeparatedTags(raw))
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                placeholder="leather, boot, women, classic"
              />
              <p className="mt-1 text-sm text-gray-500">
                Enter keywords separated by commas to help customers find this product
              </p>
            </div>
          </div>

          {/* Tags & Campaigns */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Tags & Campaigns</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tagsInputValue}
                  onChange={(e) => {
                    const raw = e.target.value
                    setTagsInputValue(raw)
                    handleInputChange('tags', parseCommaSeparatedTags(raw))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., black-friday-2025, sale, boots"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Add tags to include this product in campaigns. Use campaign slugs (e.g., "black-friday-2025") to include products in specific campaigns.
                </p>
                {formData.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end items-start space-x-4">
            <PreviewProductButton
              formData={formData}
              categories={categories}
              categoryFieldGroup={categoryFieldGroup}
              sourceProductId={productId}
              draftId={previewDraftId}
              onDraftIdChange={setPreviewDraftId}
              onErrors={setErrors}
              onImagesUpdate={(variantId, images) => updateColorVariant(variantId, { images })}
              onVideoUpdate={(variantId, video) => updateColorVariant(variantId, { video })}
            />
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating...' : 'Update Product'}
            </button>
          </div>
        </form>

        {/* Google Drive Picker Modal */}
        <GoogleDrivePicker
          isOpen={showGoogleDrivePicker}
          onClose={() => {
            setShowGoogleDrivePicker(false)
            setCurrentVariantForGoogleDrive(null)
          }}
          onSelectFiles={handleGoogleDriveSelect}
          multiple={true}
          folderId="157YeZrSzQ7G5wtvL7ovwdTh_va7lMHag"
        />
        
        <GoogleDrivePicker
          isOpen={showGoogleDriveVideoPicker}
          onClose={() => {
            setShowGoogleDriveVideoPicker(false)
            setCurrentVariantForGoogleDriveVideo(null)
          }}
          onSelectFiles={handleGoogleDriveVideoSelect}
          multiple={false}
          folderId="157YeZrSzQ7G5wtvL7ovwdTh_va7lMHag"
        />
      </div>
    </div>
  )
}

export default function EditProductPageWrapper() {
  return (
    <ProtectedRoute>
      <EditProductPage />
    </ProtectedRoute>
  )
}
