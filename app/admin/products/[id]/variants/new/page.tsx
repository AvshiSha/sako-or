'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeftIcon,
  PlusIcon,
  XMarkIcon,
  PhotoIcon
} from '@heroicons/react/24/outline'
import { productService, colorVariantService, Product } from '@/lib/firebase'
import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

interface ImageFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

export default function NewColorVariantPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params?.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form data
  const [formData, setFormData] = useState({
    colorName: '',
    colorSlug: '',
    colorHex: '',
    price: '',
    salePrice: '',
    saleStartDate: '',
    saleEndDate: '',
    stock: 0,
    isActive: true,
    metaTitle: '',
    metaDescription: ''
  })

  const [sizes, setSizes] = useState<Array<{ size: string; stock: number; sku: string }>>([])
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([])

  useEffect(() => {
    if (productId) {
      fetchProduct()
    }
  }, [productId])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      const productData = await productService.getProductById(productId)
      if (productData) {
        setProduct(productData)
        // Initialize with common sizes for the variant
        const commonSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']
        setSizes(commonSizes.map(size => ({
          size,
          stock: 0,
          sku: `${productData.baseSku}-${size}`
        })))
      } else {
        setError('Product not found')
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      setError('Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))

    // Auto-generate slug from color name
    if (name === 'colorName') {
      const slug = value
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      setFormData(prev => ({ ...prev, colorSlug: slug }))
    }
  }

  const handleSizeChange = (index: number, field: string, value: string | number) => {
    setSizes(prev => prev.map((size, i) => 
      i === index ? { ...size, [field]: value } : size
    ))
  }

  const addSize = () => {
    setSizes(prev => [...prev, { size: '', stock: 0, sku: '' }])
  }

  const removeSize = (index: number) => {
    setSizes(prev => prev.filter((_, i) => i !== index))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newImageFiles: ImageFile[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false
    }))

    setImageFiles(prev => [...prev, ...newImageFiles])
  }

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadImageToFirebase = async (imageFile: ImageFile): Promise<string> => {
    const timestamp = Date.now()
    const fileName = `${timestamp}_${imageFile.file.name}`
    const storageRef = ref(storage, `color-variants/${fileName}`)
    
    await uploadBytes(storageRef, imageFile.file)
    const downloadURL = await getDownloadURL(storageRef)
    return downloadURL
  }

  const uploadAllImages = async (): Promise<string[]> => {
    const uploadPromises = imageFiles.map(async (imageFile, index) => {
      setImageFiles(prev => prev.map((img, i) => 
        i === index ? { ...img, uploading: true } : img
      ))

      try {
        const url = await uploadImageToFirebase(imageFile)
        setImageFiles(prev => prev.map((img, i) => 
          i === index ? { ...img, uploading: false, uploaded: true, url } : img
        ))
        return url
      } catch (error) {
        console.error(`Error uploading image ${index + 1}:`, error)
        setImageFiles(prev => prev.map((img, i) => 
          i === index ? { ...img, uploading: false } : img
        ))
        throw error
      }
    })

    return Promise.all(uploadPromises)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return

    try {
      setSaving(true)
      setError(null)

      // Validate required fields
      if (!formData.colorName || !formData.colorSlug) {
        setError('Color name and slug are required')
        return
      }

      // Upload images
      const imageUrls = await uploadAllImages()

      // Create color variant
      const variantData = {
        productId: product.id!,
        colorName: formData.colorName,
        colorSlug: formData.colorSlug,
        colorHex: formData.colorHex || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        salePrice: formData.salePrice ? parseFloat(formData.salePrice) : undefined,
        saleStartDate: formData.saleStartDate ? new Date(formData.saleStartDate) : undefined,
        saleEndDate: formData.saleEndDate ? new Date(formData.saleEndDate) : undefined,
        stock: formData.stock,
        isActive: formData.isActive
      }

      const variantId = await colorVariantService.createColorVariant(variantData)

      // Add images to variant
      for (let i = 0; i < imageUrls.length; i++) {
        await colorVariantService.addColorVariantImage(variantId, {
          url: imageUrls[i],
          alt: `${product.name?.en} - ${formData.colorName} - Image ${i + 1}`,
          isPrimary: i === 0,
          order: i
        })
      }

      // Add sizes to variant
      for (const sizeData of sizes) {
        if (sizeData.size && sizeData.stock > 0) {
          const fullSku = `${product.baseSku}-${formData.colorSlug}-${sizeData.size}`
          await colorVariantService.addColorVariantSize(variantId, {
            size: sizeData.size,
            stock: sizeData.stock,
            sku: fullSku
          })
        }
      }

      // Redirect to color variants page
      router.push('/admin/products/color-variants')
    } catch (error) {
      console.error('Error creating color variant:', error)
      setError('Failed to create color variant')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  if (error && !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/admin/products/color-variants"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Back to Color Variants
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <Link
              href="/admin/products/color-variants"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Back to Color Variants
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add Color Variant</h1>
              <p className="text-gray-600">
                Add a new color variant for "{product?.name?.en}"
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Basic Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Name *
                </label>
                <input
                  type="text"
                  name="colorName"
                  value={formData.colorName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Slug *
                </label>
                <input
                  type="text"
                  name="colorSlug"
                  value={formData.colorSlug}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Hex Code
                </label>
                <input
                  type="text"
                  name="colorHex"
                  value={formData.colorHex}
                  onChange={handleInputChange}
                  placeholder="#000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Override
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use base product price: ₪{product?.price}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sale Price
                </label>
                <input
                  type="number"
                  name="salePrice"
                  value={formData.salePrice}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock
                </label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sale Start Date
                </label>
                <input
                  type="datetime-local"
                  name="saleStartDate"
                  value={formData.saleStartDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sale End Date
                </label>
                <input
                  type="datetime-local"
                  name="saleEndDate"
                  value={formData.saleEndDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Images</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Images
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {imageFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {imageFiles.map((imageFile, index) => (
                    <div key={index} className="relative">
                      <img
                        src={imageFile.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                      {imageFile.uploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sizes */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Sizes & Stock</h2>
              <button
                type="button"
                onClick={addSize}
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Size
              </button>
            </div>
            <div className="space-y-4">
              {sizes.map((size, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={size.size}
                      onChange={(e) => handleSizeChange(index, 'size', e.target.value)}
                      placeholder="Size (e.g., S, M, L, 36, 37)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={size.stock}
                      onChange={(e) => handleSizeChange(index, 'stock', parseInt(e.target.value) || 0)}
                      placeholder="Stock"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={size.sku}
                      onChange={(e) => handleSizeChange(index, 'sku', e.target.value)}
                      placeholder="SKU"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSize(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">SEO</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Title
                </label>
                <input
                  type="text"
                  name="metaTitle"
                  value={formData.metaTitle}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Description
                </label>
                <textarea
                  name="metaDescription"
                  value={formData.metaDescription}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end space-x-4">
            <Link
              href="/admin/products/color-variants"
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Color Variant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
