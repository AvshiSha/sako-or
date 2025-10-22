'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { productService, categoryService, Category, storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import SuccessMessage from '@/app/components/SuccessMessage'
import GoogleDrivePicker from '@/app/components/GoogleDrivePicker'
import Image from 'next/image'
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
  description_en: string;
  description_he: string;
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
  
  // Material & Care fields
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
  };
  
  // SEO fields
  seo: {
    title_en: string;
    title_he: string;
    description_en: string;
    description_he: string;
    slug: string;
  };
  
  searchKeywords: string[];
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
}

interface ImageFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  isPrimary?: boolean;
  order?: number;
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

const commonSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL','34','35','36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
const commonColors = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Orange', 'light Brown', 'Dark Brown', 'Gray', 'Navy', 'Beige', 'Gold', 'Silver', 'Off White', 'Light Blue', 'Dark Blue', 'Bordeaux', 'Black nail polish', 'Olive', 'Multicolor', 'Black & White', 'Transparent'];

// Color hex mapping
const colorHexMap: Record<string, string> = {
  'Black': '#000000',
  'White': '#FFFFFF',
  'Red': '#FF0000',
  'Blue': '#0000FF',
  'Green': '#008000',
  'Yellow': '#FFFF00',
  'Purple': '#800080',
  'Pink': '#FFC0CB',
  'Orange': '#FFA500',
  'light Brown': '#b5651d',
  'Dark Brown': '#654321',
  'Gray': '#808080',
  'Navy': '#000080',
  'Beige': '#F5F5DC',
  'Gold': '#FFD700',
  'Silver': '#C0C0C0',
  'Off White': '#f5f5f5',
  'Light Blue': '#ADD8E6',
  'Dark Blue': '#000080',
  'Bordeaux': '#800020',
  'Black nail polish': '#000000',
  'Olive': '#808000',
  'Multicolor': '#FF0000',
  'Black & White': '#000000',
  'Transparent': '#FFFFFF'
};

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
  const [loading, setLoading] = useState(true)
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState(false)
  const [currentVariantForGoogleDrive, setCurrentVariantForGoogleDrive] = useState<string | null>(null)
  const [showGoogleDriveVideoPicker, setShowGoogleDriveVideoPicker] = useState(false)
  const [currentVariantForGoogleDriveVideo, setCurrentVariantForGoogleDriveVideo] = useState<string | null>(null)

  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    title_en: '',
    title_he: '',
    description_en: '',
    description_he: '',
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
      heelHeight_he: ''
    },
    
    // SEO fields
    seo: {
      title_en: '',
      title_he: '',
      description_en: '',
      description_he: '',
      slug: ''
    },
    
    searchKeywords: []
  })

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
            colorHex: colorHexMap[variant.colorSlug.charAt(0).toUpperCase() + variant.colorSlug.slice(1).replace(/-/g, ' ')] || '#000000',
            price: variant.priceOverride,
            salePrice: variant.salePrice,
            stock: Object.values(variant.stockBySize || {}).reduce((sum, stock) => sum + stock, 0),
            isActive: variant.isActive !== false, // Load the isActive flag, default to true if not specified
            images: (variant.images || []).map((img, imgIndex) => ({
              file: new File([], 'existing-image'),
              preview: img,
              uploading: false,
              uploaded: true,
              url: img,
              isPrimary: imgIndex === 0,
              order: imgIndex
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
          
          setFormData({
            sku: product.sku || product.baseSku || '',
            title_en: product.title_en || product.name?.en || '',
            title_he: product.title_he || product.name?.he || '',
            description_en: product.description_en || product.description?.en || '',
            description_he: product.description_he || product.description?.he || '',
            category: product.categoryId || product.category || '',
            subCategory: product.subCategory || '',
            subSubCategory: product.subSubCategory || '',
            categories_path: product.categories_path || [],
            categories_path_id: product.categories_path_id || [],
            brand: product.brand || '',
            price: product.price || 0,
            salePrice: product.salePrice || 0,
            currency: product.currency || 'ILS',
            colorVariants: colorVariants,
            isEnabled: product.isEnabled !== false,
            isDeleted: product.isDeleted || false,
            newProduct: product.isNew || product.newProduct || false,
            featuredProduct: product.featured || product.featuredProduct || false,
            
            // Material & Care fields
            materialCare: {
              upperMaterial_en: product.upperMaterial?.en || '',
              upperMaterial_he: product.upperMaterial?.he || '',
              materialInnerSole_en: product.materialInnerSole?.en || '',
              materialInnerSole_he: product.materialInnerSole?.he || '',
              lining_en: product.lining?.en || '',
              lining_he: product.lining?.he || '',
              sole_en: product.sole?.en || '',
              sole_he: product.sole?.he || '',
              heelHeight_en: product.heelHeight?.en || '',
              heelHeight_he: product.heelHeight?.he || ''
            },
            
            // SEO fields
            seo: {
              title_en: product.seo?.title_en || '',
              title_he: product.seo?.title_he || '',
              description_en: product.seo?.description_en || '',
              description_he: product.seo?.description_he || '',
              slug: product.seo?.slug || ''
            },
            
            searchKeywords: product.searchKeywords || []
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
          colorHex: colorHexMap[colorName] || '#000000',
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
    const timestamp = Date.now();
    const fileName = `${timestamp}_${imageFile.file.name}`;
    const storageRef = ref(storage, `products/${fileName}`);
    
    const snapshot = await uploadBytes(storageRef, imageFile.file);
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
        const fileName = `products/${formData.sku}/${variant.colorSlug}/${Date.now()}-${i}-${imageFile.file.name}`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, imageFile.file);
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
    const newErrors: FormErrors = {}

    if (!formData.sku.trim()) {
      newErrors.sku = 'SKU is required'
    }
    if (!formData.title_en.trim()) {
      newErrors.title_en = 'English title is required'
    }
    if (!formData.title_he.trim()) {
      newErrors.title_he = 'Hebrew title is required'
    }
    if (!formData.description_en.trim()) {
      newErrors.description_en = 'English description is required'
    }
    if (!formData.description_he.trim()) {
      newErrors.description_he = 'Hebrew description is required'
    }
    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0'
    }
    if (!formData.brand.trim()) {
      newErrors.brand = 'Brand is required'
    }
    if (!formData.category.trim()) {
      newErrors.category = 'Main category is required'
    }
    if (formData.colorVariants.length === 0) {
      newErrors.colorVariants = 'At least one color variant is required'
    }

    setErrors(newErrors)
    
    // Log validation errors for debugging
    if (Object.keys(newErrors).length > 0) {
      console.log('Validation errors:', newErrors)
      console.log('Form data:', formData)
    }
    
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
      
      // Build categories path and IDs
      const categoriesPath: string[] = []
      const categoriesPathId: string[] = []
      
      const mainCategory = categories.find(cat => cat.id === formData.category)
      if (mainCategory) {
        const mainSlug = typeof mainCategory.slug === 'object' ? mainCategory.slug.en : mainCategory.slug
        if (mainSlug) {
          categoriesPath.push(mainSlug)
          if (mainCategory.id) {
            categoriesPathId.push(mainCategory.id)
          }
        }
        
        if (formData.subCategory) {
          const subCategory = categories.find(cat => cat.id === formData.subCategory)
          if (subCategory) {
            const subSlug = typeof subCategory.slug === 'object' ? subCategory.slug.en : subCategory.slug
            if (subSlug) {
              categoriesPath.push(subSlug)
              if (subCategory.id) {
                categoriesPathId.push(subCategory.id)
              }
            }
            
            if (formData.subSubCategory) {
              const subSubCategory = categories.find(cat => cat.id === formData.subSubCategory)
              if (subSubCategory) {
                const subSubSlug = typeof subSubCategory.slug === 'object' ? subSubCategory.slug.en : subSubCategory.slug
                if (subSubSlug) {
                  categoriesPath.push(subSubSlug)
                  if (subSubCategory.id) {
                    categoriesPathId.push(subSubCategory.id)
                  }
                }
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

        colorVariants[variant.colorSlug] = {
          colorSlug: variant.colorSlug,
          isActive: variant.isActive !== false, // Default to true if not specified
          priceOverride: variant.price || null,
          salePrice: variant.salePrice || null,
          stockBySize: variant.stockBySize,
          metaTitle: variant.metaTitle || '',
          metaDescription: variant.metaDescription || '',
          images: uploadedImages,
          primaryImage: primaryImageUrl,
          videos: videoUrl ? [videoUrl] : []
        }
      }

      const productData: any = {
        sku: formData.sku,
        title_en: formData.title_en,
        title_he: formData.title_he,
        description_en: formData.description_en,
        description_he: formData.description_he,
        category: formData.category,
        subCategory: formData.subCategory,
        subSubCategory: formData.subSubCategory,
        categories_path: categoriesPath,
        categories_path_id: categoriesPathId,
        brand: formData.brand,
        price: formData.price,
        salePrice: formData.salePrice > 0 ? formData.salePrice : null,
        currency: formData.currency,
        colorVariants: colorVariants,
        isEnabled: formData.isEnabled,
        isDeleted: formData.isDeleted,
        newProduct: formData.newProduct,
        featuredProduct: formData.featuredProduct,
        materialCare: formData.materialCare,
        seo: formData.seo,
        searchKeywords: formData.searchKeywords,
        updatedAt: new Date()
      }

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
          {/* Basic Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  English Title *
                </label>
                <input
                  type="text"
                  value={formData.title_en}
                  onChange={(e) => handleInputChange('title_en', e.target.value)}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.title_en ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter product title in English"
                />
                {errors.title_en && <p className="mt-1 text-sm text-red-600">{errors.title_en}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hebrew Title *
                </label>
                <input
                  type="text"
                  value={formData.title_he}
                  onChange={(e) => handleInputChange('title_he', e.target.value)}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.title_he ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter product title in Hebrew"
                />
                {errors.title_he && <p className="mt-1 text-sm text-red-600">{errors.title_he}</p>}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  English Description *
                </label>
                <textarea
                  value={formData.description_en}
                  onChange={(e) => handleInputChange('description_en', e.target.value)}
                  rows={4}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.description_en ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter product description in English"
                />
                {errors.description_en && <p className="mt-1 text-sm text-red-600">{errors.description_en}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hebrew Description *
                </label>
                <textarea
                  value={formData.description_he}
                  onChange={(e) => handleInputChange('description_he', e.target.value)}
                  rows={4}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.description_he ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter product description in Hebrew"
                />
                {errors.description_he && <p className="mt-1 text-sm text-red-600">{errors.description_he}</p>}
              </div>
            </div>
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

            <div className="mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SKU *
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => handleInputChange('sku', e.target.value)}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.sku ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Product SKU (e.g., 0000-0000)"
                />
                <p className="mt-1 text-sm text-gray-500">
                  This will be used to generate URLs like /product/{formData.sku || '0000-0000'}/black
                </p>
                {errors.sku && <p className="mt-1 text-sm text-red-600">{errors.sku}</p>}
              </div>
              </div>
            </div>

          {/* Categories */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Categories</h2>
            
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                  Main Category *
                  </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.category ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a main category</option>
                  {mainCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {typeof category.name === 'object' ? category.name.en : category.name}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
                </div>

              {formData.category && subCategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub Category
                  </label>
                  <select
                    value={formData.subCategory}
                    onChange={(e) => handleSubCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a sub category (optional)</option>
                    {subCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {typeof category.name === 'object' ? category.name.en : category.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.subCategory && subSubCategories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub-Sub Category
                </label>
                <select
                      value={formData.subSubCategory}
                      onChange={(e) => handleSubSubCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                    <option value="">Select a sub-sub category (optional)</option>
                    {subSubCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {typeof category.name === 'object' ? category.name.en : category.name}
                    </option>
                  ))}
                </select>
                </div>
              )}
            </div>
              </div>

          {/* Brand */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Brand</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand *
                </label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => handleInputChange('brand', e.target.value)}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.brand ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter brand name"
                />
                {errors.brand && <p className="mt-1 text-sm text-red-600">{errors.brand}</p>}
            </div>
          </div>

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
                      style={{ backgroundColor: colorHexMap[color] || '#000000' }}
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
                    {variant.sizes.length > 0 && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Stock by Size
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {variant.sizes.map((size: string) => (
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
                    )}

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
                                        className="object-cover"
                                      />
                                    ) : (
                                      <Image
                                        src={image.preview}
                                        alt={`${variant.colorName} - Image ${index + 1}`}
                                        fill
                                        className="object-cover"
                                      />
                                    )}
                                  </div>
                                  
                                  {/* Remove button */}
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

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
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
