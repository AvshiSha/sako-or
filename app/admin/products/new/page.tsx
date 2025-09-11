'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { productService, categoryService, Category, storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import SuccessMessage from '@/app/components/SuccessMessage'
import Image from 'next/image'

interface ProductFormData {
  brand: string;
  category: string;
  colors: string[];
  descriptionEn: string;
  descriptionHe: string;
  featured: boolean;
  images: string[];
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
  stockBySize: Record<string, number>; // New field for stock by size
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
}

const commonSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL','35','36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
const commonColors = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Orange', 'Brown', 'Gray', 'Navy', 'Beige', 'Gold', 'Silver'];

export default function NewProductPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const [formData, setFormData] = useState<ProductFormData>({
    brand: '',
    category: '',
    colors: [],
    descriptionEn: '',
    descriptionHe: '',
    featured: false,
    images: [],
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
    const fetchCategories = async () => {
      try {
        const cats = await categoryService.getAllCategories()
        setCategories(cats)
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }
    fetchCategories()
  }, [])

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
        // Add size if not already present
        if (!newSizes.includes(size)) {
          newSizes.push(size)
          newStockBySize[size] = 0 // Initialize stock to 0
        }
      } else {
        // Remove size
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

  // Image upload functions
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const newImageFiles: ImageFile[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false
    }));
    
    setImageFiles(prev => [...prev, ...newImageFiles]);
  };

  const uploadImageToFirebase = async (imageFile: ImageFile): Promise<string> => {
    console.log('Uploading image:', imageFile.file.name)
    const timestamp = Date.now();
    const fileName = `${timestamp}_${imageFile.file.name}`;
    const storageRef = ref(storage, `products/${fileName}`);
    
    console.log('Storage reference created:', fileName)
    await uploadBytes(storageRef, imageFile.file);
    console.log('Image uploaded to storage')
    
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Download URL obtained:', downloadURL)
    return downloadURL;
  };

  const uploadAllImages = async (): Promise<string[]> => {
    console.log('Starting upload of', imageFiles.length, 'images')
    const uploadPromises = imageFiles.map(async (imageFile, index) => {
      // Update uploading status
      setImageFiles(prev => prev.map((img, i) => 
        i === index ? { ...img, uploading: true } : img
      ));
      
      try {
        console.log(`Uploading image ${index + 1}/${imageFiles.length}`)
        const url = await uploadImageToFirebase(imageFile);
        
        // Update uploaded status
        setImageFiles(prev => prev.map((img, i) => 
          i === index ? { ...img, uploading: false, uploaded: true, url } : img
        ));
        
        console.log(`Image ${index + 1} uploaded successfully`)
        return url;
      } catch (error: unknown) {
        console.error(`Error uploading image ${index + 1}:`, error);
        setImageFiles(prev => prev.map((img, i) => 
          i === index ? { ...img, uploading: false } : img
        ));
        throw error;
      }
    });
    
    console.log('Waiting for all uploads to complete...')
    const results = await Promise.all(uploadPromises);
    console.log('All images uploaded successfully')
    return results;
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      // Revoke object URL to prevent memory leaks
      URL.revokeObjectURL(prev[index].preview);
      return newFiles;
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, []);

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
    // Stock validation is now handled by stock by size
    if (imageFiles.length === 0) {
      newErrors.images = 'At least one image is required'
    }
    if (!formData.sku.trim()) {
      newErrors.sku = 'SKU is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('Form submission started')
    
    if (!validateForm()) {
      console.log('Form validation failed')
      return
    }

    console.log('Form validation passed, starting submission')
    setIsSubmitting(true)
    
    try {
      console.log('Starting image upload...')
      // Upload all images first
      const imageUrls = await uploadAllImages()
      console.log('Image upload completed:', imageUrls)
      
      console.log('Preparing product data...')
      // Find the selected category object
      const selectedCategoryObj = categories.find(cat => cat.id === formData.category);

      const productData: any = {
        name: {
          en: formData.nameEn,
          he: formData.nameHe
        },
        slug: {
          en: formData.nameEn.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim(),
          he: formData.nameHe.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
        },
        categorySlug: selectedCategoryObj ? (typeof selectedCategoryObj.slug === 'string' ? selectedCategoryObj.slug : selectedCategoryObj.slug?.en || '') : '', // Separate categorySlug for filtering
        description: {
          en: formData.descriptionEn,
          he: formData.descriptionHe
        },
        price: parseFloat(formData.price.toString()),
        stock: Object.values(formData.stockBySize).reduce((total, stock) => total + stock, 0), // Calculate total stock from size stocks
        featured: formData.featured,
        isNew: formData.new,
        isActive: true,
        categoryId: formData.category,
        images: imageUrls.map((url, index) => ({
          url,
          alt: {
            en: `${formData.nameEn} - Image ${index + 1}`,
            he: `${formData.nameHe} - תמונה ${index + 1}`
          },
          isPrimary: index === 0,
          order: index,
          createdAt: new Date()
        })),
        variants: [], // Empty array for now
        tags: [], // Empty array for now
        sizes: formData.sizes, // Add sizes
        colors: formData.colors, // Add colors
        brand: formData.brand, // Add brand
        subcategory: formData.subcategory, // Add subcategory
        currency: formData.currency,
        stockBySize: formData.stockBySize // Add stock by size
      }

      // Only add optional fields if they have valid values
      if (formData.salePrice > 0) {
        productData.salePrice = parseFloat(formData.salePrice.toString())
      }
      
      if (formData.saleStartDate) {
        productData.saleStartDate = new Date(formData.saleStartDate)
      }
      
      if (formData.saleEndDate) {
        productData.saleEndDate = new Date(formData.saleEndDate)
      }
      
      // SKU is required and validated, so always include it
      productData.sku = formData.sku.trim()

      console.log('Product data prepared:', productData)
      console.log('Calling productService.createProduct...')
      
      await productService.createProduct(productData)
      console.log('Product created successfully')
      
      setShowSuccess(true)
      setTimeout(() => {
        router.push('/admin/products')
      }, 2000)
          } catch (error: unknown) {
      console.error('Error adding product:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Error adding product: ${errorMessage}`)
    } finally {
      console.log('Setting isSubmitting to false')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create a new product with all required information
            </p>
          </div>

          {showSuccess && (
            <SuccessMessage 
              message="Product created successfully! Redirecting to products page..." 
              onClose={() => setShowSuccess(false)}
            />
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="nameEn" className="block text-sm font-medium text-gray-700">
                    Product Name (English) *
                  </label>
                  <input
                    type="text"
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => handleInputChange('nameEn', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.nameEn ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter product name in English"
                  />
                  {errors.nameEn && <p className="mt-1 text-sm text-red-600">{errors.nameEn}</p>}
                </div>

                <div>
                  <label htmlFor="nameHe" className="block text-sm font-medium text-gray-700">
                    Product Name (Hebrew) *
                  </label>
                  <input
                    type="text"
                    id="nameHe"
                    value={formData.nameHe}
                    onChange={(e) => handleInputChange('nameHe', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.nameHe ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter product name in Hebrew"
                  />
                  {errors.nameHe && <p className="mt-1 text-sm text-red-600">{errors.nameHe}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="descriptionEn" className="block text-sm font-medium text-gray-700">
                    Description (English) *
                  </label>
                  <textarea
                    id="descriptionEn"
                    rows={3}
                    value={formData.descriptionEn}
                    onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.descriptionEn ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter product description in English"
                  />
                  {errors.descriptionEn && <p className="mt-1 text-sm text-red-600">{errors.descriptionEn}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="descriptionHe" className="block text-sm font-medium text-gray-700">
                    Description (Hebrew) *
                  </label>
                  <textarea
                    id="descriptionHe"
                    rows={3}
                    value={formData.descriptionHe}
                    onChange={(e) => handleInputChange('descriptionHe', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.descriptionHe ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter product description in Hebrew"
                  />
                  {errors.descriptionHe && <p className="mt-1 text-sm text-red-600">{errors.descriptionHe}</p>}
                </div>

                <div>
                  <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
                    Brand *
                  </label>
                  <input
                    type="text"
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.brand ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter brand name"
                  />
                  {errors.brand && <p className="mt-1 text-sm text-red-600">{errors.brand}</p>}
                </div>

                <div>
                  <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                    SKU *
                  </label>
                  <input
                    type="text"
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700 ${
                      errors.sku ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Stock keeping unit (e.g., SAK-12345)"
                  />
                  {errors.sku && <p className="mt-1 text-sm text-red-600">{errors.sku}</p>}
                </div>
              </div>
            </div>

            {/* Product Images */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Product Images *</h2>
              
              {/* Image Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center ${
                  isDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Drop images here or click to upload
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        PNG, JPG, GIF up to 10MB each
                      </span>
                    </label>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      multiple
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => handleFileSelect(e.target.files)}
                    />
                  </div>
                </div>
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
                            fill
                            className="object-cover"
                          />
                          {imageFile.uploading && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            </div>
                          )}
                          {imageFile.uploaded && (
                            <div className="absolute top-2 right-2">
                              <div className="bg-green-500 text-white rounded-full p-1">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <p className="mt-1 text-xs text-gray-500 truncate">{imageFile.file.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pricing */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Pricing</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                    Price *
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">₪</span>
                    </div>
                    <input
                      type="number"
                      id="price"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      className={`block w-full pl-7 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-900 ${
                        errors.price ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
                </div>

                <div>
                  <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700">
                    Sale Price
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">₪</span>
                    </div>
                    <input
                      type="number"
                      id="salePrice"
                      step="0.01"
                      min="0"
                      value={formData.salePrice}
                      onChange={(e) => handleInputChange('salePrice', e.target.value)}
                      className={`block w-full pl-7 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-900 ${
                        errors.price ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                </div>


                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                    Currency
                  </label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  >
                    <option value="ILS">ILS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              {/* Sale Dates */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-6">
                <div>
                  <label htmlFor="saleStartDate" className="block text-sm font-medium text-gray-700">
                    Sale Start Date
                  </label>
                  <input
                    type="date"
                    id="saleStartDate"
                    value={formData.saleStartDate}
                    onChange={(e) => handleInputChange('saleStartDate', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>

                <div>
                  <label htmlFor="saleEndDate" className="block text-sm font-medium text-gray-700">
                    Sale End Date
                  </label>
                  <input
                    type="date"
                    id="saleEndDate"
                    value={formData.saleEndDate}
                    onChange={(e) => handleInputChange('saleEndDate', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Categories</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                    Category *
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 ${
                      errors.category ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="" className="text-gray-600">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id} className="text-gray-900"> // TODO: fix this
                        {typeof category.name === 'object' ? category.name.en : category.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
                </div>

                <div>
                  <label htmlFor="subcategory" className="block text-sm font-medium text-gray-700">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    id="subcategory"
                    value={formData.subcategory}
                    onChange={(e) => handleInputChange('subcategory', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 text-gray-700"
                    placeholder="Enter subcategory"
                  />
                </div>
              </div>
            </div>

            {/* Colors */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Colors *</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {commonColors.map((color) => (
                  <label key={color} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.colors.includes(color)}
                      onChange={() => handleArrayChange('colors', color)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">{color}</span>
                  </label>
                ))}
              </div>
              {errors.colors && <p className="mt-2 text-sm text-red-600">{errors.colors}</p>}
            </div>

            {/* Sizes and Stock */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Sizes & Stock *</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {commonSizes.map((size) => (
                    <label key={size} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.sizes.includes(size)}
                        onChange={(e) => handleSizeChange(size, e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{size}</span>
                    </label>
                  ))}
                </div>
                
                {/* Stock by Size Inputs */}
                {formData.sizes.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-md font-medium text-gray-900 mb-3">Stock per Size</h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                      {formData.sizes.map((size) => (
                        <div key={size} className="space-y-1">
                          <label htmlFor={`stock-${size}`} className="block text-sm font-medium text-gray-700">
                            Size {size}
                          </label>
                          <input
                            type="number"
                            id={`stock-${size}`}
                            min="0"
                            value={formData.stockBySize[size] || 0}
                            onChange={(e) => handleStockBySizeChange(size, parseInt(e.target.value) || 0)}
                            className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {errors.sizes && <p className="mt-2 text-sm text-red-600">{errors.sizes}</p>}
            </div>

            {/* Flags */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Product Flags</h2>
              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => handleInputChange('featured', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Featured Product</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.new}
                    onChange={(e) => handleInputChange('new', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">New Product</span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/admin/products')}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 