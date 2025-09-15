'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon,
  ChevronLeftIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { productService, colorVariantService, Product, ColorVariant } from '@/lib/firebase'

interface ProductWithVariants extends Product {
  colorVariants: ColorVariant[]
}

export default function ColorVariantsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get all products with their color variants
      const productsSnapshot = await productService.getAllProducts()
      const productsWithVariants: ProductWithVariants[] = []
      
      for (const product of productsSnapshot) {
        if (product.baseSku) {
          const productWithVariants = await productService.getProductWithColorVariants(product.baseSku)
          if (productWithVariants) {
            productsWithVariants.push(productWithVariants)
          }
        }
      }
      
      setProducts(productsWithVariants)
    } catch (error) {
      console.error('Error fetching products:', error)
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVariant = async (variantId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete this color variant for "${productName}"?`)) {
      return
    }

    try {
      await colorVariantService.deleteColorVariant(variantId)
      await fetchProducts() // Refresh the list
    } catch (error) {
      console.error('Error deleting variant:', error)
      alert('Failed to delete color variant')
    }
  }

  const handleToggleVariantStatus = async (variantId: string, isActive: boolean) => {
    try {
      await colorVariantService.updateColorVariant(variantId, { isActive: !isActive })
      await fetchProducts() // Refresh the list
    } catch (error) {
      console.error('Error updating variant status:', error)
      alert('Failed to update variant status')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchProducts}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/products"
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Back to Products
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Color Variants</h1>
                <p className="text-gray-600">Manage color variants for your products</p>
              </div>
            </div>
            <Link
              href="/admin/products/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              New Product
            </Link>
          </div>
        </div>

        {/* Products List */}
        <div className="space-y-6">
          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No products with color variants found.</p>
              <Link
                href="/admin/products/new"
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create First Product
              </Link>
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {product.name?.en || 'Unnamed Product'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Base SKU: {product.baseSku} • {product.colorVariants.length} color variants
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit Product
                      </Link>
                      <Link
                        href={`/en/product/${product.baseSku}`}
                        target="_blank"
                        className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Color Variants */}
                <div className="px-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {product.colorVariants.map((variant) => (
                      <div key={variant.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-6 h-6 rounded-full border border-gray-300"
                              style={{ backgroundColor: variant.colorHex || '#ccc' }}
                              title={variant.colorName}
                            />
                            <h4 className="font-medium text-gray-900">{variant.colorName}</h4>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleToggleVariantStatus(variant.id!, variant.isActive)}
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                variant.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {variant.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Slug:</span>
                            <span className="font-mono">{variant.colorSlug}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Price:</span>
                            <span>₪{variant.price || product.price}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Stock:</span>
                            <span>{variant.stock}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sizes:</span>
                            <span>{variant.sizes.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Images:</span>
                            <span>{variant.images.length}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <Link
                            href={`/en/product/${product.baseSku}/${variant.colorSlug}`}
                            target="_blank"
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            View Page
                          </Link>
                          <div className="flex items-center space-x-2">
                            <Link
                              href={`/admin/products/${product.id}/variants/${variant.id}/edit`}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => handleDeleteVariant(variant.id!, product.name?.en || 'Unknown')}
                              className="text-red-400 hover:text-red-600"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Color Variant Button */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Link
                      href={`/admin/products/${product.id}/variants/new`}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add Color Variant
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
