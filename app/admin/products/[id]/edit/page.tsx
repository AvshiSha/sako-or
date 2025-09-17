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

interface ProductFormData {
  brand: string;
  category: string;
  colors: string[];
  descriptionEn: string;
  descriptionHe: string;
  featured: boolean;
  images: string[];
  video?: string;
  nameEn: string;
  nameHe: string;
  new: boolean;
  price: number;
  saleEndDate: string;
  salePrice: number;
  saleStartDate: string;
  sizes: string[];
  sku: string;
  stock: number;
  stockBySize: Record<string, number>;
  subcategory: string;
  currency: string;
}

interface FormErrors {
  nameEn?: string;
  nameHe?: string;
  descriptionEn?: string;
  descriptionHe?: string;
  price?: string;
  brand?: string;
  category?: string;
  colors?: string;
  sizes?: string;
  stock?: string;
  images?: string;
  sku?: string;
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

const commonSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL','35','36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
const commonColors = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Orange', 'Brown', 'Gray', 'Navy', 'Beige', 'Gold', 'Silver'];

function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params?.id as string
  
  const [categories, setCategories] = useState<Category[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([])
  const [videoFile, setVideoFile] = useState<VideoFile>({
    uploading: false,
    uploaded: false
  })
  const [isDragOver, setIsDragOver] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState(false)
  const [isImagePicker, setIsImagePicker] = useState(true)

  const [formData, setFormData] = useState<ProductFormData>({
    brand: '',
    category: '',
    colors: [],
    descriptionEn: '',
    descriptionHe: '',
    featured: false,
    images: [],
    video: '',
    nameEn: '',
    nameHe: '',
    new: false,
    price: 0,
    saleEndDate: '',
    salePrice: 0,
    saleStartDate: '',
    sizes: [],
    sku: '',
    stock: 0,
    stockBySize: {},
    subcategory: '',
    currency: 'ILS'
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const cats = await categoryService.getAllCategories()
        setCategories(cats)
        
        // Fetch product data
        const product = await productService.getProductById(productId)
        if (product) {
          setFormData({
            brand: (product as any).brand || '',
            category: product.categoryId || '',
            colors: product.colorVariants ? Object.values(product.colorVariants).map(v => v.colorSlug) : [],
            descriptionEn: product.description?.en || '',
            descriptionHe: product.description?.he || '',
            featured: product.featured || false,
            images: product.colorVariants ? Object.values(product.colorVariants)[0]?.images || [] : [],
            video: (product as any).video || '',
            nameEn: product.name?.en || '',
            nameHe: product.name?.he || '',
            new: product.isNew || false,
            price: product.price || 0,
            saleEndDate: '',
            salePrice: product.salePrice || 0,
            saleStartDate: '',
            sizes: product.colorVariants ? Object.keys(Object.values(product.colorVariants)[0]?.stockBySize || {}) : [],
            sku: product.sku || product.baseSku || '',
            stock: product.colorVariants ? Object.values(Object.values(product.colorVariants)[0]?.stockBySize || {}).reduce((sum, stock) => sum + stock, 0) : 0,
            stockBySize: product.colorVariants ? Object.values(product.colorVariants)[0]?.stockBySize || {} : {},
            subcategory: (product as any).subcategory || '',
            currency: (product as any).currency || 'ILS'
          })
          
          // Set existing images as uploaded with primary image marking
          if (product.colorVariants?.[0]?.images && product.colorVariants[0].images.length > 0) {
            const existingImages: ImageFile[] = product.colorVariants[0].images.map((img, index) => ({
              file: new File([], 'existing-image'),
              preview: img,
              uploading: false,
              uploaded: true,
              url: img,
              isPrimary: index === 0,
              order: index
            }))
            setImageFiles(existingImages)
          }

          // Set existing video if available
          if ((product as any).video) {
            setVideoFile({
              uploading: false,
              uploaded: true,
              url: (product as any).video,
              name: 'Existing Video'
            })
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

  const handleSizeChange = (size: string, isSelected: boolean) => {
    setFormData(prev => {
      let newSizes = [...prev.sizes]
      const newStockBySize = { ...prev.stockBySize }
      
      if (isSelected) {
        if (!newSizes.includes(size)) {
          newSizes.push(size)
          newStockBySize[size] = 0
        }
      } else {
        newSizes = newSizes.filter(s => s !== size)
        delete newStockBySize[size]
      }
      
      return {
        ...prev,
        sizes: newSizes,
        stockBySize: newStockBySize
      }
    })
  }

  const handleStockBySizeChange = (size: string, stock: number) => {
    setFormData(prev => ({
      ...prev,
      stockBySize: {
        ...prev.stockBySize,
        [size]: stock
      }
    }))
  }

  const handleArrayChange = (field: 'colors' | 'sizes', value: string) => {
    const currentArray = formData[field]
    if (currentArray.includes(value)) {
      setFormData(prev => ({
        ...prev,
        [field]: currentArray.filter(item => item !== value)
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: [...currentArray, value]
      }))
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newImageFiles: ImageFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false
    }))
    
    setImageFiles(prev => [...prev, ...newImageFiles])
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const newImageFiles: ImageFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false
    }))
    
    setImageFiles(prev => [...prev, ...newImageFiles])
  }

  const removeImage = (index: number) => {
    setImageFiles(prev => {
      const newImages = prev.filter((_, i) => i !== index)
      // If we removed the primary image, make the first remaining image primary
      if (prev[index]?.isPrimary && newImages.length > 0) {
        newImages[0].isPrimary = true
      }
      return newImages
    })
  }

  const setPrimaryImage = (index: number) => {
    setImageFiles(prev => prev.map((img, i) => ({
      ...img,
      isPrimary: i === index
    })))
  }

  const moveImageUp = (index: number) => {
    if (index > 0) {
      setImageFiles(prev => {
        const newImages = [...prev]
        const temp = newImages[index]
        newImages[index] = newImages[index - 1]
        newImages[index - 1] = temp
        return newImages
      })
    }
  }

  const moveImageDown = (index: number) => {
    setImageFiles(prev => {
      if (index < prev.length - 1) {
        const newImages = [...prev]
        const temp = newImages[index]
        newImages[index] = newImages[index + 1]
        newImages[index + 1] = temp
        return newImages
      }
      return prev
    })
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVideoFile({
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        uploaded: false,
        name: file.name
      })
    }
  }

  const removeVideo = () => {
    setVideoFile({
      uploading: false,
      uploaded: false
    })
    setFormData(prev => ({ ...prev, video: '' }))
  }

  const handleGoogleDriveSelect = (files: GoogleDriveFile[]) => {
    if (isImagePicker) {
      // Handle image selection
      const newImageFiles: ImageFile[] = files.map(file => ({
        file: new File([], file.name),
        preview: `https://drive.google.com/thumbnail?id=${file.id}&sz=w400-h400`,
        uploading: false,
        uploaded: false,
        url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w2000-h2000`,
        isPrimary: false,
        order: imageFiles.length
      }))
      setImageFiles(prev => [...prev, ...newImageFiles])
    } else {
      // Handle video selection
      const videoFile = files[0] // Only one video allowed
      if (videoFile) {
        setVideoFile({
          file: new File([], videoFile.name),
          preview: `https://drive.google.com/thumbnail?id=${videoFile.id}&sz=w400-h400`,
          uploading: false,
          uploaded: false,
          url: `https://drive.google.com/thumbnail?id=${videoFile.id}&sz=w2000-h2000`,
          name: videoFile.name
        })
      }
    }
    setShowGoogleDrivePicker(false)
  }

  const openGoogleDrivePicker = (forImages: boolean) => {
    setIsImagePicker(forImages)
    setShowGoogleDrivePicker(true)
  }

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

  const uploadAllImages = async (): Promise<string[]> => {
    console.log('Starting upload of', imageFiles.length, 'images')
    const uploadPromises = imageFiles.map(async (imageFile, index) => {
      if (imageFile.uploaded && imageFile.url) {
        return imageFile.url
      }
      
      setImageFiles(prev => prev.map((img, i) => 
        i === index ? { ...img, uploading: true } : img
      ));
      
      try {
        console.log(`Uploading image ${index + 1}/${imageFiles.length}`)
        const url = await uploadImageToFirebase(imageFile);
        
        setImageFiles(prev => prev.map((img, i) => 
          i === index ? { ...img, uploading: false, uploaded: true, url } : img
        ));
        
        return url;
      } catch (error) {
        console.error(`Error uploading image ${index + 1}:`, error);
        setImageFiles(prev => prev.map((img, i) => 
          i === index ? { ...img, uploading: false } : img
        ));
        throw error;
      }
    });

    return Promise.all(uploadPromises);
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.nameEn.trim()) {
      newErrors.nameEn = 'English name is required'
    }
    if (!formData.nameHe.trim()) {
      newErrors.nameHe = 'Hebrew name is required'
    }
    if (!formData.descriptionEn.trim()) {
      newErrors.descriptionEn = 'English description is required'
    }
    if (!formData.descriptionHe.trim()) {
      newErrors.descriptionHe = 'Hebrew description is required'
    }
    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0'
    }
    if (!formData.brand.trim()) {
      newErrors.brand = 'Brand is required'
    }
    if (!formData.category.trim()) {
      newErrors.category = 'Category is required'
    }
    if (formData.colors.length === 0) {
      newErrors.colors = 'At least one color is required'
    }
    if (formData.sizes.length === 0) {
      newErrors.sizes = 'At least one size is required'
    }
    if (imageFiles.length === 0) {
      newErrors.images = 'At least one image is required'
    }
    if (!formData.sku.trim()) {
      newErrors.sku = 'SKU is required'
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
      // Upload all images
      console.log('Uploading images...')
      const uploadedImageUrls = await uploadAllImages()
      console.log('Images uploaded successfully:', uploadedImageUrls)

      // Upload video if present
      let videoUrl = ''
      if (videoFile.file || videoFile.uploaded) {
        console.log('Uploading video...')
        videoUrl = await uploadVideoToFirebase(videoFile)
        console.log('Video uploaded successfully:', videoUrl)
      }

      // Prepare product data for API
      const productData = {
        name: {
          en: formData.nameEn,
          he: formData.nameHe
        },
        slug: {
          en: formData.nameEn.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          he: formData.nameHe.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || formData.nameEn.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        },
        description: {
          en: formData.descriptionEn,
          he: formData.descriptionHe
        },
        price: formData.price,
        salePrice: formData.salePrice > 0 ? formData.salePrice : null,
        saleStartDate: formData.saleStartDate ? new Date(formData.saleStartDate).toISOString() : null,
        saleEndDate: formData.saleEndDate ? new Date(formData.saleEndDate).toISOString() : null,
        sku: formData.sku,
        stock: formData.stock,
        featured: formData.featured,
        isNew: formData.new,
        isActive: true,
        categoryId: formData.category,
        categoryPath: (() => {
          // Build category path from the selected category
          const selectedCategoryObj = categories.find(cat => cat.id === formData.category);
          return selectedCategoryObj?.path || '';
        })(),
        images: imageFiles.map((imageFile, index) => ({
          url: uploadedImageUrls[index] || imageFile.url,
          alt: {
            en: `${formData.nameEn} - Image ${index + 1}`,
            he: `${formData.nameHe} - תמונה ${index + 1}`
          },
          isPrimary: imageFile.isPrimary || false,
          order: index
        })),
        video: videoUrl || formData.video,
        variants: formData.sizes.flatMap(size =>
          formData.colors.map(color => ({
            size,
            color,
            stock: formData.stockBySize[size] || 0,
            sku: `${formData.sku}-${size}-${color}`,
            price: formData.price
          }))
        ),
        tags: [],
        colors: formData.colors,
        sizes: formData.sizes,
        stockBySize: formData.stockBySize,
        brand: formData.brand,
        subcategory: formData.subcategory,
        currency: formData.currency
      }

      console.log('Sending product data to API:', productData)

      // Update product via API
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update product')
      }

      console.log('Product updated successfully')
      setShowSuccess(true)
      
      // Redirect to products list after success
      setTimeout(() => {
        router.push('/admin/products')
      }, 2000)

    } catch (error) {
      console.error('Error updating product:', error)
      alert(`Failed to update product: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
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
                  English Name *
                </label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => handleInputChange('nameEn', e.target.value)}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.nameEn ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter product name in English"
                />
                {errors.nameEn && <p className="mt-1 text-sm text-red-600">{errors.nameEn}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hebrew Name *
                </label>
                <input
                  type="text"
                  value={formData.nameHe}
                  onChange={(e) => handleInputChange('nameHe', e.target.value)}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.nameHe ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter product name in Hebrew"
                />
                {errors.nameHe && <p className="mt-1 text-sm text-red-600">{errors.nameHe}</p>}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  English Description *
                </label>
                <textarea
                  value={formData.descriptionEn}
                  onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                  rows={4}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.descriptionEn ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter product description in English"
                />
                {errors.descriptionEn && <p className="mt-1 text-sm text-red-600">{errors.descriptionEn}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hebrew Description *
                </label>
                <textarea
                  value={formData.descriptionHe}
                  onChange={(e) => handleInputChange('descriptionHe', e.target.value)}
                  rows={4}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.descriptionHe ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter product description in Hebrew"
                />
                {errors.descriptionHe && <p className="mt-1 text-sm text-red-600">{errors.descriptionHe}</p>}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Pricing</h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (₪) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.price ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sale Price (₪)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={(e) => handleInputChange('salePrice', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>

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
                  placeholder="Product SKU"
                />
                {errors.sku && <p className="mt-1 text-sm text-red-600">{errors.sku}</p>}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm text-gray-600 mb-4">
                Leave sale dates empty for unlimited sale period, or set specific dates to limit the sale duration.
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sale Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.saleStartDate}
                    onChange={(e) => handleInputChange('saleStartDate', e.target.value)}
                    className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sale End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.saleEndDate}
                    onChange={(e) => handleInputChange('saleEndDate', e.target.value)}
                    className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Category and Brand */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Category & Brand</h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.category ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {typeof category.name === 'object' ? category.name.en : category.name}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
              </div>

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
          </div>

          {/* Sizes and Colors */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Sizes & Colors</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Available Sizes *
                </label>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {commonSizes.map((size) => (
                    <label key={size} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.sizes.includes(size)}
                        onChange={(e) => handleSizeChange(size, e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{size}</span>
                    </label>
                  ))}
                </div>
                {errors.sizes && <p className="mt-2 text-sm text-red-600">{errors.sizes}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Available Colors *
                </label>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {commonColors.map((color) => (
                    <label key={color} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.colors.includes(color)}
                        onChange={(e) => handleArrayChange('colors', color)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{color}</span>
                    </label>
                  ))}
                </div>
                {errors.colors && <p className="mt-2 text-sm text-red-600">{errors.colors}</p>}
              </div>
            </div>
          </div>

          {/* Stock Management */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Stock Management</h2>
            
            <div className="space-y-4">
              {formData.sizes.map((size) => (
                <div key={size} className="flex items-center space-x-4">
                  <label className="w-16 text-sm font-medium text-gray-700">{size}:</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stockBySize[size] || 0}
                    onChange={(e) => handleStockBySizeChange(size, parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border text-gray-700 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Images */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900">Product Images</h2>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => openGoogleDrivePicker(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <CloudIcon className="h-4 w-4 mr-2" />
                  From Google Drive
                </button>
              </div>
            </div>
            
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center ${
                isDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer block"
              >
                <div className="text-gray-600">
                  <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB each</p>
                </div>
              </label>
            </div>

            {errors.images && <p className="mt-2 text-sm text-red-600">{errors.images}</p>}

            {/* Image Previews */}
            {imageFiles.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Uploaded Images</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {imageFiles.map((imageFile, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={imageFile.preview}
                          alt={`Preview ${index + 1}`}
                          width={200}
                          height={200}
                          className="w-full h-full object-cover"
                        />
                        {imageFile.isPrimary && (
                          <div className="absolute top-2 left-2 bg-yellow-500 text-white rounded-full p-1">
                            <StarIcon className="h-4 w-4" />
                          </div>
                        )}
                        
                        {/* Always visible delete button */}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg opacity-80 hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="absolute top-2 right-10 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setPrimaryImage(index)}
                          className="bg-yellow-500 text-white rounded-full p-1 hover:bg-yellow-600 shadow-lg"
                          title="Set as primary"
                        >
                          <StarIcon className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Move buttons */}
                      <div className="absolute bottom-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => moveImageUp(index)}
                          disabled={index === 0}
                          className="bg-gray-600 text-white rounded-full p-1 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUpIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImageDown(index)}
                          disabled={index === imageFiles.length - 1}
                          className="bg-gray-600 text-white rounded-full p-1 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDownIcon className="h-4 w-4" />
                        </button>
                      </div>

                      {imageFile.uploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Click the red trash icon to delete images, the star icon to set primary image, and arrow buttons to reorder images.
                </p>
              </div>
            )}
          </div>

          {/* Video */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900">Product Video</h2>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => openGoogleDrivePicker(false)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <CloudIcon className="h-4 w-4 mr-2" />
                  From Google Drive
                </button>
              </div>
            </div>
            
            {!videoFile.url ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center border-gray-300">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload"
                />
                <label
                  htmlFor="video-upload"
                  className="cursor-pointer block"
                >
                  <div className="text-gray-600">
                    <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2">Click to upload video</p>
                    <p className="text-sm text-gray-500">MP4, MOV, AVI up to 100MB</p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="relative group">
                <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                  <video
                    src={videoFile.preview || videoFile.url}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={removeVideo}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg opacity-80 hover:opacity-100 transition-opacity"
                  title="Remove video"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                {videoFile.uploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                )}
                <p className="mt-2 text-sm text-gray-600">{videoFile.name}</p>
              </div>
            )}
          </div>

          {/* Product Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Product Status</h2>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => handleInputChange('featured', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Featured Product</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.new}
                  onChange={(e) => handleInputChange('new', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">New Product</span>
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
          onClose={() => setShowGoogleDrivePicker(false)}
          onSelectFiles={handleGoogleDriveSelect}
          multiple={isImagePicker}
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
